import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { listContentCheckpoints } from "@/lib/platform/admin-time-machine-content";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return NextResponse.json({ checkpoints: await listContentCheckpoints(actor) });
}
