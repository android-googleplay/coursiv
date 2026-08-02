import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { deleteAdminDraftCourse, getAdminCourse, publishAdminCourse, type EditableCourse } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor", "analyst"]);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  const course = await getAdminCourse(actor, (await params).id);
  return course ? NextResponse.json({ course }) : NextResponse.json({ error: "Course not found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin", "editor"]);
  if (!actor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const id = (await params).id;
  const reservation = await reserveAdminMutation(actor, request, `content.course.publish:${id}`);
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { course?: EditableCourse; expectedVersion?: number; changeSummary?: string } | null;
  if (!body?.course || body.course.id !== id || !Number.isInteger(body.expectedVersion)) return NextResponse.json({ error: "Invalid course payload" }, { status: 400 });
  const result = await publishAdminCourse(actor, request, body.course, body.expectedVersion!, body.changeSummary?.trim() || "Published course metadata changes");
  if (!result.ok) return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: result.status });
  revalidateTag("catalog", "max");
  revalidateTag(`course:${id}`, "max");
  return NextResponse.json({ course: result.course });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const id = (await params).id;
  const reservation = await reserveAdminMutation(actor, request, `content.course.delete:${id}`);
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { expectedVersion?: number; reason?: string; confirm?: boolean; confirmationId?: string } | null;
  if (!Number.isInteger(body?.expectedVersion) || !body?.confirm || body.confirmationId !== id || !body.reason?.trim()) {
    return NextResponse.json({ error: "Version, reason, confirmation and exact course ID are required" }, { status: 400 });
  }
  const result = await deleteAdminDraftCourse(actor, request, id, body.expectedVersion!, body.reason.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  revalidateTag("catalog", "max");
  revalidateTag(`course:${id}`, "max");
  return NextResponse.json({ deleted: true });
}
