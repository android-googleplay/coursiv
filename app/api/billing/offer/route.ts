import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/platform/stripe";

export const runtime = "nodejs";

export async function GET() {
  if (!isStripeConfigured() || !process.env.STRIPE_WEEKLY_PRICE_ID) {
    return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const price = await getStripe().prices.retrieve(process.env.STRIPE_WEEKLY_PRICE_ID, { expand: ["product"] });
    const product = typeof price.product === "string" ? null : price.product;
    return NextResponse.json({
      configured: Boolean(price.active && price.unit_amount && price.currency && price.recurring),
      productName: product && !product.deleted ? product.name : "Coursiv membership",
      productDescription: product && !product.deleted ? product.description : null,
      amount: price.unit_amount,
      currency: price.currency.toUpperCase(),
      interval: price.recurring?.interval,
      intervalCount: price.recurring?.interval_count,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
