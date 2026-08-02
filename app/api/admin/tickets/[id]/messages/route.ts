import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { addTicketMessage } from "@/lib/platform/admin-tickets";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const actor=await requireStaff(request,["admin","support"]);if(!actor)return NextResponse.json({error:"Support access required"},{status:403});const id=(await params).id;const reservation=await reserveAdminMutation(actor,request,`ticket.message:${id}`);if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});const body=await request.json().catch(()=>null) as {bodyText?:string;internal?:boolean}|null;try{const message=await addTicketMessage(actor,id,{bodyText:body?.bodyText??"",internal:body?.internal});await writeAdminAudit(actor,{action:body?.internal?"ticket.note":"ticket.reply",targetType:"ticket",targetId:id,request,after:{messageId:message.id}});return NextResponse.json({message},{status:201})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to add message"},{status:400})}}
