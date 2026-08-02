import { describe, expect, it } from "vitest";
import { purchaseAttribution, shouldTrackPurchase } from "./stripe-attribution";

describe("Stripe purchase attribution", () => {
  it("only accepts a positive paid subscription checkout", () => {
    expect(shouldTrackPurchase({ mode: "subscription", payment_status: "paid", amount_total: 999 })).toBe(true);
    expect(shouldTrackPurchase({ mode: "subscription", payment_status: "unpaid", amount_total: 999 })).toBe(false);
    expect(shouldTrackPurchase({ mode: "subscription", payment_status: "paid", amount_total: 0 })).toBe(false);
    expect(shouldTrackPurchase({ mode: "payment", payment_status: "paid", amount_total: 999 })).toBe(false);
  });

  it("uses the dedicated Purchase event ID and safely falls back to the Stripe session ID", () => {
    expect(purchaseAttribution({ id: "cs_1", metadata: { metaPurchaseEventId: "purchase-1", metaConsent: "granted", fbp: "fb.1.123.abc" } })).toMatchObject({ eventId: "purchase-1", consent: "granted", attribution: { fbp: "fb.1.123.abc" } });
    expect(purchaseAttribution({ id: "cs_fallback", metadata: null }).eventId).toBe("cs_fallback");
  });
});
