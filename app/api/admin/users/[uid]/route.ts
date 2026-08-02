import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminUserDetail } from "@/lib/platform/admin-users";
import { writeAdminAudit } from "@/lib/platform/admin-audit";

export async function GET(request:Request,{params}:{params:Promise<{uid:string}>}){
  const actor=await requireStaff(request,["admin","support","analyst"]);if(!actor)return NextResponse.json({error:"Staff access required"},{status:403});
  const uid=(await params).uid;const detail=await getAdminUserDetail(actor,uid);
  await writeAdminAudit(actor,{action:"user.detail.read",targetType:"user",targetId:uid,request});
  if(actor.role==="analyst"){detail.summary={...detail.summary,email:detail.summary.email.replace(/^(.).+(@.+)$/,"$1***$2"),displayName:`Member ${uid.slice(-6)}`};detail.subscription=detail.subscription?{...detail.subscription,stripeCustomerId:"masked",stripeSubscriptionId:"masked"}:null;detail.tickets=detail.tickets.map((ticket)=>({...ticket,email:null,message:"[redacted]"}));detail.meta={tags:detail.meta.tags??[],internalNotes:[]};}
  return NextResponse.json(detail);
}
