import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { rollbackAppHostingDeployment } from "@/lib/platform/admin-time-machine-deployment";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!actor.debug && (!actor.authenticatedAt || Date.now()/1000-actor.authenticatedAt>600)) return NextResponse.json({ error: "Sign in again before changing production traffic" }, { status: 401 });
  const reservation = await reserveAdminMutation(actor, request, "deployment.time_machine.rollback");
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { buildId?: string; reason?: string; confirmation?: string; confirm?: boolean } | null;
  if (!body?.buildId || !body.confirm || body.confirmation !== "ROLLBACK DEPLOYMENT" || !body.reason?.trim()) return NextResponse.json({ error: "Build, reason and exact confirmation are required" }, { status: 400 });
  const result = await rollbackAppHostingDeployment(actor, request, body.buildId, body.reason.trim());
  return result.ok ? NextResponse.json({ job: result.job }, { status: 202 }) : NextResponse.json({ error: result.error, job: result.job }, { status: result.status });
}
