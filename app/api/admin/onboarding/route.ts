import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { listAdminOnboardingPages } from "@/lib/platform/admin-onboarding-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireStaff(request, ["admin", "editor", "analyst"]);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return NextResponse.json({
    flow: {
      id: "c-1185",
      name: "Personalized AI Certificate Program",
      source: "reference-v1",
    },
    pages: await listAdminOnboardingPages(actor),
    editable: actor.role === "admin" || actor.role === "editor",
    debug: actor.debug,
  });
}
