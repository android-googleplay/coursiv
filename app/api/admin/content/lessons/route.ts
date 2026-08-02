import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { createAdminLesson } from "@/lib/platform/admin-content-repository";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import type { LessonStarterTemplate } from "@/lib/platform/admin-lesson-starter";

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","editor"]);if(!actor)return NextResponse.json({error:"Editor access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"content.lesson.create");if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {courseId?:string;title?:string;sourceUnitId?:string;template?:LessonStarterTemplate}|null;
  const result=await createAdminLesson(actor,{courseId:body?.courseId??"",title:body?.title??"",sourceUnitId:body?.sourceUnitId,template:body?.template});
  if(!result.ok)return NextResponse.json({error:result.error},{status:result.status});
  await writeAdminAudit(actor,{action:"content.lesson.create",targetType:"lesson",targetId:result.lesson.id,request,after:result.lesson});
  return NextResponse.json({lesson:result.lesson},{status:201});
}
