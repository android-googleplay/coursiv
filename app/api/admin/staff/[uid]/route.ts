import { NextResponse } from "next/server";
import { requireStaff, type StaffRole } from "@/lib/platform/admin-auth";
import { getAdminAuth } from "@/lib/platform/firebase-admin";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export async function PUT(request:Request,{params}:{params:Promise<{uid:string}>}){
  const actor=await requireStaff(request,["admin"]);if(!actor)return NextResponse.json({error:"Administrator access required"},{status:403});
  const uid=(await params).uid;const reservation=await reserveAdminMutation(actor,request,`staff.role:${uid}`);if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const body=await request.json().catch(()=>null) as {role?:StaffRole|null;reason?:string;confirm?:boolean}|null;
  if(!body?.confirm||!body.reason?.trim()||![null,"admin","editor","support","analyst"].includes(body.role??null))return NextResponse.json({error:"Valid role, confirmation and reason are required"},{status:400});
  if(uid===actor.uid&&body.role!=="admin")return NextResponse.json({error:"You cannot remove your own administrator role"},{status:409});
  if(actor.debug)return NextResponse.json({ok:true,debug:true});
  const user=await getAdminAuth().getUser(uid);const before=user.customClaims??{};const after:Record<string,unknown>={...before,admin:body.role==="admin"};for(const key of ["staffRole","editor","support","analyst"])delete after[key];if(body.role)after.staffRole=body.role;await getAdminAuth().setCustomUserClaims(uid,after);
  await writeAdminAudit(actor,{action:"staff.role.update",targetType:"user",targetId:uid,request,before,after,reason:body.reason});return NextResponse.json({ok:true,role:body.role});
}
