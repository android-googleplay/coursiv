import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { listAdminCourseRevisions } from "@/lib/platform/admin-content-repository";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor", "analyst"]);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return NextResponse.json({ revisions: await listAdminCourseRevisions(actor, (await params).id) });
}
