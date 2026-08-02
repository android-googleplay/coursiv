import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { listAppHostingDeployments } from "@/lib/platform/admin-time-machine-deployment";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try { return NextResponse.json(await listAppHostingDeployments()); }
  catch (error) { return NextResponse.json({ configured: true, builds: [], error: error instanceof Error ? error.message : "Unable to load App Hosting" }, { status: 502 }); }
}
