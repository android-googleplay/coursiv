import type { SupportTicket } from "./types";
import { normalizeAdminUserSearch } from "./admin-user-search";

export type TicketQueueFilters = {
  query: string;
  status: SupportTicket["status"] | "all";
  priority: NonNullable<SupportTicket["priority"]> | "all";
  assignee: string;
  sla: "all" | "overdue" | "due_4h" | "no_sla";
  sort: "recent" | "oldest" | "sla";
};

export const emptyTicketQueueFilters: TicketQueueFilters = {
  query: "",
  status: "all",
  priority: "all",
  assignee: "all",
  sla: "all",
  sort: "recent",
};

export function buildTicketSearchIndex(ticket: Pick<SupportTicket,"id"|"subject"|"message"|"email"|"userId"|"tags">) {
  const values = [ticket.id,ticket.subject,ticket.email,ticket.userId,...(ticket.tags??[]),ticket.message.slice(0,500)]
    .filter((value):value is string=>typeof value==="string"&&Boolean(value.trim()))
    .flatMap((value)=>{
      const normalized=normalizeAdminUserSearch(value);
      return [normalized,...normalized.split(/[^\p{L}\p{N}]+/u)];
    });
  const prefixes=new Set<string>();
  for(const value of values)for(let length=1;length<=Math.min(value.length,80);length+=1)prefixes.add(value.slice(0,length));
  return {searchPrefixes:[...prefixes]};
}

export function ticketSlaState(ticket:SupportTicket, now=Date.now()) {
  if(!ticket.slaDueAt)return "no_sla" as const;
  const due=new Date(ticket.slaDueAt).getTime();
  if(Number.isNaN(due))return "no_sla" as const;
  if(due<now)return "overdue" as const;
  if(due-now<=4*60*60*1000)return "due_4h" as const;
  return "on_track" as const;
}

export function matchesTicketQueueFilters(ticket:SupportTicket, filters:TicketQueueFilters, now=Date.now()) {
  const query=normalizeAdminUserSearch(filters.query);
  if(filters.status!=="all"&&ticket.status!==filters.status)return false;
  if(filters.priority!=="all"&&(ticket.priority??"normal")!==filters.priority)return false;
  if(filters.assignee==="unassigned"&&ticket.assigneeId)return false;
  if(!["all","unassigned"].includes(filters.assignee)&&ticket.assigneeId!==filters.assignee)return false;
  if(filters.sla!=="all"&&ticketSlaState(ticket,now)!==filters.sla)return false;
  if(query&&!normalizeAdminUserSearch(`${ticket.id} ${ticket.subject??""} ${ticket.email??""} ${ticket.userId} ${ticket.tags?.join(" ")??""} ${ticket.message}`).includes(query))return false;
  return true;
}

export function sortTicketQueue(tickets:SupportTicket[], sort:TicketQueueFilters["sort"]) {
  return [...tickets].sort((a,b)=>{
    if(sort==="oldest")return(a.lastMessageAt??a.updatedAt).localeCompare(b.lastMessageAt??b.updatedAt);
    if(sort==="sla"){
      const aDue=a.slaDueAt?new Date(a.slaDueAt).getTime():Number.POSITIVE_INFINITY;
      const bDue=b.slaDueAt?new Date(b.slaDueAt).getTime():Number.POSITIVE_INFINITY;
      return aDue-bDue||(b.lastMessageAt??b.updatedAt).localeCompare(a.lastMessageAt??a.updatedAt);
    }
    return(b.lastMessageAt??b.updatedAt).localeCompare(a.lastMessageAt??a.updatedAt);
  });
}
