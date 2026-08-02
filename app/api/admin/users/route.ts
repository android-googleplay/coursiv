import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { listAdminUsers } from "@/lib/platform/admin-users";
import type { AdminUserSummary, SubscriptionStatus } from "@/lib/platform/types";

export async function GET(request: Request) {
  const actor=await requireStaff(request,["admin","support","analyst"]);
  if(!actor)return NextResponse.json({error:"Staff access required"},{status:403});
  const url=new URL(request.url);
  const subscription=url.searchParams.get("subscription")??"all";
  const account=url.searchParams.get("account")??"all";
  const subscriptionStatus=(["all","none","trialing","active","past_due","canceled","unpaid"].includes(subscription)?subscription:"all") as SubscriptionStatus|"all";
  const accountStatus=(["all","active","suspended","deleted"].includes(account)?account:"all") as AdminUserSummary["accountStatus"]|"all";
  const result=await listAdminUsers(actor,{
    query:url.searchParams.get("q")??"",
    subscriptionStatus,
    accountStatus,
    registeredFrom:url.searchParams.get("registeredFrom")??"",
    registeredTo:url.searchParams.get("registeredTo")??"",
    tag:url.searchParams.get("tag")??"",
    limit:Number(url.searchParams.get("limit")??50),
    cursor:url.searchParams.get("cursor"),
  });
  if(actor.role==="analyst")result.users=result.users.map((user)=>({...user,email:user.email.replace(/^(.).+(@.+)$/,"$1***$2"),displayName:`Member ${user.id.slice(-6)}`}));
  return NextResponse.json(result);
}
