import { NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { cleanInboundHtml, cleanInboundText } from "@/lib/platform/admin-tickets";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import type { TicketMessage } from "@/lib/platform/types";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";

export const runtime="nodejs";

export async function POST(request:Request){
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_WEBHOOK_SECRET||!isFirebaseAdminConfigured())return NextResponse.json({error:"Resend inbound is not configured"},{status:503});
  const payload=await request.text();const resend=new Resend(process.env.RESEND_API_KEY);let event;
  try{event=resend.webhooks.verify({payload,headers:{id:request.headers.get("svix-id")??"",timestamp:request.headers.get("svix-timestamp")??"",signature:request.headers.get("svix-signature")??""},webhookSecret:process.env.RESEND_WEBHOOK_SECRET})}catch{return NextResponse.json({error:"Invalid webhook signature"},{status:400})}
  const eventId=request.headers.get("svix-id")??"";const database=getAdminDb();const eventRef=database.collection("webhookEvents").doc(eventId);
  if((await eventRef.get()).exists)return NextResponse.json({received:true,duplicate:true});
  await eventRef.create({id:eventId,type:event.type,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+90*86_400_000)});
  if(event.type!=="email.received"){
    const deliveryType=String(event.type);const providerId=String((event.data as {email_id?:string}).email_id??"");
    if(providerId&&["email.delivered","email.bounced","email.delivery_delayed"].includes(deliveryType)){
      const messages=await database.collectionGroup("messages").where("providerMessageId","==",providerId).limit(5).get();
      const status=deliveryType==="email.delivered"?"delivered":deliveryType==="email.bounced"?"bounced":"queued";const batch=database.batch();for(const document of messages.docs)batch.set(document.ref,{deliveryStatus:status,deliveryEventAt:new Date().toISOString()},{merge:true});batch.set(eventRef,{providerMessageId:providerId,matchedMessages:messages.size},{merge:true});await batch.commit();
    }
    return NextResponse.json({received:true});
  }
  const received=await resend.emails.receiving.get(event.data.email_id);if(received.error||!received.data)return NextResponse.json({error:"Unable to retrieve inbound email"},{status:502});
  const headerTicket=received.data.headers?.["x-coursiv-ticket"]??"";const subjectMatch=received.data.subject.match(/\[Ticket ([^\]]+)\]/i);const ticketId=headerTicket||subjectMatch?.[1]||"";
  const ticketRef=ticketId?database.collection("supportTickets").doc(ticketId):null;const ticket=ticketRef?await ticketRef.get():null;
  const bodyText=cleanInboundText(received.data.text??received.data.html?.replace(/<[^>]+>/g," ")??"");const bodyHtml=cleanInboundHtml(received.data.html??"");
  const attachments=received.data.attachments.filter((item)=>Number(item.size??0)<=10*1024*1024).map((item)=>({id:item.id,filename:item.filename??"attachment",contentType:item.content_type,size:item.size}));
  const message:TicketMessage={id:randomUUID(),ticketId:ticketId||"unmatched",senderType:"email",senderEmail:received.data.from,channel:"email",bodyText,bodyHtml,internal:false,attachments,providerMessageId:received.data.message_id,deliveryStatus:"received",createdAt:received.data.created_at};
  if(ticket?.exists&&ticketRef){const batch=database.batch();batch.create(ticketRef.collection("messages").doc(message.id),message);batch.set(ticketRef,{status:"in_progress",updatedAt:new Date().toISOString(),lastMessageAt:message.createdAt},{merge:true});batch.set(eventRef,{ticketId,messageId:message.id},{merge:true});await batch.commit();const uid=String(ticket.data()?.userId??"");if(uid)await refreshAdminUserSummary(uid)}else await database.collection("unmatchedInbound").doc(message.id).set({...message,subject:received.data.subject,to:received.data.to,status:"unmatched"});
  return NextResponse.json({received:true,ticketId:ticketId||null});
}
