import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { createAdminCourse, listAdminCourses } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { writeAdminAudit } from "@/lib/platform/admin-audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireStaff(request, ["admin", "editor", "analyst"]);
  if (!actor) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  const includeLessons = new URL(request.url).searchParams.get("includeLessons") === "true";
  return NextResponse.json({ courses: await listAdminCourses(actor, includeLessons) });
}

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","editor"]);if(!actor)return NextResponse.json({error:"Editor access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"content.course.create");if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {title?:string;kind?:"tool"|"use-case";duration?:string;categories?:string[]}|null;
  const result=await createAdminCourse(actor,{title:body?.title??"",kind:body?.kind,duration:body?.duration,categories:body?.categories});
  if(!result.ok)return NextResponse.json({error:result.error},{status:result.status});
  await writeAdminAudit(actor,{action:"content.course.create",targetType:"course",targetId:result.course.id,request,after:result.course});
  return NextResponse.json({course:result.course},{status:201});
}
