import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import { getStripe, isStripeConfigured } from "@/lib/platform/stripe";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";
import { sendMetaServerEvent } from "@/lib/platform/meta-conversions";
import { sha256Hex } from "@/lib/platform/meta-contract";
import { purchaseAttribution, shouldTrackPurchase } from "@/lib/platform/stripe-attribution";

export const runtime = "nodejs";

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId || !isFirebaseAdminConfigured()) return;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const periodEnd = subscription.items.data.reduce((latest, item) => Math.max(latest, item.current_period_end), 0);
  await getAdminDb().collection("subscriptions").doc(userId).set({
    id: subscription.id,
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id ?? "",
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  await refreshAdminUserSummary(userId);
}

export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 }); }

  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await syncSubscription(event.data.object as Stripe.Subscription);
  }
  if (event.type === "checkout.session.completed" && isFirebaseAdminConfigured()) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.client_reference_id) await getAdminDb().collection("users").doc(session.client_reference_id).set({ onboardingCompleted: false, stripeCustomerId: session.customer, updatedAt: new Date().toISOString() }, { merge: true });
    const meta = purchaseAttribution(session);
    if (shouldTrackPurchase(session) && (meta.consent === "granted" || meta.consent === "regional-default")) {
      const email = session.customer_details?.email ?? session.customer_email ?? undefined;
      await sendMetaServerEvent({
        eventId: meta.eventId,
        eventName: "Purchase",
        eventSourceUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/paywall`,
        emailHash: email ? await sha256Hex(email) : undefined,
        userId: session.client_reference_id ?? undefined,
        attribution: meta.attribution,
        consent: meta.consent,
        customData: {
          value: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "usd").toUpperCase(),
          content_name: "Coursiv membership",
        },
      }).catch(() => undefined);
    }
  }
  return NextResponse.json({ received: true });
}
