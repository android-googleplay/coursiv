import { describe, expect, it } from "vitest";
import type { SupportTicket } from "./types";
import { buildTicketSearchIndex, emptyTicketQueueFilters, matchesTicketQueueFilters, sortTicketQueue, ticketSlaState } from "./admin-ticket-search";

const now=Date.parse("2026-07-24T12:00:00.000Z");
const ticket=(overrides:Partial<SupportTicket>={}):SupportTicket=>({
  id:"ticket-1",userId:"user-amy",email:"amy@example.com",type:"support",subject:"Billing question",message:"Please help with my invoice",
  status:"open",priority:"high",assigneeId:null,tags:["billing"],createdAt:"2026-07-24T09:00:00.000Z",updatedAt:"2026-07-24T10:00:00.000Z",
  lastMessageAt:"2026-07-24T10:00:00.000Z",slaDueAt:"2026-07-24T14:00:00.000Z",notificationStatus:"sent",...overrides,
});

describe("ticket queue search",()=>{
  it("indexes subject, email domain, ID, tags and message prefixes",()=>{
    const index=buildTicketSearchIndex(ticket());
    expect(index.searchPrefixes).toContain("billing ques");
    expect(index.searchPrefixes).toContain("example");
    expect(index.searchPrefixes).toContain("ticket-1");
    expect(index.searchPrefixes).toContain("invoice");
  });

  it("matches combined priority, assignee and SLA filters",()=>{
    expect(matchesTicketQueueFilters(ticket(),{...emptyTicketQueueFilters,query:"amy@example",priority:"high",assignee:"unassigned",sla:"due_4h"},now)).toBe(true);
    expect(matchesTicketQueueFilters(ticket(),{...emptyTicketQueueFilters,sla:"overdue"},now)).toBe(false);
    expect(ticketSlaState(ticket({slaDueAt:"2026-07-24T11:00:00.000Z"}),now)).toBe("overdue");
  });

  it("sorts by SLA deadline with tickets lacking SLA last",()=>{
    const ordered=sortTicketQueue([
      ticket({id:"no-sla",slaDueAt:null}),
      ticket({id:"later",slaDueAt:"2026-07-24T18:00:00.000Z"}),
      ticket({id:"first",slaDueAt:"2026-07-24T13:00:00.000Z"}),
    ],"sla");
    expect(ordered.map((item)=>item.id)).toEqual(["first","later","no-sla"]);
  });
});
