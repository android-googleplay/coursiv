import { NextRequest, NextResponse } from "next/server";
import { isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { isSha256, metaEventName, sanitizeEventId, sanitizeMetaAttribution, sha256Hex } from "@/lib/platform/meta-contract";
import { requestClientContext, sendMetaServerEvent } from "@/lib/platform/meta-conversions";
import { consentDecision, countryFromHeaders, META_CONSENT_COOKIE, parseConsentCookie } from "@/lib/platform/privacy-consent";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const eventName = metaEventName(body?.eventName);
  const eventId = sanitizeEventId(body?.eventId);
  if (!eventName || !eventId || !["Lead", "CompleteRegistration"].includes(eventName)) {
    return NextResponse.json({ error: "Unsupported Meta event." }, { status: 400 });
  }
  const decision = consentDecision(
    countryFromHeaders(request.headers),
    parseConsentCookie(request.cookies.get(META_CONSENT_COOKIE)?.value),
  );
  if (!decision.marketingAllowed) return NextResponse.json({ accepted: false, reason: "consent_required" }, { status: 202 });

  let userId: string | undefined;
  let emailHash = isSha256(body?.emailHash) ? body.emailHash.toLowerCase() : undefined;
  if (eventName === "CompleteRegistration") {
    if (!isFirebaseAdminConfigured()) return NextResponse.json({ accepted: false, reason: "server_not_configured" }, { status: 202 });
    const user = await verifyBearerToken(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    userId = user.uid;
    emailHash = user.email ? await sha256Hex(user.email) : undefined;
  }
  if (eventName === "Lead" && !emailHash) return NextResponse.json({ error: "A hashed email is required." }, { status: 400 });

  const result = await sendMetaServerEvent({
    eventId,
    eventName,
    eventSourceUrl: typeof body?.eventSourceUrl === "string" ? body.eventSourceUrl : undefined,
    emailHash,
    userId,
    attribution: sanitizeMetaAttribution(body?.attribution),
    ...requestClientContext(request),
    consent: decision.consent === "granted" ? "granted" : "regional-default",
  });
  return NextResponse.json({ accepted: true, status: result.status });
}
