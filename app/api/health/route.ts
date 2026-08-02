import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import { isStripeConfigured } from "@/lib/platform/stripe";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    services: {
      firebase: isFirebaseAdminConfigured() ? "configured" : "demo",
      stripe: isStripeConfigured() ? "configured" : "demo",
      ai: process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL ? "configured" : "not-connected",
      push: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? "configured" : "not-connected",
      email: process.env.RESEND_API_KEY ? "configured" : "not-connected",
    },
    timestamp: new Date().toISOString(),
  });
}
