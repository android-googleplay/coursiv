import { after, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import type { WelcomeEmailDelivery } from "@/lib/platform/types";
import {
  isWelcomeEmailConfigured,
  sendWelcomeEmail,
  WELCOME_EMAIL_TEMPLATE_VERSION,
} from "@/lib/platform/welcome-email";

export const runtime = "nodejs";

const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const STALE_QUEUE_MS = 5 * 60 * 1000;
const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

type Reservation =
  | { kind: "queued"; delivery: WelcomeEmailDelivery }
  | { kind: "duplicate"; status: WelcomeEmailDelivery["status"] }
  | { kind: "not_new" };

function deliveryId(uid: string) {
  return `welcome-v1:${uid}`;
}

export function isRecentFirebaseAccount(creationTime: string | undefined, now = Date.now()) {
  if (!creationTime) return false;
  const createdAt = Date.parse(creationTime);
  if (!Number.isFinite(createdAt)) return false;
  const age = now - createdAt;
  return age >= -60_000 && age <= NEW_ACCOUNT_WINDOW_MS;
}

function deliveryFromData(id: string, data: Record<string, unknown>): WelcomeEmailDelivery {
  const status = ["queued", "sent", "failed"].includes(String(data.status))
    ? data.status as WelcomeEmailDelivery["status"]
    : "failed";
  return {
    id,
    userId: String(data.userId ?? ""),
    recipientEmail: String(data.recipientEmail ?? ""),
    recipientName: String(data.recipientName ?? "Coursiv learner"),
    templateVersion: WELCOME_EMAIL_TEMPLATE_VERSION,
    status,
    attempts: Number.isFinite(Number(data.attempts)) ? Math.max(0, Number(data.attempts)) : 0,
    providerMessageId: typeof data.providerMessageId === "string" ? data.providerMessageId : null,
    lastErrorCode: typeof data.lastErrorCode === "string" ? data.lastErrorCode : null,
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    sentAt: typeof data.sentAt === "string" ? data.sentAt : null,
  };
}

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Welcome email is not configured" }, { status: 503 });
  const decoded = await verifyBearerToken(request);
  if (!decoded) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isWelcomeEmailConfigured()) return NextResponse.json({ error: "Welcome email is not configured" }, { status: 503 });

  const authUser = await getAdminAuth().getUser(decoded.uid);
  if (!authUser.email) return NextResponse.json({ error: "An account email is required" }, { status: 422 });

  const database = getAdminDb();
  const reference = database.collection("emailDeliveries").doc(deliveryId(decoded.uid));
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const recipientName = authUser.displayName?.trim() || authUser.email.split("@")[0] || "Coursiv learner";

  const reservation = await database.runTransaction<Reservation>(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) {
      const current = deliveryFromData(snapshot.id, snapshot.data() ?? {});
      if (current.status !== "queued") return { kind: "duplicate", status: current.status };
      const updatedAt = Date.parse(current.updatedAt);
      const createdAt = Date.parse(current.createdAt);
      const stale = Number.isFinite(updatedAt) && nowMs - updatedAt >= STALE_QUEUE_MS;
      const idempotencyActive = Number.isFinite(createdAt) && nowMs - createdAt < RESEND_IDEMPOTENCY_WINDOW_MS;
      if (!stale) return { kind: "duplicate", status: current.status };
      if (!idempotencyActive) {
        transaction.set(reference, { status: "failed", lastErrorCode: "stale_queue_requires_review", updatedAt: now }, { merge: true });
        return { kind: "duplicate", status: "failed" };
      }
      const delivery = { ...current, status: "queued" as const, updatedAt: now, lastErrorCode: null };
      transaction.set(reference, delivery, { merge: true });
      return { kind: "queued", delivery };
    }

    if (!isRecentFirebaseAccount(authUser.metadata.creationTime, nowMs)) return { kind: "not_new" };
    const delivery: WelcomeEmailDelivery = {
      id: reference.id,
      userId: decoded.uid,
      recipientEmail: authUser.email!,
      recipientName,
      templateVersion: WELCOME_EMAIL_TEMPLATE_VERSION,
      status: "queued",
      attempts: 0,
      providerMessageId: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
    };
    transaction.create(reference, delivery);
    return { kind: "queued", delivery };
  });

  if (reservation.kind === "not_new") {
    return NextResponse.json({ error: "Welcome email is only available during new-account creation" }, { status: 403 });
  }
  if (reservation.kind === "duplicate") {
    return NextResponse.json({ status: reservation.status, duplicate: true });
  }

  const delivery = reservation.delivery;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const config = {
    apiKey: process.env.RESEND_API_KEY!,
    fromEmail: process.env.WELCOME_FROM_EMAIL!,
    replyToEmail: process.env.WELCOME_REPLY_TO_EMAIL!,
  };
  after(async () => {
    const result = await sendWelcomeEmail({
      userId: delivery.userId,
      recipientEmail: delivery.recipientEmail,
      recipientName: delivery.recipientName,
      appUrl,
    }, config).catch(() => ({ status: "failed" as const, attempts: 1, errorCode: "network_error" }));
    const updatedAt = new Date().toISOString();
    await reference.set(result.status === "sent" ? {
      status: "sent",
      attempts: delivery.attempts + result.attempts,
      providerMessageId: result.emailId,
      lastErrorCode: null,
      sentAt: updatedAt,
      updatedAt,
    } : {
      status: "failed",
      attempts: delivery.attempts + result.attempts,
      providerMessageId: null,
      lastErrorCode: result.errorCode,
      sentAt: null,
      updatedAt,
    }, { merge: true });
  });

  return NextResponse.json({ status: "queued" }, { status: 202 });
}
