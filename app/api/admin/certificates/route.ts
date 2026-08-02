import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { demoCertificates } from "@/lib/certificates";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import { sendCertificateEmail } from "@/lib/platform/certificate-email";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import type { IssuedCertificate } from "@/lib/platform/types";

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin","support","analyst"]);if(!actor)return NextResponse.json({error:"Staff access required"},{status:403});
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({certificates:demoCertificates});
  const snapshot=await getAdminDb().collection("certificates").orderBy("issuedAt","desc").limit(500).get();
  return NextResponse.json({certificates:snapshot.docs.map((document)=>({id:document.id,...document.data()}))});
}

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","support"]);if(!actor)return NextResponse.json({error:"Support access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"certificate.resend");if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {certificateId?:string;reason?:string}|null;if(!body?.certificateId||!body.reason?.trim())return NextResponse.json({error:"Certificate and reason are required"},{status:400});
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({status:"sent",debug:true});
  const reference=getAdminDb().collection("certificates").doc(body.certificateId);const snapshot=await reference.get();if(!snapshot.exists)return NextResponse.json({error:"Certificate not found"},{status:404});
  const certificate={id:snapshot.id,...snapshot.data()} as IssuedCertificate;const delivery=await sendCertificateEmail(certificate,process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin);
  await reference.set({emailStatus:delivery.status,emailId:"emailId" in delivery?delivery.emailId??null:null,lastResentAt:new Date().toISOString()},{merge:true});
  await writeAdminAudit(actor,{action:"certificate.email.resend",targetType:"certificate",targetId:certificate.id,request,reason:body.reason,after:delivery});
  return NextResponse.json(delivery);
}
