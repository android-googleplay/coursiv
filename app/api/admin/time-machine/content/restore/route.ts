import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { restoreContentCheckpoint } from "@/lib/platform/admin-time-machine-content";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const reservation = await reserveAdminMutation(actor, request, "content.time_machine.restore");
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { checkpointId?: string; reason?: string; confirmation?: string; confirm?: boolean } | null;
  if (!body?.checkpointId || !body.confirm || body.confirmation !== "RESTORE CONTENT" || !body.reason?.trim()) return NextResponse.json({ error: "Checkpoint, reason and exact confirmation are required" }, { status: 400 });
  const result = await restoreContentCheckpoint(actor, request, { checkpointId: body.checkpointId, reason: body.reason.trim() });
  if (!result.ok) return NextResponse.json({ error: result.error, job: result.job }, { status: result.status });
  revalidateTag("catalog", "max");
  return NextResponse.json({ job: result.job });
}
