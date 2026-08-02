"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Clock,
  CreditCard,
  Inbox,
  Mail,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  StickyNote,
  UserRound,
  X,
} from "lucide-react";
import { AdminShell } from "./admin-pages";
import { AdminActionModal, type AdminActionDialog } from "./admin-action-modal";
import type { SupportTicket, TicketMessage } from "@/lib/platform/types";
import type { TicketCustomerContext } from "@/lib/platform/admin-tickets";
import { ticketSlaState, type TicketQueueFilters } from "@/lib/platform/admin-ticket-search";

const statuses=["open","in_progress","waiting_for_user","resolved","closed"] as const;
const priorities=["low","normal","high","urgent"] as const;
type UnmatchedMessage={id:string;subject?:string;senderEmail?:string;bodyText:string};

function slaLabel(ticket:SupportTicket){
  const state=ticketSlaState(ticket);
  if(state==="overdue")return"Overdue";
  if(state==="due_4h")return"Due soon";
  if(state==="on_track")return"On track";
  return"No SLA";
}

export function TicketCmsPage(){
  const [tickets,setTickets]=useState<SupportTicket[]>([]);
  const [unmatched,setUnmatched]=useState<UnmatchedMessage[]>([]);
  const [statusFilter,setStatusFilter]=useState("");
  const [query,setQuery]=useState("");
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [priorityFilter,setPriorityFilter]=useState<TicketQueueFilters["priority"]>("all");
  const [assigneeFilter,setAssigneeFilter]=useState("all");
  const [slaFilter,setSlaFilter]=useState<TicketQueueFilters["sla"]>("all");
  const [sort,setSort]=useState<TicketQueueFilters["sort"]>("recent");
  const [showUnmatched,setShowUnmatched]=useState(false);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<string|null>(null);
  const [ticket,setTicket]=useState<SupportTicket|null>(null);
  const [customer,setCustomer]=useState<TicketCustomerContext|null>(null);
  const [messages,setMessages]=useState<TicketMessage[]>([]);
  const [reply,setReply]=useState("");
  const [internal,setInternal]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [actionDialog,setActionDialog]=useState<AdminActionDialog|null>(null);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [assignees,setAssignees]=useState<Array<{id:string;displayName:string;email:string;role:string}>>([]);
  const composerDrafts=useRef(new Map<string,{reply:string;internal:boolean}>());
  const queueAbort=useRef<AbortController|null>(null);
  const queueRequest=useRef(0);

  useEffect(()=>{
    const timer=window.setTimeout(()=>setDebouncedQuery(query.trim()),250);
    return()=>window.clearTimeout(timer);
  },[query]);

  const load=useCallback(async()=>{
    queueAbort.current?.abort();
    const controller=new AbortController();
    queueAbort.current=controller;
    const requestId=++queueRequest.current;
    const params=new URLSearchParams();
    if(statusFilter)params.set("status",statusFilter);
    if(debouncedQuery)params.set("q",debouncedQuery);
    if(priorityFilter!=="all")params.set("priority",priorityFilter);
    if(assigneeFilter!=="all")params.set("assignee",assigneeFilter);
    if(slaFilter!=="all")params.set("sla",slaFilter);
    if(sort!=="recent")params.set("sort",sort);
    setLoading(true);
    try{
      const response=await fetch(`/api/admin/tickets${params.size?`?${params}`:""}`,{signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Ticket queue could not be loaded");
      if(requestId!==queueRequest.current)return;
      setTickets(data.tickets??[]);
      setCounts(data.counts??{});
    }catch(error){
      if((error as Error).name!=="AbortError"&&requestId===queueRequest.current)setStatus(error instanceof Error?error.message:"Ticket queue could not be loaded");
    }finally{
      if(requestId===queueRequest.current)setLoading(false);
    }
  },[assigneeFilter,debouncedQuery,priorityFilter,slaFilter,sort,statusFilter]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>void load(),0);
    return()=>{window.clearTimeout(timer);queueAbort.current?.abort()};
  },[load]);
  useEffect(()=>{fetch("/api/admin/tickets/unmatched").then((response)=>response.json()).then((data)=>setUnmatched(data.messages??[])).catch(()=>undefined)},[]);
  useEffect(()=>{fetch("/api/admin/tickets/assignees").then((response)=>response.json()).then((data)=>setAssignees(data.assignees??[])).catch(()=>undefined)},[]);
  useEffect(()=>{
    if(!selected)return;
    let active=true;
    fetch(`/api/admin/tickets/${encodeURIComponent(selected)}`).then((response)=>response.json()).then((data)=>{
      if(!active)return;
      setTicket(data.ticket??null);setCustomer(data.customer??null);setMessages(data.messages??[]);
      if(data.error)setStatus(data.error);
    }).catch(()=>{if(active)setStatus("Unable to load this ticket.")});
    return()=>{active=false};
  },[selected]);

  const totalOpen=useMemo(()=>statuses.slice(0,3).reduce((sum,item)=>sum+(counts[item]??0),0),[counts]);
  const hasQueueFilters=Boolean(query||statusFilter||priorityFilter!=="all"||assigneeFilter!=="all"||slaFilter!=="all"||sort!=="recent");
  const clearQueueFilters=()=>{
    setQuery("");setDebouncedQuery("");setStatusFilter("");setPriorityFilter("all");setAssigneeFilter("all");setSlaFilter("all");setSort("recent");
  };
  const openTicket=(id:string)=>{
    if(selected)composerDrafts.current.set(selected,{reply,internal});
    const draft=composerDrafts.current.get(id);
    setTicket(null);setCustomer(null);setMessages([]);setReply(draft?.reply??"");setInternal(draft?.internal??false);setStatus("");setSelected(id);
  };
  const closeTicket=()=>{
    if(selected)composerDrafts.current.set(selected,{reply,internal});
    setSelected(null);setTicket(null);setCustomer(null);setMessages([]);setStatus("");
  };
  const patch=async(values:Partial<SupportTicket>)=>{
    if(!selected||busy)return;
    setBusy(true);setStatus("");
    try{
      const response=await fetch(`/api/admin/tickets/${encodeURIComponent(selected)}`,{method:"PATCH",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify(values)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Ticket could not be updated");
      setTicket(data.ticket);await load();setStatus("Ticket updated");
    }catch(error){setStatus(error instanceof Error?error.message:"Ticket could not be updated")}
    finally{setBusy(false)}
  };
  const send=async()=>{
    if(!selected||!reply.trim()||busy)return;
    setBusy(true);setStatus("");
    try{
      const response=await fetch(`/api/admin/tickets/${encodeURIComponent(selected)}/messages`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({bodyText:reply,internal})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Message could not be sent");
      setMessages((current)=>[...current,data.message]);
      setTicket((current)=>current?{...current,status:internal?current.status:"waiting_for_user",lastMessageAt:data.message.createdAt,updatedAt:data.message.createdAt,firstResponseAt:current.firstResponseAt??data.message.createdAt}:current);
      composerDrafts.current.delete(selected);setReply("");setStatus(internal?"Private note saved":"Reply sent to the user");await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Message could not be sent")}
    finally{setBusy(false)}
  };
  const resolveUnmatched=async(item:{id:string},ticketId="")=>{
    const response=await fetch("/api/admin/tickets/unmatched",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({messageId:item.id,ticketId})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error??"Inbound email could not be matched");
    setUnmatched((current)=>current.filter((message)=>message.id!==item.id));setStatus(`Email matched to ${data.ticketId??"ticket"}`);await load();
  };
  const requestMerge=(item:{id:string;subject?:string})=>setActionDialog({
    key:`merge:${item.id}`,
    title:"Merge email into an existing ticket",
    description:`The inbound email${item.subject?` “${item.subject}”`:""} will be added to the selected conversation.`,
    confirmLabel:"Merge into ticket",
    fields:[{name:"ticketId",label:"Existing ticket ID",placeholder:"Paste the ticket ID",required:true}],
    onConfirm:({ticketId})=>resolveUnmatched(item,ticketId),
  });

  return <AdminShell title="Support Tickets" subtitle="App and email conversations, assignment, priority and SLA">
    <div className="ticket-summary" aria-label={`${totalOpen} active tickets`}>
      {statuses.map((item)=><button className={statusFilter===item?"active":""} onClick={()=>setStatusFilter(statusFilter===item?"":item)} key={item}><span>{item.replaceAll("_"," ")}</span><b>{counts[item]??0}</b></button>)}
      <button className={showUnmatched?"active":""} aria-expanded={showUnmatched} onClick={()=>setShowUnmatched((current)=>!current)}><span>unmatched email</span><b>{unmatched.length}</b></button>
    </div>

    <section className="ticket-filter-panel" aria-label="Filter ticket queue">
      <label className="ticket-search"><Search/><input maxLength={80} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search subject, email, user or ticket ID" aria-label="Search tickets"/></label>
      <div className="ticket-filter-row">
        <span><SlidersHorizontal/>Queue filters</span>
        <label>Priority<select value={priorityFilter} onChange={(event)=>setPriorityFilter(event.target.value as TicketQueueFilters["priority"])}><option value="all">All priorities</option>{priorities.map((item)=><option value={item} key={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></label>
        <label>Assignee<select value={assigneeFilter} onChange={(event)=>setAssigneeFilter(event.target.value)}><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{assignees.map((item)=><option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label>
        <label>SLA<select value={slaFilter} onChange={(event)=>setSlaFilter(event.target.value as TicketQueueFilters["sla"])}><option value="all">Any SLA</option><option value="overdue">Overdue</option><option value="due_4h">Due within 4 hours</option><option value="no_sla">No SLA</option></select></label>
        <label>Sort<select value={sort} onChange={(event)=>setSort(event.target.value as TicketQueueFilters["sort"])}><option value="recent">Newest activity</option><option value="oldest">Oldest activity</option><option value="sla">SLA deadline</option></select></label>
        <button className="ticket-clear-filters" disabled={!hasQueueFilters} onClick={clearQueueFilters}><RotateCcw/>Clear</button>
      </div>
      <p className="ticket-filter-meta" aria-live="polite">{loading?"Updating queue…":`${tickets.length.toLocaleString()} matching ticket${tickets.length===1?"":"s"}`}{hasQueueFilters&&" · Filters applied"}</p>
    </section>

    {showUnmatched&&<section className="admin-panel ticket-unmatched-panel">
      <div className="admin-panel-title"><div><h2>Unmatched Inbox</h2><p>Create a ticket or merge an inbound email into an existing thread.</p></div><button onClick={()=>setShowUnmatched(false)} aria-label="Close unmatched inbox"><X/></button></div>
      {unmatched.length?<div className="crm-list">{unmatched.map((item)=><article key={item.id}><Mail/><span><strong>{item.subject??"Inbound email"}</strong><small>{item.senderEmail}<br/>{item.bodyText.slice(0,140)}</small></span><button onClick={()=>void resolveUnmatched(item).catch((error)=>setStatus(error instanceof Error?error.message:"Unable to create ticket"))}>Create ticket</button><button onClick={()=>requestMerge(item)}>Merge</button></article>)}</div>:<div className="ticket-unmatched-empty"><Inbox/><strong>No unmatched email</strong><small>New replies that cannot be linked to a ticket will appear here.</small></div>}
    </section>}

    <div className="ticket-workspace">
      <section className="ticket-queue" aria-busy={loading}>
        {tickets.length?tickets.map((item)=>{
          const sla=ticketSlaState(item);
          const assignee=assignees.find((person)=>person.id===item.assigneeId);
          return <button className={selected===item.id?"active":""} onClick={()=>openTicket(item.id)} key={item.id}>
            <i className={`priority ${item.priority??"normal"}`}/>
            <span>
              <strong>{item.subject??item.type}</strong>
              <small>{item.email??item.userId}</small>
              <p>{item.message}</p>
              <span className="ticket-card-chips"><em className={`ticket-sla ${sla}`} title={item.slaDueAt?`SLA due ${new Date(item.slaDueAt).toLocaleString()}`:"No SLA deadline"}>{slaLabel(item)}</em><em>{assignee?.displayName??(item.assigneeId?"Assigned":"Unassigned")}</em></span>
              <em><Clock/>{new Date(item.lastMessageAt??item.updatedAt).toLocaleString()}</em>
            </span>
            <b>{item.status.replaceAll("_"," ")}</b>
          </button>;
        }):<div className="cms-empty ticket-queue-empty"><Inbox/><h2>{hasQueueFilters?"No matching tickets":"Queue is clear"}</h2><p>{hasQueueFilters?"Try removing one or more filters.":"There are no tickets waiting in this queue."}</p>{hasQueueFilters&&<button onClick={clearQueueFilters}>Clear all filters</button>}</div>}
      </section>

      <main className="ticket-thread">{!ticket?<div className="cms-empty"><MessageCircle/><h2>{selected?"Loading ticket…":"Select a ticket"}</h2><p>{selected?"Retrieving the conversation and customer context.":"Open a conversation to reply, add notes or assign it."}</p></div>:<>
        <header><div><small>TICKET {ticket.id}</small><h2>{ticket.subject??ticket.type}</h2><p><UserRound/>{ticket.email??ticket.userId}</p></div><label>Status<select value={ticket.status} disabled={busy} onChange={(event)=>void patch({status:event.target.value as SupportTicket["status"]})}>{statuses.map((item)=><option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}</select></label><label>Priority<select value={ticket.priority??"normal"} disabled={busy} onChange={(event)=>void patch({priority:event.target.value as SupportTicket["priority"]})}>{priorities.map((item)=><option key={item}>{item}</option>)}</select></label><label>Assignee<select value={ticket.assigneeId??""} disabled={busy} onChange={(event)=>void patch({assigneeId:event.target.value||null})}><option value="">Unassigned</option>{ticket.assigneeId&&!assignees.some((item)=>item.id===ticket.assigneeId)&&<option value={ticket.assigneeId}>Current staff member</option>}{assignees.map((item)=><option value={item.id} key={item.id}>{item.displayName} · {item.role}</option>)}</select></label></header>
        <section className="ticket-messages">{messages.map((message)=><article className={`${message.senderType} ${message.internal?"internal":""}`} key={message.id}><div><strong>{message.internal?"Internal note":message.senderType==="staff"?"Coursiv support":message.senderEmail??"Member"}</strong><small>{new Date(message.createdAt).toLocaleString()} · {message.channel}{message.deliveryStatus?` · ${message.deliveryStatus}`:""}</small></div><p>{message.bodyText}</p>{message.attachments.length>0&&<small>{message.attachments.length} attachment(s)</small>}</article>)}</section>
        <footer className={internal?"internal-mode":""}><div><button aria-pressed={!internal} className={!internal?"active":""} onClick={()=>setInternal(false)}><Mail/>Reply to user</button><button aria-pressed={internal} className={internal?"active":""} onClick={()=>setInternal(true)}><StickyNote/>Private note</button></div>{internal&&<p className="ticket-internal-warning"><AlertTriangle/>Private mode: only staff can see this note. Nothing will be emailed.</p>}<textarea maxLength={10000} placeholder={internal?"Add context for teammates — users cannot see this":"Write a reply — it will appear in the app and email"} value={reply} onChange={(event)=>setReply(event.target.value)}/><small className="ticket-character-count">{reply.length.toLocaleString()} / 10,000</small><button disabled={busy||!reply.trim()} onClick={()=>void send()}><Send/>{busy?"Working…":internal?"Save private note":"Send reply"}</button>{status&&<p role="status">{status}</p>}</footer>
      </>}</main>

      <aside className="ticket-context">{ticket?<><button onClick={closeTicket} aria-label="Close ticket"><X/></button><h3>Customer context</h3><div className="ticket-customer-metrics"><span><CreditCard/><b>{customer?.subscriptionStatus?.replaceAll("_"," ")??"Unknown"}</b><small>Paid status</small></span><span><BookOpen/><b>{customer?.completedLessonCount??"—"}</b><small>Lessons</small></span><span><BadgeCheck/><b>{customer?.certificateCount??"—"}</b><small>Certificates</small></span></div><dl><dt>Account</dt><dd>{customer?.accountStatus??"Unknown"}</dd><dt>Registered</dt><dd>{customer?.registeredAt?new Date(customer.registeredAt).toLocaleDateString():"Unavailable"}</dd><dt>Last active</dt><dd>{customer?.lastActiveAt?new Date(customer.lastActiveAt).toLocaleString():"Unavailable"}</dd><dt>First response</dt><dd>{ticket.firstResponseAt?new Date(ticket.firstResponseAt).toLocaleString():"Waiting"}</dd><dt>SLA due</dt><dd>{ticket.slaDueAt?new Date(ticket.slaDueAt).toLocaleString():"Not set"}</dd><dt>Tags</dt><dd><input defaultValue={ticket.tags?.join(", ")??""} placeholder="billing, learning" onBlur={(event)=>void patch({tags:event.target.value.split(",").map((item)=>item.trim()).filter(Boolean)})}/></dd></dl><a href={`/admin/users?user=${ticket.userId}`}>Open full user profile</a></>:null}</aside>
    </div>
    {actionDialog&&<AdminActionModal key={actionDialog.key} dialog={actionDialog} onClose={()=>setActionDialog(null)}/>}
  </AdminShell>;
}
