import { NextResponse } from "next/server";
import { getAdminDb, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { getCertificateRecord } from "@/lib/platform/certificate-store";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{certificateId:string}>}){const {certificateId}=await params;const certificate=await getCertificateRecord(certificateId);if(!certificate)return NextResponse.json({error:"Certificate not found"},{status:404});if(certificate.visibility!=="public"){const user=await verifyBearerToken(request);if(!user||(user.uid!==certificate.userId&&user.admin!==true))return NextResponse.json({error:"Certificate not found"},{status:404});}return NextResponse.json({certificate})}

export async function PATCH(request:Request,{params}:{params:Promise<{certificateId:string}>}){
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const {certificateId}=await params;const body=await request.json().catch(()=>null) as {learnerName?:string}|null;const learnerName=body?.learnerName?.trim();
  if(!learnerName||learnerName.length<2||learnerName.length>80)return NextResponse.json({error:"Name must be between 2 and 80 characters"},{status:400});
  const reference=getAdminDb().collection("certificates").doc(certificateId);const snapshot=await reference.get();
  if(!snapshot.exists||snapshot.data()?.userId!==user.uid)return NextResponse.json({error:"Certificate not found"},{status:404});
  await reference.set({learnerName},{merge:true});return NextResponse.json({certificate:{...snapshot.data(),learnerName}});
}
