import { NextRequest, NextResponse } from "next/server";
import { consentDecision, countryFromHeaders, META_CONSENT_COOKIE, META_CONSENT_MAX_AGE } from "@/lib/platform/privacy-consent";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { consent?: unknown } | null;
  if (body?.consent !== "granted" && body?.consent !== "denied") {
    return NextResponse.json({ error: "Consent must be granted or denied." }, { status: 400 });
  }
  const countryCode = countryFromHeaders(request.headers);
  const response = NextResponse.json(consentDecision(countryCode, body.consent));
  response.cookies.set(META_CONSENT_COOKIE, body.consent, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: META_CONSENT_MAX_AGE,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
