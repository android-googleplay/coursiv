import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import { mergeLearnerState, type LearnerState } from "@/lib/learner-state";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";
import { randomUUID } from "node:crypto";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";

type ActionBody={action?:"tag"|"note"|"suspend"|"restore"|"reset_course";value?:string;courseId?:string;reason?:string;confirm?:boolean};

export async function POST(request:Request,{params}:{params:Promise<{uid:string}>}){
  const actor=await requireStaff(request,["admin","support"]);if(!actor)return NextResponse.json({error:"Support access required"},{status:403});
  const uid=(await params).uid;const reservation=await reserveAdminMutation(actor,request,`user.action:${uid}`);if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});const body=await request.json().catch(()=>null) as ActionBody|null;
  if(!body?.action)return NextResponse.json({error:"Action is required"},{status:400});
  if(["suspend","reset_course"].includes(body.action)&&(!body.confirm||!body.reason?.trim()))return NextResponse.json({error:"Confirmation and reason are required"},{status:400});
  if(actor.debug||!isFirebaseAdminConfigured()){await writeAdminAudit(actor,{action:`user.${body.action}`,targetType:"user",targetId:uid,request,reason:body.reason,after:body});return NextResponse.json({ok:true,debug:true});}
  const database=getAdminDb();const meta=database.collection("adminUserMeta").doc(uid);const now=new Date().toISOString();
  if(body.action==="tag"){const snapshot=await meta.get();const tags=Array.from(new Set([...(snapshot.data()?.tags??[]),body.value?.trim()].filter(Boolean)));await meta.set({tags,updatedAt:now,updatedBy:actor.uid},{merge:true});}
  if(body.action==="note"){const snapshot=await meta.get();const notes=[...(snapshot.data()?.internalNotes??[]),{id:randomUUID(),text:body.value?.trim(),createdAt:now,createdBy:actor.uid}];await meta.set({internalNotes:notes,updatedAt:now,updatedBy:actor.uid},{merge:true});}
  if(body.action==="suspend"||body.action==="restore"){await getAdminAuth().updateUser(uid,{disabled:body.action==="suspend"});await meta.set({suspensionReason:body.action==="suspend"?body.reason:null,updatedAt:now,updatedBy:actor.uid},{merge:true});}
  if(body.action==="reset_course"&&body.courseId){const lessons=await database.collection("learningProgress").doc(uid).collection("lessons").where("courseId","==",body.courseId).limit(500).get();const batch=database.batch();lessons.docs.forEach((doc)=>batch.delete(doc.ref));if(!lessons.empty)await batch.commit();const stateRef=database.collection("progress").doc(uid).collection("state").doc("learner");await database.runTransaction(async(transaction)=>{const snapshot=await transaction.get(stateRef);if(!snapshot.exists)return;const state=mergeLearnerState(snapshot.data() as Partial<LearnerState>);delete state.courses[body.courseId!];transaction.set(stateRef,state)});}
  await writeAdminAudit(actor,{action:`user.${body.action}`,targetType:"user",targetId:uid,request,reason:body.reason,after:body});
  await refreshAdminUserSummary(uid);
  return NextResponse.json({ok:true});
}
