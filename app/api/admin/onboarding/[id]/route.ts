import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/platform/admin-auth";
import {
  getAdminOnboardingPage,
  publishAdminOnboardingPage,
} from "@/lib/platform/admin-onboarding-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import type { OnboardingPageEditableFields } from "@/lib/onboarding-funnel";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireStaff(request, ["admin", "editor", "analyst"]);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  const page = await getAdminOnboardingPage(actor, (await context.params).id);
  if (!page) return NextResponse.json({ error: "Onboarding page not found" }, { status: 404 });
  return NextResponse.json({ page });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await requireStaff(request, ["admin", "editor"]);
  if (!actor) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const pageId = (await context.params).id;
  const reservation = await reserveAdminMutation(actor, request, `content.onboarding.${pageId}.publish`);
  if (!reservation.ok) return NextResponse.json({ error: reservation.error }, { status: reservation.status });
  const body = await request.json().catch(() => null) as {
    fields?: OnboardingPageEditableFields;
    expectedVersion?: number;
    changeSummary?: string;
  } | null;
  if (!body?.fields || !Number.isInteger(body.expectedVersion)) {
    return NextResponse.json({ error: "Editable fields and expectedVersion are required." }, { status: 400 });
  }
  try {
    const result = await publishAdminOnboardingPage(actor, {
      pageId,
      fields: body.fields,
      expectedVersion: body.expectedVersion!,
      changeSummary: body.changeSummary ?? "",
    });
    if (!result.ok) return NextResponse.json({ error: result.error, errors: result.errors }, { status: result.status });
    revalidatePath("/dynamic", "layout");
    return NextResponse.json({ page: result.page, debug: result.debug });
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 500);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to publish onboarding page",
    }, { status });
  }
}
