import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { rollbackAdminCourse } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor"]);
  if (!actor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const id = (await params).id;
  const reservation = await reserveAdminMutation(actor, request, `content.course.rollback:${id}`);
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { revisionId?: string; expectedVersion?: number; reason?: string; confirm?: boolean } | null;
  if (!body?.revisionId || !Number.isInteger(body.expectedVersion) || !body.confirm || !body.reason?.trim()) return NextResponse.json({ error: "Revision, version, reason and confirmation are required" }, { status: 400 });
  const result = await rollbackAdminCourse(actor, request, id, body.revisionId, body.expectedVersion!, body.reason.trim());
  if (!result.ok) return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: result.status });
  revalidateTag("catalog", "max"); revalidateTag(`course:${id}`, "max");
  return NextResponse.json({ course: result.course });
}
