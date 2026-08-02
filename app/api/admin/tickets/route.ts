import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { listTickets, ticketStatusCounts } from "@/lib/platform/admin-tickets";
import type { TicketQueueFilters } from "@/lib/platform/admin-ticket-search";
import type { SupportTicket } from "@/lib/platform/types";

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin","support","analyst"]);
  if(!actor)return NextResponse.json({error:"Staff access required"},{status:403});
  const params=new URL(request.url).searchParams;
  const statuses=["open","in_progress","waiting_for_user","resolved","closed"] as const;
  const priorities=["low","normal","high","urgent"] as const;
  const slaValues=["all","overdue","due_4h","no_sla"] as const;
  const sortValues=["recent","oldest","sla"] as const;
  const statusValue=params.get("status")??"all";
  const priorityValue=params.get("priority")??"all";
  const slaValue=params.get("sla")??"all";
  const sortValue=params.get("sort")??"recent";
  const filters:TicketQueueFilters={
    query:(params.get("q")??"").trim().slice(0,80),
    status:statuses.includes(statusValue as SupportTicket["status"])?statusValue as SupportTicket["status"]:"all",
    priority:priorities.includes(priorityValue as NonNullable<SupportTicket["priority"]>)?priorityValue as NonNullable<SupportTicket["priority"]>:"all",
    assignee:(params.get("assignee")??"all").trim().slice(0,128)||"all",
    sla:slaValues.includes(slaValue as TicketQueueFilters["sla"])?slaValue as TicketQueueFilters["sla"]:"all",
    sort:sortValues.includes(sortValue as TicketQueueFilters["sort"])?sortValue as TicketQueueFilters["sort"]:"recent",
  };
  const [rawTickets,counts]=await Promise.all([listTickets(actor,filters),ticketStatusCounts(actor)]);
  const tickets=actor.role==="analyst"?rawTickets.map((ticket)=>({...ticket,email:ticket.email?.replace(/^(.).+(@.+)$/,"$1***$2")??null,message:"[redacted]",subject:ticket.type==="feedback"?"Product feedback":"Support request"})):rawTickets;
  return NextResponse.json({tickets,counts});
}
