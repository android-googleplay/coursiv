import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";
import type { SupportTicket, TicketMessage } from "@/lib/platform/types";
import { buildTicketSearchIndex } from "@/lib/platform/admin-ticket-search";

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin","support","analyst"]);if(!actor)return NextResponse.json({error:"Staff access required"},{status:403});
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({messages:[]});
  const snapshot=await getAdminDb().collection("unmatchedInbound").where("status","==","unmatched").limit(100).get();
  return NextResponse.json({messages:snapshot.docs.map((document)=>({id:document.id,...document.data()}))});
}

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","support"]);if(!actor)return NextResponse.json({error:"Support access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"ticket.unmatched.resolve");if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {messageId?:string;ticketId?:string;userId?:string}|null;if(!body?.messageId)return NextResponse.json({error:"Message ID is required"},{status:400});
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({ok:true,debug:true});
  const database=getAdminDb();const sourceRef=database.collection("unmatchedInbound").doc(body.messageId);const source=await sourceRef.get();if(!source.exists||source.data()?.status!=="unmatched")return NextResponse.json({error:"Unmatched message not found"},{status:404});
  const data=source.data() as TicketMessage&{subject?:string};const now=new Date().toISOString();const ticketId=body.ticketId?.trim()||randomUUID();const ticketRef=database.collection("supportTickets").doc(ticketId);const existing=await ticketRef.get();
  if(body.ticketId&&!existing.exists)return NextResponse.json({error:"Target ticket not found"},{status:404});
  const ticket:SupportTicket=existing.exists?{id:existing.id,...existing.data()} as SupportTicket:{id:ticketId,userId:body.userId?.trim()||"email-only",email:data.senderEmail??null,type:"support",subject:data.subject??"Email support request",message:data.bodyText,status:"open",priority:"normal",assigneeId:actor.uid,tags:["email"],createdAt:now,updatedAt:now,lastMessageAt:data.createdAt,slaDueAt:new Date(Date.now()+24*60*60*1000).toISOString(),notificationStatus:"not_configured"};
  const message={...data,ticketId};const batch=database.batch();if(!existing.exists)batch.create(ticketRef,{...ticket,...buildTicketSearchIndex(ticket)});batch.create(ticketRef.collection("messages").doc(data.id),message);batch.set(ticketRef,{updatedAt:now,lastMessageAt:data.createdAt},{merge:true});batch.set(sourceRef,{status:"matched",matchedTicketId:ticketId,matchedAt:now,matchedBy:actor.uid},{merge:true});await batch.commit();
  await writeAdminAudit(actor,{action:existing.exists?"ticket.unmatched.merge":"ticket.unmatched.create",targetType:"ticket",targetId:ticketId,request,after:{messageId:data.id}});
  if(ticket.userId!=="email-only")await refreshAdminUserSummary(ticket.userId);
  return NextResponse.json({ticketId});
}
