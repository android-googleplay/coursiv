import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { createContentCheckpoint } from "@/lib/platform/admin-time-machine-content";
import { writeAdminAudit } from "@/lib/platform/admin-audit";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const reservation = await reserveAdminMutation(actor, request, "content.time_machine.checkpoint");
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { label?: string; reason?: string; confirm?: boolean } | null;
  if (!body?.confirm || !body.reason?.trim()) return NextResponse.json({ error: "Reason and confirmation are required" }, { status: 400 });
  const checkpoint = await createContentCheckpoint(actor, { kind: "manual", label: body.label?.trim() || "Manual checkpoint", reason: body.reason.trim() });
  await writeAdminAudit(actor, { action: "content.time_machine.checkpoint", targetType: "contentCheckpoint", targetId: checkpoint.id, request, reason: body.reason, after: checkpoint });
  return NextResponse.json({ checkpoint }, { status: 201 });
}
