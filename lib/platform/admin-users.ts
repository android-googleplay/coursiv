import "server-only";

import type { Query } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";
import type { AdminUserSummary, SubscriptionRecord, SupportTicket } from "./types";
import { demoUsers, demoSubscriptions } from "./admin-demo-data";
import { demoCertificates } from "@/lib/certificates";
import { emptyAdminUserFilters, matchesAdminUserFilters, normalizeAdminUserSearch, type AdminUserFilters } from "./admin-user-search";

export type AdminUserListInput = AdminUserFilters & {
  limit?: number;
  cursor?: string | null;
};

function publicSummary(id: string, value: Record<string, unknown>): AdminUserSummary {
  return {
    id,
    email: String(value.email ?? ""),
    displayName: String(value.displayName ?? value.email ?? "Member"),
    registeredAt: String(value.registeredAt ?? ""),
    lastActiveAt: String(value.lastActiveAt ?? ""),
    onboardingCompleted: Boolean(value.onboardingCompleted),
    subscriptionStatus: ["none","trialing","active","past_due","canceled","unpaid"].includes(String(value.subscriptionStatus)) ? value.subscriptionStatus as AdminUserSummary["subscriptionStatus"] : "none",
    currentPeriodEnd: value.currentPeriodEnd ? String(value.currentPeriodEnd) : null,
    certificateCount: Number(value.certificateCount ?? 0),
    completedLessonCount: Number(value.completedLessonCount ?? 0),
    openTicketCount: Number(value.openTicketCount ?? 0),
    accountStatus: ["active","suspended","deleted"].includes(String(value.accountStatus)) ? value.accountStatus as AdminUserSummary["accountStatus"] : "active",
    tags: Array.isArray(value.tags) ? value.tags.filter((item): item is string => typeof item === "string") : [],
  };
}

function demoSummaries(): AdminUserSummary[] {
  return demoUsers.map((user) => {
    const subscription = demoSubscriptions.find((item) => item.userId === user.id);
    return {
      id: user.id, email: user.email, displayName: user.displayName, registeredAt: user.createdAt, lastActiveAt: user.lastActiveAt,
      onboardingCompleted: user.onboardingCompleted, subscriptionStatus: subscription?.status ?? "none", currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      certificateCount: demoCertificates.filter((item) => item.userId === user.id).length, completedLessonCount: user.id === "usr_1" ? 18 : 0,
      openTicketCount: user.id === "usr_1" ? 1 : 0, accountStatus: "active", tags: [],
    };
  });
}

export async function listAdminUsers(actor: StaffActor, input: AdminUserListInput) {
  const filters:AdminUserFilters={...emptyAdminUserFilters,...input};
  const requestedLimit=Number(input.limit??50);
  const limit=Number.isFinite(requestedLimit)?Math.max(1,Math.min(100,requestedLimit)):50;
  const cursor=input.cursor??null;
  if (actor.debug || !isFirebaseAdminConfigured()) {
    const matching=demoSummaries().filter((user)=>matchesAdminUserFilters(user,filters)).sort((a,b)=>b.registeredAt.localeCompare(a.registeredAt));
    const start=cursor?Math.max(0,matching.findIndex((user)=>user.id===cursor)+1):0;
    const users=matching.slice(start,start+limit);
    return { users, nextCursor:start+limit<matching.length?users.at(-1)?.id??null:null };
  }
  const database = getAdminDb();
  const normalizedQuery=normalizeAdminUserSearch(filters.query).slice(0,80);
  const normalizedTag=normalizeAdminUserSearch(filters.tag);
  let source:Query = database.collection("adminUserSummaries");
  if(normalizedQuery)source=source.where("searchPrefixes","array-contains",normalizedQuery);
  else if(normalizedTag)source=source.where("tagsLower","array-contains",normalizedTag);
  else if(filters.subscriptionStatus!=="all")source=source.where("subscriptionStatus","==",filters.subscriptionStatus);
  else if(filters.accountStatus!=="all")source=source.where("accountStatus","==",filters.accountStatus);
  else {
    if(filters.registeredFrom)source=source.where("registeredAt",">=",`${filters.registeredFrom}T00:00:00.000Z`);
    if(filters.registeredTo)source=source.where("registeredAt","<=",`${filters.registeredTo}T23:59:59.999Z`);
  }
  source=source.orderBy("registeredAt","desc");
  if (cursor) {
    const cursorDocument = await database.collection("adminUserSummaries").doc(cursor).get();
    if (cursorDocument.exists) source = source.startAfter(cursorDocument);
  }
  const users:AdminUserSummary[]=[];
  const batchSize=100;
  let lastScanned:string|null=null;
  let exhausted=false;
  for(let batch=0;batch<5&&!exhausted&&users.length<limit;batch+=1){
    const snapshot=await source.limit(batchSize).get();
    if(!snapshot.size){exhausted=true;break}
    for(const document of snapshot.docs){
      lastScanned=document.id;
      const summary=publicSummary(document.id,document.data());
      if(matchesAdminUserFilters(summary,filters))users.push(summary);
      if(users.length===limit)return {users,nextCursor:document.id};
    }
    exhausted=snapshot.size<batchSize;
    if(!exhausted)source=source.startAfter(snapshot.docs.at(-1)!);
  }
  if (!users.length && !normalizedQuery && !normalizedTag && filters.subscriptionStatus==="all" && filters.accountStatus==="all" && !filters.registeredFrom && !filters.registeredTo) {
    const authPage = await getAdminAuth().listUsers(Math.min(100, limit), cursor || undefined);
    const fallbackUsers = authPage.users.map((user) => ({
      id:user.uid,email:user.email??"",displayName:user.displayName??user.email?.split("@")[0]??"Member",
      registeredAt:user.metadata.creationTime?new Date(user.metadata.creationTime).toISOString():"",lastActiveAt:user.metadata.lastSignInTime?new Date(user.metadata.lastSignInTime).toISOString():"",
      onboardingCompleted:false,subscriptionStatus:"none",currentPeriodEnd:null,certificateCount:0,completedLessonCount:0,openTicketCount:0,
      accountStatus:user.disabled?"suspended":"active",tags:[],
    } satisfies AdminUserSummary));
    return { users:fallbackUsers, nextCursor: authPage.pageToken ?? null };
  }
  return { users, nextCursor:exhausted?null:lastScanned };
}

export async function getAdminUserDetail(actor: StaffActor, uid: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) {
    const summary = demoSummaries().find((item)=>item.id===uid) ?? demoSummaries()[0];
    const progress=summary.id==="usr_1"?Array.from({length:summary.completedLessonCount},(_,index)=>({id:`demo-progress-${index+1}`,courseId:index<10?"claude":"chatgpt",courseTitle:index<10?"Claude":"ChatGPT",lessonId:`lesson-${index+1}`,lessonTitle:`Completed lesson ${index+1}`,completedAt:new Date(Date.now()-(index+1)*86_400_000).toISOString(),updatedAt:new Date(Date.now()-(index+1)*86_400_000).toISOString()})):[];
    const tickets:SupportTicket[]=summary.id==="usr_1"?[{id:"ticket-demo-1",userId:summary.id,email:summary.email,type:"support",subject:"Lesson progress did not save",message:"I completed the lesson but the progress bar did not update.",status:"open",priority:"high",assigneeId:null,tags:["learning"],createdAt:new Date(Date.now()-3_600_000).toISOString(),updatedAt:new Date().toISOString(),lastMessageAt:new Date().toISOString(),notificationStatus:"sent"}]:[];
    const events=summary.id==="usr_1"?[{id:"event-demo-1",name:"lesson_completed",occurredAt:new Date(Date.now()-86_400_000).toISOString()},{id:"event-demo-2",name:"login",occurredAt:new Date(Date.now()-3_600_000).toISOString()}]:[];
    return { summary, subscription:demoSubscriptions.find((item)=>item.userId===summary.id)??null,certificates:demoCertificates.filter((item)=>item.userId===summary.id),tickets,events,meta:{tags:[],internalNotes:[]},progress };
  }
  const database=getAdminDb();
  const [authUser,summary,subscription,certificates,tickets,events,meta,progress]=await Promise.all([
    getAdminAuth().getUser(uid),database.collection("adminUserSummaries").doc(uid).get(),database.collection("subscriptions").doc(uid).get(),
    database.collection("certificates").where("userId","==",uid).limit(100).get(),database.collection("supportTickets").where("userId","==",uid).limit(100).get(),
    database.collection("events").where("userId","==",uid).orderBy("occurredAt","desc").limit(100).get(),database.collection("adminUserMeta").doc(uid).get(),
    database.collection("learningProgress").doc(uid).collection("lessons").limit(500).get(),
  ]);
  const completedLessonCount=progress.docs.filter((item)=>Boolean(item.data().completedAt)).length;
  const subscriptionData=subscription.exists?subscription.data() as SubscriptionRecord:null;
  const result:AdminUserSummary={id:uid,email:authUser.email??"",displayName:authUser.displayName??authUser.email?.split("@")[0]??"Member",registeredAt:new Date(authUser.metadata.creationTime).toISOString(),lastActiveAt:authUser.metadata.lastSignInTime?new Date(authUser.metadata.lastSignInTime).toISOString():"",onboardingCompleted:Boolean(summary.data()?.onboardingCompleted),subscriptionStatus:subscriptionData?.status??"none",currentPeriodEnd:subscriptionData?.currentPeriodEnd??null,certificateCount:certificates.size,completedLessonCount,openTicketCount:tickets.docs.filter((item)=>["open","in_progress","waiting_for_user"].includes(item.data().status)).length,accountStatus:authUser.disabled?"suspended":"active",tags:meta.data()?.tags??[]};
  return {summary:result,subscription:subscriptionData,certificates:certificates.docs.map((item)=>item.data()),tickets:tickets.docs.map((item)=>item.data()),events:events.docs.map((item)=>item.data()),meta:meta.data()??{tags:[],internalNotes:[]},progress:progress.docs.map((item)=>item.data())};
}
