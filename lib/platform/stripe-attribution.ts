import type Stripe from "stripe";
import { sanitizeMetaAttribution } from "./meta-contract";

export function shouldTrackPurchase(session: Pick<Stripe.Checkout.Session, "payment_status" | "amount_total" | "mode">) {
  return session.mode === "subscription" && session.payment_status === "paid" && typeof session.amount_total === "number" && session.amount_total > 0;
}

export function purchaseAttribution(session: Pick<Stripe.Checkout.Session, "id" | "metadata">) {
  const metadata = session.metadata ?? {};
  return {
    eventId: metadata.metaPurchaseEventId || session.id,
    consent: metadata.metaConsent,
    attribution: sanitizeMetaAttribution({
      anonymousId: metadata.anonymousId,
      fbc: metadata.fbc,
      fbp: metadata.fbp,
      utmSource: metadata.utmSource,
      utmCampaign: metadata.utmCampaign,
      utmContent: metadata.utmContent,
      utmMedium: metadata.utmMedium,
      utmTerm: metadata.utmTerm,
    }),
  };
}
