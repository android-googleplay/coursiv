import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { reorderAdminLessons } from "@/lib/platform/admin-content-repository";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export const runtime="nodejs";

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","editor"]);
  if(!actor)return NextResponse.json({error:"Editor access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"content.lesson.reorder");
  if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {
    courseId?:string;
    unitId?:string;
    orderedIds?:string[];
    expectedCourseVersion?:number;
    expectedVersions?:Record<string,number>;
  }|null;
  if(!body?.courseId||!body.unitId||!Array.isArray(body.orderedIds)||!Number.isInteger(body.expectedCourseVersion)||!body.expectedVersions){
    return NextResponse.json({error:"Course, section, ordered lesson IDs and versions are required"},{status:400});
  }
  const result=await reorderAdminLessons(actor,request,body.courseId,body.unitId,body.orderedIds,body.expectedCourseVersion!,body.expectedVersions);
  if(!result.ok)return NextResponse.json({error:result.errors[0],errors:result.errors},{status:result.status});
  revalidateTag("catalog","max");
  revalidateTag(`course:${body.courseId}`,"max");
  for(const id of body.orderedIds)revalidateTag(`lesson:${id}`,"max");
  return NextResponse.json({course:result.course});
}
