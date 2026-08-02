import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireStaff } from "@/lib/platform/admin-auth";
import { rollbackAdminLesson } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor"]);
  if (!actor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const id = (await params).id;
  const reservation = await reserveAdminMutation(actor, request, `content.lesson.rollback:${id}`);
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { revisionId?: string; expectedVersion?: number; reason?: string; confirm?: boolean } | null;
  if (!body?.revisionId || !Number.isInteger(body.expectedVersion) || !body.confirm || !body.reason?.trim()) return NextResponse.json({ error: "Revision, expected version, confirmation and reason are required" }, { status: 400 });
  const result = await rollbackAdminLesson(actor, request, id, body.revisionId, body.expectedVersion!, body.reason);
  if (!result.ok) return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: result.status });
  revalidateTag(`lesson:${id}`, "max");
  revalidateTag(`course:${result.lesson.courseId}`, "max");
  return NextResponse.json({ lesson: result.lesson });
}
