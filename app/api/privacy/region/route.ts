import { NextRequest, NextResponse } from "next/server";
import { consentDecision, countryFromHeaders, META_CONSENT_COOKIE, parseConsentCookie } from "@/lib/platform/privacy-consent";

export function GET(request: NextRequest) {
  const countryCode = countryFromHeaders(request.headers);
  const consent = parseConsentCookie(request.cookies.get(META_CONSENT_COOKIE)?.value);
  return NextResponse.json(consentDecision(countryCode, consent), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
