import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null = null;
export function isStripeConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY); }
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

