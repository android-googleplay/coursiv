import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { createContentCheckpoint, deleteExpiredContentCheckpoints } from "@/lib/platform/admin-time-machine-content";
import type { StaffActor } from "@/lib/platform/admin-auth";

export const runtime = "nodejs";

async function schedulerActor(request: Request): Promise<StaffActor | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const audience = process.env.TIME_MACHINE_SCHEDULER_AUDIENCE;
  const expectedEmail = process.env.TIME_MACHINE_SCHEDULER_SERVICE_ACCOUNT_EMAIL;
  if (!token || !audience || !expectedEmail) return null;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== expectedEmail) return null;
    return { uid: payload.sub, email: payload.email, role: "admin", debug: false };
  } catch { return null; }
}

export async function POST(request: Request) {
  const actor = await schedulerActor(request);
  if (!actor) return NextResponse.json({ error: "Valid Cloud Scheduler OIDC identity required" }, { status: 403 });
  const checkpoint = await createContentCheckpoint(actor, { kind: "daily", label: "Daily content snapshot", reason: "Scheduled daily recovery point" });
  await deleteExpiredContentCheckpoints(actor);
  return NextResponse.json({ checkpoint });
}
