import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminOverview } from "@/lib/platform/admin-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireStaff(request);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return NextResponse.json(await getAdminOverview(actor));
}
