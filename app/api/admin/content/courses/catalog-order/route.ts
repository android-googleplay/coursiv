import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reorderAdminCatalog } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export const runtime="nodejs";

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","editor"]);
  if(!actor)return NextResponse.json({error:"Editor access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"content.catalog.reorder");
  if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {orders?:Record<"tool"|"use-case",string[]>;expectedVersions?:Record<string,number>}|null;
  if(!body?.orders||!Array.isArray(body.orders.tool)||!Array.isArray(body.orders["use-case"])||!body.expectedVersions)return NextResponse.json({error:"Complete catalog order and expected versions are required"},{status:400});
  const result=await reorderAdminCatalog(actor,request,body.orders,body.expectedVersions);
  if(!result.ok)return NextResponse.json({error:result.errors[0],errors:result.errors},{status:result.status});
  revalidateTag("catalog","max");
  for(const course of result.courses)revalidateTag(`course:${course.id}`,"max");
  return NextResponse.json({courses:result.courses});
}
