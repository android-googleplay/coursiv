import "server-only";

import { createHash } from "node:crypto";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import { sanitizeMetaAttribution, type MetaAttribution, type MetaEventName } from "./meta-contract";

type MetaServerEventInput = {
  eventId: string;
  eventName: MetaEventName;
  eventSourceUrl?: string;
  emailHash?: string;
  userId?: string;
  attribution?: MetaAttribution;
  clientIp?: string;
  userAgent?: string;
  consent: "granted" | "regional-default";
  customData?: { value?: number; currency?: string; content_name?: string };
};

type MetaDeliveryResult = {
  status: "sent" | "duplicate" | "disabled" | "failed";
  responseId?: string;
};

function configured() {
  return Boolean(
    process.env.META_DATASET_ID &&
      process.env.META_CONVERSIONS_API_TOKEN &&
      process.env.META_GRAPH_API_VERSION,
  );
}

function cleanIp(value: string | undefined) {
  return value?.split(",")[0]?.trim().slice(0, 64) || undefined;
}

function cleanSourceUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.username = "";
    url.password = "";
    return url.toString().slice(0, 500);
  } catch {
    return undefined;
  }
}

export function buildMetaRequestBody(input: MetaServerEventInput) {
  const attribution = sanitizeMetaAttribution(input.attribution);
  const userData: Record<string, string | string[]> = {};
  if (input.emailHash) userData.em = [input.emailHash];
  if (input.userId) userData.external_id = [createHash("sha256").update(input.userId).digest("hex")];
  else if (attribution.anonymousId) userData.external_id = [createHash("sha256").update(attribution.anonymousId).digest("hex")];
  if (attribution.fbp) userData.fbp = attribution.fbp;
  if (attribution.fbc) userData.fbc = attribution.fbc;
  if (cleanIp(input.clientIp)) userData.client_ip_address = cleanIp(input.clientIp)!;
  if (input.userAgent) userData.client_user_agent = input.userAgent.slice(0, 500);

  const event = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website" as const,
    event_source_url: cleanSourceUrl(input.eventSourceUrl ?? attribution.landingUrl),
    user_data: userData,
    ...(input.customData ? { custom_data: input.customData } : {}),
  };
  return {
    data: [event],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };
}

async function reserveEvent(input: MetaServerEventInput) {
  if (!isFirebaseAdminConfigured()) return "reserved" as const;
  const reference = getAdminDb().collection("events").doc(input.eventId);
  return getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data();
    if (current?.metaStatus === "sent") return "duplicate" as const;
    const lastAttempt = typeof current?.metaAttemptedAt === "string" ? Date.parse(current.metaAttemptedAt) : 0;
    if (current?.metaStatus === "sending" && Date.now() - lastAttempt < 60_000) return "duplicate" as const;
    const now = new Date().toISOString();
    transaction.set(reference, {
      eventId: input.eventId,
      eventName: input.eventName,
      source: "meta-capi",
      consent: input.consent,
      userId: input.userId ?? null,
      anonymousId: input.attribution?.anonymousId ?? null,
      metaStatus: "sending",
      metaAttemptedAt: now,
      updatedAt: now,
      ...(snapshot.exists ? {} : { createdAt: now }),
    }, { merge: true });
    return "reserved" as const;
  });
}

async function recordResult(eventId: string, status: "sent" | "failed", responseId?: string) {
  if (!isFirebaseAdminConfigured()) return;
  await getAdminDb().collection("events").doc(eventId).set({
    metaStatus: status,
    metaResponseId: responseId ?? null,
    metaDeliveredAt: status === "sent" ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function postWithRetry(url: string, body: unknown) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.META_CONVERSIONS_API_TOKEN!}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as { fbtrace_id?: string; error?: { message?: string } };
      if (response.ok) return data;
      lastError = new Error(`Meta delivery failed (${response.status})`);
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Meta delivery failed");
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError ?? new Error("Meta delivery failed");
}

export async function sendMetaServerEvent(input: MetaServerEventInput): Promise<MetaDeliveryResult> {
  if (!configured()) return { status: "disabled" };
  const reservation = await reserveEvent(input).catch(() => "reserved" as const);
  if (reservation === "duplicate") return { status: "duplicate" };
  const rawVersion = process.env.META_GRAPH_API_VERSION!.trim();
  const version = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`;
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(process.env.META_DATASET_ID!)}/events`;
  try {
    const response = await postWithRetry(url, buildMetaRequestBody(input));
    await recordResult(input.eventId, "sent", response.fbtrace_id).catch(() => undefined);
    return { status: "sent", responseId: response.fbtrace_id };
  } catch {
    await recordResult(input.eventId, "failed").catch(() => undefined);
    return { status: "failed" };
  }
}

export function requestClientContext(request: Request) {
  const headers = request.headers;
  return {
    clientIp: headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? undefined,
    userAgent: headers.get("user-agent") ?? undefined,
  };
}
