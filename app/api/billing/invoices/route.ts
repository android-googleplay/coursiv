import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { getStripe, isStripeConfigured } from "@/lib/platform/stripe";

export const runtime="nodejs";
export async function GET(request:Request){
  if(!isStripeConfigured()||!isFirebaseAdminConfigured())return NextResponse.json({error:"Billing is not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const subscription=await getAdminDb().collection("subscriptions").doc(user.uid).get();const customer=subscription.data()?.stripeCustomerId;
  if(!customer)return NextResponse.json({invoices:[]}); const invoices=await getStripe().invoices.list({customer,limit:20});
  return NextResponse.json({invoices:invoices.data.map((invoice)=>({number:invoice.number??invoice.id,amount:new Intl.NumberFormat("en",{style:"currency",currency:invoice.currency.toUpperCase()}).format((invoice.amount_paid||invoice.amount_due)/100),status:invoice.status??"unknown",date:new Date(invoice.created*1000).toISOString(),url:invoice.hosted_invoice_url}))});
}
