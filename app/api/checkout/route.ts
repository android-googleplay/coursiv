import { NextRequest, NextResponse } from "next/server";
import { isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { getStripe, isStripeConfigured } from "@/lib/platform/stripe";
import { sanitizeEventId, sanitizeMetaAttribution, sha256Hex } from "@/lib/platform/meta-contract";
import { requestClientContext, sendMetaServerEvent } from "@/lib/platform/meta-conversions";
import { consentDecision, countryFromHeaders, META_CONSENT_COOKIE, parseConsentCookie } from "@/lib/platform/privacy-consent";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEEKLY_PRICE_ID || !isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Checkout is in demo mode. Configure Firebase Admin and Stripe first." }, { status: 503 });
  }
  const user = await verifyBearerToken(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const eventId = sanitizeEventId(body?.eventId) ?? crypto.randomUUID();
  const purchaseEventId = crypto.randomUUID();
  const decision = consentDecision(countryFromHeaders(request.headers), parseConsentCookie(request.cookies.get(META_CONSENT_COOKIE)?.value));
  const attribution = decision.marketingAllowed ? sanitizeMetaAttribution(body?.attribution) : { anonymousId: "" };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const price = await getStripe().prices.retrieve(process.env.STRIPE_WEEKLY_PRICE_ID);
  if (!price.active || !price.unit_amount || !price.currency) return NextResponse.json({ error: "This offer is currently unavailable." }, { status: 409 });
  const metaConsent = decision.marketingAllowed ? (decision.consent === "granted" ? "granted" : "regional-default") : "denied";
  const metadata = Object.fromEntries(Object.entries({
    userId: user.uid,
    anonymousId: attribution.anonymousId,
    metaCheckoutEventId: eventId,
    metaPurchaseEventId: purchaseEventId,
    metaConsent,
    fbc: attribution.fbc ?? "",
    fbp: attribution.fbp ?? "",
    utmSource: attribution.utmSource ?? "",
    utmCampaign: attribution.utmCampaign ?? "",
    utmContent: attribution.utmContent ?? "",
    utmMedium: attribution.utmMedium ?? "",
    utmTerm: attribution.utmTerm ?? "",
  }).filter(([, value]) => value !== ""));
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.uid,
    line_items: [{ price: process.env.STRIPE_WEEKLY_PRICE_ID, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: `${appUrl}/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/paywall?checkout=canceled`,
    allow_promotion_codes: true,
  });
  if (decision.marketingAllowed) {
    await sendMetaServerEvent({
      eventId,
      eventName: "InitiateCheckout",
      eventSourceUrl: `${appUrl}/paywall`,
      emailHash: user.email ? await sha256Hex(user.email) : undefined,
      userId: user.uid,
      attribution,
      ...requestClientContext(request),
      consent: decision.consent === "granted" ? "granted" : "regional-default",
      customData: { value: price.unit_amount / 100, currency: price.currency.toUpperCase(), content_name: "Coursiv membership" },
    }).catch(() => undefined);
  }
  return NextResponse.json({ url: session.url, eventId });
}
