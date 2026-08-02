import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { demoSubscriptions, demoUsers } from "@/lib/platform/admin-demo-data";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import type { SubscriptionRecord } from "@/lib/platform/types";

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin","support","analyst"]);if(!actor)return NextResponse.json({error:"Staff access required"},{status:403});
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({subscriptions:demoSubscriptions.map((item)=>({...item,email:demoUsers.find((user)=>user.id===item.userId)?.email??""}))});
  const database=getAdminDb();const snapshot=await database.collection("subscriptions").orderBy("updatedAt","desc").limit(500).get();
  const subscriptions=snapshot.docs.map((document)=>({id:document.id,...document.data()}) as SubscriptionRecord);
  const summaries=subscriptions.length?await database.getAll(...subscriptions.map((item)=>database.collection("adminUserSummaries").doc(item.userId))):[];
  const emails=new Map(summaries.map((document)=>[document.id,String(document.data()?.email??"")]));
  return NextResponse.json({subscriptions:subscriptions.map((item)=>({...item,email:emails.get(item.userId)??""}))});
}
