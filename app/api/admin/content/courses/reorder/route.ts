import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reorderAdminCourses } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await requireStaff(request, ["admin", "editor"]);
  if (!actor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const reservation = await reserveAdminMutation(actor, request, "content.course.reorder");
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as { kind?: "tool" | "use-case"; orderedIds?: string[]; expectedVersions?: Record<string, number> } | null;
  if (!body || !["tool", "use-case"].includes(String(body.kind)) || !Array.isArray(body.orderedIds) || !body.expectedVersions) {
    return NextResponse.json({ error: "Kind, ordered IDs and expected versions are required" }, { status: 400 });
  }
  const result = await reorderAdminCourses(actor, request, body.kind!, body.orderedIds, body.expectedVersions);
  if (!result.ok) return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: result.status });
  revalidateTag("catalog", "max");
  for (const course of result.courses) revalidateTag(`course:${course.id}`, "max");
  return NextResponse.json({ courses: result.courses });
}
