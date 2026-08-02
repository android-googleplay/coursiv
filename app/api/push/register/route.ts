import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";

function tokenDocumentId(token:string){return token.slice(-32);}

export async function POST(request:Request){
  if(!isFirebaseAdminConfigured())return NextResponse.json({error:"Push notifications are not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json().catch(()=>null) as {token?:string}|null;if(!body?.token)return NextResponse.json({error:"Token required"},{status:400});
  await getAdminDb().collection("pushTokens").doc(user.uid).collection("tokens").doc(tokenDocumentId(body.token)).set({token:body.token,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:true});
  return NextResponse.json({ok:true});
}

export async function DELETE(request:Request){
  if(!isFirebaseAdminConfigured())return NextResponse.json({error:"Push notifications are not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json().catch(()=>null) as {token?:string}|null;if(!body?.token)return NextResponse.json({error:"Token required"},{status:400});
  await getAdminDb().collection("pushTokens").doc(user.uid).collection("tokens").doc(tokenDocumentId(body.token)).delete();
  return NextResponse.json({ok:true});
}
