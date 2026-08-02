import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { getStripe, isStripeConfigured } from "@/lib/platform/stripe";

export const runtime="nodejs";
export async function POST(request:Request){
  if(!isStripeConfigured()||!isFirebaseAdminConfigured())return NextResponse.json({error:"Billing is not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const subscription=await getAdminDb().collection("subscriptions").doc(user.uid).get();const customer=subscription.data()?.stripeCustomerId;
  if(!customer)return NextResponse.json({error:"No billing account was found"},{status:404});
  const origin=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;const session=await getStripe().billingPortal.sessions.create({customer,return_url:`${origin}/profile/settings`});
  return NextResponse.json({url:session.url});
}
