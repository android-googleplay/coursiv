import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { refreshDeploymentRollbackJob } from "@/lib/platform/admin-time-machine-deployment";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const job = await refreshDeploymentRollbackJob(actor, (await params).id);
  return job ? NextResponse.json({ job }) : NextResponse.json({ error: "Job not found" }, { status: 404 });
}
