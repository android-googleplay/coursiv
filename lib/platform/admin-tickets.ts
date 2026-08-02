import "server-only";

import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import sanitizeHtml from "sanitize-html";
import type { StaffActor } from "./admin-auth";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { AdminUserSummary, SupportTicket, TicketMessage } from "./types";
import { refreshAdminUserSummary } from "./admin-user-projection";
import { demoSubscriptions, demoUsers } from "./admin-demo-data";
import { shouldSendTicketEmail } from "./admin-ticket-policy";
import { normalizeAdminUserSearch } from "./admin-user-search";
import {
  buildTicketSearchIndex,
  emptyTicketQueueFilters,
  matchesTicketQueueFilters,
  sortTicketQueue,
  type TicketQueueFilters,
} from "./admin-ticket-search";

export type TicketCustomerContext = Pick<AdminUserSummary,"registeredAt"|"lastActiveAt"|"subscriptionStatus"|"completedLessonCount"|"certificateCount"|"accountStatus">;

const now = new Date().toISOString();
const demoTicket: SupportTicket = { id:"ticket-demo-1",userId:"usr_1",email:"amy@example.com",type:"support",subject:"Lesson progress did not save",message:"I completed the lesson but the progress bar did not update.",status:"open",priority:"high",assigneeId:null,tags:["learning"],createdAt:now,updatedAt:now,lastMessageAt:now,slaDueAt:new Date(Date.now()+4*60*60*1000).toISOString(),notificationStatus:"sent" };
const demoTickets = new Map<string, SupportTicket>([[demoTicket.id,demoTicket]]);
const demoMessages = new Map<string, TicketMessage[]>([[demoTicket.id,[{id:"message-demo-1",ticketId:demoTicket.id,senderType:"user",senderId:"usr_1",senderEmail:demoTicket.email,channel:"app",bodyText:demoTicket.message,internal:false,attachments:[],deliveryStatus:"received",createdAt:now}]]]);

export function supportTicketFromData(id:string,data:Record<string,unknown>):SupportTicket{
  const status=["open","in_progress","waiting_for_user","resolved","closed"].includes(String(data.status))?data.status as SupportTicket["status"]:"open";
  const priority=["low","normal","high","urgent"].includes(String(data.priority))?data.priority as SupportTicket["priority"]:"normal";
  const notificationStatus=["not_configured","sent","failed"].includes(String(data.notificationStatus))?data.notificationStatus as SupportTicket["notificationStatus"]:"not_configured";
  return{
    id,
    userId:String(data.userId??""),
    email:typeof data.email==="string"?data.email:null,
    type:data.type==="feedback"?"feedback":"support",
    message:String(data.message??""),
    status,
    priority,
    assigneeId:typeof data.assigneeId==="string"?data.assigneeId:null,
    tags:Array.isArray(data.tags)?data.tags.filter((item):item is string=>typeof item==="string"):[],
    subject:typeof data.subject==="string"?data.subject:undefined,
    firstResponseAt:typeof data.firstResponseAt==="string"?data.firstResponseAt:null,
    slaDueAt:typeof data.slaDueAt==="string"?data.slaDueAt:null,
    resolvedAt:typeof data.resolvedAt==="string"?data.resolvedAt:null,
    closedAt:typeof data.closedAt==="string"?data.closedAt:null,
    lastMessageAt:typeof data.lastMessageAt==="string"?data.lastMessageAt:undefined,
    expiresAt:typeof data.expiresAt==="string"?data.expiresAt:undefined,
    createdAt:String(data.createdAt??""),
    updatedAt:String(data.updatedAt??data.createdAt??""),
    notificationStatus,
  };
}

export async function listTickets(actor:StaffActor,filters:TicketQueueFilters=emptyTicketQueueFilters){
  if(actor.debug||!isFirebaseAdminConfigured()){
    return sortTicketQueue([...demoTickets.values()].filter((ticket)=>matchesTicketQueueFilters(ticket,filters)),filters.sort);
  }
  const collection=getAdminDb().collection("supportTickets");
  let query;
  const normalizedQuery=normalizeAdminUserSearch(filters.query).slice(0,80);
  if(normalizedQuery)query=collection.where("searchPrefixes","array-contains",normalizedQuery).orderBy("lastMessageAt","desc");
  else if(filters.status!=="all")query=collection.where("status","==",filters.status).orderBy("lastMessageAt","desc");
  else if(filters.priority!=="all")query=collection.where("priority","==",filters.priority).orderBy("lastMessageAt","desc");
  else if(!["all","unassigned"].includes(filters.assignee))query=collection.where("assigneeId","==",filters.assignee).orderBy("lastMessageAt","desc");
  else query=collection.orderBy("lastMessageAt","desc");
  const snapshot=await query.limit(500).get();
  const tickets=snapshot.docs.map((doc)=>supportTicketFromData(doc.id,doc.data()));
  return sortTicketQueue(tickets.filter((ticket)=>matchesTicketQueueFilters(ticket,filters)),filters.sort);
}

export async function ticketStatusCounts(actor:StaffActor){
  const statusValues:SupportTicket["status"][]=["open","in_progress","waiting_for_user","resolved","closed"];
  if(actor.debug||!isFirebaseAdminConfigured()){
    return Object.fromEntries(statusValues.map((status)=>[status,[...demoTickets.values()].filter((ticket)=>ticket.status===status).length]));
  }
  const collection=getAdminDb().collection("supportTickets");
  const snapshots=await Promise.all(statusValues.map((status)=>collection.where("status","==",status).count().get()));
  return Object.fromEntries(statusValues.map((status,index)=>[status,snapshots[index].data().count]));
}

export async function getTicket(actor:StaffActor,id:string){
  if(actor.debug||!isFirebaseAdminConfigured()){
    const ticket=demoTickets.get(id)??null;
    const user=ticket?demoUsers.find((item)=>item.id===ticket.userId):null;
    const subscription=ticket?demoSubscriptions.find((item)=>item.userId===ticket.userId):null;
    const customer:TicketCustomerContext|null=user?{registeredAt:user.createdAt,lastActiveAt:user.lastActiveAt,subscriptionStatus:subscription?.status??"none",completedLessonCount:user.id==="usr_1"?18:0,certificateCount:0,accountStatus:"active"}:null;
    return{ticket,messages:demoMessages.get(id)??[],customer};
  }
  const database=getAdminDb();
  const ticket=await database.collection("supportTickets").doc(id).get();
  if(!ticket.exists)return{ticket:null,messages:[],customer:null};
  const ticketData=supportTicketFromData(ticket.id,ticket.data()??{});
  const [messages,customer]=await Promise.all([
    ticket.ref.collection("messages").orderBy("createdAt").limit(500).get(),
    database.collection("adminUserSummaries").doc(ticketData.userId).get(),
  ]);
  const customerData=customer.data()??{};
  const customerContext:TicketCustomerContext|null=customer.exists?{
    registeredAt:String(customerData.registeredAt??""),
    lastActiveAt:String(customerData.lastActiveAt??""),
    subscriptionStatus:["none","trialing","active","past_due","canceled","unpaid"].includes(String(customerData.subscriptionStatus))?customerData.subscriptionStatus:"none",
    completedLessonCount:Number(customerData.completedLessonCount??0),
    certificateCount:Number(customerData.certificateCount??0),
    accountStatus:["active","suspended","deleted"].includes(String(customerData.accountStatus))?customerData.accountStatus:"active",
  } as TicketCustomerContext:null;
  return{ticket:ticketData,messages:messages.docs.map((doc)=>doc.data() as TicketMessage),customer:customerContext};
}

export async function updateTicket(actor:StaffActor,id:string,patch:Partial<SupportTicket>){
  const allowed:Partial<SupportTicket>={};for(const key of ["status","priority","assigneeId","tags"] as const)if(patch[key]!==undefined)Object.assign(allowed,{[key]:patch[key]});
  const updatedAt=new Date().toISOString();if(allowed.status==="resolved")allowed.resolvedAt=updatedAt;if(allowed.status==="closed")allowed.closedAt=updatedAt;
  if(actor.debug||!isFirebaseAdminConfigured()){const current=demoTickets.get(id);if(!current)return null;const next={...current,...allowed,updatedAt};demoTickets.set(id,next);return next}
  const current=(await getTicket(actor,id)).ticket;if(!current)return null;
  const next={...current,...allowed,updatedAt};
  await getAdminDb().collection("supportTickets").doc(id).set({...allowed,...buildTicketSearchIndex(next),updatedAt,updatedBy:actor.uid},{merge:true});
  const ticket=(await getTicket(actor,id)).ticket;
  if(ticket)await refreshAdminUserSummary(ticket.userId);
  return ticket;
}

export async function addTicketMessage(actor:StaffActor,id:string,input:{bodyText:string;internal?:boolean}){
  const bodyText=input.bodyText.trim();if(!bodyText||bodyText.length>10_000)throw new Error("Message must be between 1 and 10,000 characters");
  const detail=await getTicket(actor,id);if(!detail.ticket)throw new Error("Ticket not found");
  const createdAt=new Date().toISOString();const message:TicketMessage={id:randomUUID(),ticketId:id,senderType:"staff",senderId:actor.uid,senderEmail:actor.email,channel:input.internal?"internal":"app",bodyText,internal:Boolean(input.internal),attachments:[],deliveryStatus:input.internal?"sent":"queued",createdAt};
  if(shouldSendTicketEmail({debug:actor.debug,firebaseConfigured:isFirebaseAdminConfigured(),internal:Boolean(input.internal),apiKey:process.env.RESEND_API_KEY,fromEmail:process.env.SUPPORT_FROM_EMAIL,recipientEmail:detail.ticket.email})){
    const resend=new Resend(process.env.RESEND_API_KEY!);const result=await resend.emails.send({from:process.env.SUPPORT_FROM_EMAIL!,to:detail.ticket.email!,replyTo:process.env.SUPPORT_REPLY_TO_EMAIL??process.env.SUPPORT_FROM_EMAIL!,subject:`[Ticket ${id}] ${detail.ticket.subject??"Coursiv support"}`,text:bodyText,headers:{"X-Coursiv-Ticket":id}});
    message.providerMessageId=result.data?.id;message.deliveryStatus=result.error?"failed":"sent";message.channel="email";
  }
  if(actor.debug||!isFirebaseAdminConfigured()){demoMessages.set(id,[...(demoMessages.get(id)??[]),message]);demoTickets.set(id,{...detail.ticket,status:input.internal?detail.ticket.status:"waiting_for_user",updatedAt:createdAt,lastMessageAt:createdAt,firstResponseAt:detail.ticket.firstResponseAt??createdAt});return message}
  const database=getAdminDb();const ticketRef=database.collection("supportTickets").doc(id);const batch=database.batch();batch.create(ticketRef.collection("messages").doc(message.id),message);batch.set(ticketRef,{status:input.internal?detail.ticket.status:"waiting_for_user",updatedAt:createdAt,lastMessageAt:createdAt,firstResponseAt:detail.ticket.firstResponseAt??createdAt},{merge:true});await batch.commit();await refreshAdminUserSummary(detail.ticket.userId);return message;
}

export function cleanInboundHtml(value:string){return sanitizeHtml(value,{allowedTags:["p","br","strong","em","ul","ol","li","a","blockquote"],allowedAttributes:{a:["href"]},allowedSchemes:["http","https","mailto"]})}
export function cleanInboundText(value:string){return value.split(/\n(?:On .+wrote:|-----Original Message-----)/i)[0].split("\n").filter((line)=>!line.trimStart().startsWith(">")).join("\n").trim().slice(0,10_000)}
