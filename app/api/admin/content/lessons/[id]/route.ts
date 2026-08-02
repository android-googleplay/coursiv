import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminLesson, publishAdminLesson, type EditableLesson } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor", "analyst"]);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  const lesson = await getAdminLesson(actor, (await params).id);
  return lesson ? NextResponse.json({ lesson }) : NextResponse.json({ error: "Lesson not found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor"]);
  if (!actor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const id = (await params).id;
  const reservation = await reserveAdminMutation(actor, request, `content.lesson.publish:${id}`);
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { lesson?: EditableLesson; expectedVersion?: number; changeSummary?: string } | null;
  if (!body?.lesson || body.lesson.id !== id || !Number.isInteger(body.expectedVersion)) return NextResponse.json({ error: "Invalid lesson payload" }, { status: 400 });
  const result = await publishAdminLesson(actor, request, body.lesson, body.expectedVersion!, body.changeSummary?.trim() || "Published lesson changes");
  if (!result.ok) return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: result.status });
  revalidateTag(`lesson:${id}`, "max");
  revalidateTag(`course:${result.lesson.courseId}`, "max");
  return NextResponse.json({ lesson: result.lesson });
}
