import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import type { SupportTicket, TicketMessage } from "@/lib/platform/types";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";
import { buildTicketSearchIndex } from "@/lib/platform/admin-ticket-search";
import { supportTicketFromData } from "@/lib/platform/admin-tickets";

export const runtime="nodejs";

export async function GET(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Support is not configured. Add Firebase Admin credentials." }, { status: 503 });
  const user = await verifyBearerToken(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const snapshot = await getAdminDb().collection("supportTickets").where("userId", "==", user.uid).limit(50).get();
  const tickets = snapshot.docs
    .map((document) => supportTicketFromData(document.id, document.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ tickets });
}

export async function POST(request:Request){
  if(!isFirebaseAdminConfigured()) return NextResponse.json({error:"Support is not configured. Add Firebase Admin credentials."},{status:503});
  const user=await verifyBearerToken(request); if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json().catch(()=>null) as {message?:string;type?:string}|null; const message=body?.message?.trim();
  if(!message||message.length<10||message.length>5000)return NextResponse.json({error:"Message must be between 10 and 5,000 characters"},{status:400});
  const reference=getAdminDb().collection("supportTickets").doc();
  const now = new Date().toISOString();
  const ticket: SupportTicket = { id:reference.id,userId:user.uid,email:user.email??null,type:body?.type==="feedback"?"feedback":"support",subject:body?.type==="feedback"?"Product feedback":"Support request",message,status:"open",priority:"normal",assigneeId:null,tags:[],createdAt:now,updatedAt:now,lastMessageAt:now,slaDueAt:new Date(Date.now()+24*60*60*1000).toISOString(),notificationStatus:"not_configured" };
  const firstMessage:TicketMessage={id:`${reference.id}-initial`,ticketId:reference.id,senderType:"user",senderId:user.uid,senderEmail:user.email??null,channel:"app",bodyText:message,internal:false,attachments:[],deliveryStatus:"received",createdAt:now};
  const database=getAdminDb();const batch=database.batch();batch.set(reference,{...ticket,...buildTicketSearchIndex(ticket)});batch.set(reference.collection("messages").doc(firstMessage.id),firstMessage);await batch.commit();
  await refreshAdminUserSummary(user.uid);
  if(process.env.RESEND_API_KEY&&process.env.SUPPORT_FROM_EMAIL&&process.env.SUPPORT_TO_EMAIL){
    try {
      const resend=new Resend(process.env.RESEND_API_KEY);
      const result=await resend.emails.send({from:process.env.SUPPORT_FROM_EMAIL,to:process.env.SUPPORT_TO_EMAIL,subject:`Coursiv ${ticket.type} — ${reference.id}`,text:`From: ${user.email??user.uid}\n\n${message}`});
      ticket.notificationStatus=result.error?"failed":"sent";
    } catch { ticket.notificationStatus="failed"; }
    await reference.set({notificationStatus:ticket.notificationStatus,updatedAt:new Date().toISOString()},{merge:true});
  }
  return NextResponse.json({ticket},{status:201});
}
