import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { previewContentRestore } from "@/lib/platform/admin-time-machine-content";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { checkpointId?: string } | null;
  if (!body?.checkpointId) return NextResponse.json({ error: "Checkpoint is required" }, { status: 400 });
  const result = await previewContentRestore(actor, body.checkpointId);
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: result.status });
}
