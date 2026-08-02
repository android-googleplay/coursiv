import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminDb, getAdminStorage, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";
import { writeAdminAudit } from "@/lib/platform/admin-audit";
import type { MediaAsset } from "@/lib/platform/types";
import { reserveAdminMutation } from "@/lib/platform/admin-idempotency";
import { listCanonicalMediaAssets, mergeMediaAssets } from "@/lib/platform/admin-canonical-media";

export const runtime="nodejs";
const debugMediaAssets=new Map<string,MediaAsset>();

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin","editor"]);
  if(!actor)return NextResponse.json({error:"Editor access required"},{status:403});
  const kind=new URL(request.url).searchParams.get("kind");
  const accepts=(asset:MediaAsset)=>kind==="image"?asset.mimeType.startsWith("image/"):kind==="video"?asset.mimeType.startsWith("video/"):true;
  const canonical=await listCanonicalMediaAssets();
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({assets:mergeMediaAssets(canonical,[...debugMediaAssets.values()]).filter(accepts).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  const snapshot=await getAdminDb().collection("mediaAssets").orderBy("createdAt","desc").limit(100).get();
  const uploaded=snapshot.docs.map((document)=>({id:document.id,...document.data()}) as MediaAsset);
  return NextResponse.json({assets:mergeMediaAssets(canonical,uploaded).filter(accepts).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
}

export async function POST(request:Request){
  const actor=await requireStaff(request,["admin","editor"]);if(!actor)return NextResponse.json({error:"Editor access required"},{status:403});
  const reservation=await reserveAdminMutation(actor,request,"media.upload");if(!reservation.ok)return NextResponse.json({error:reservation.error},{status:reservation.status});
  const form=await request.formData().catch(()=>null);const file=form?.get("file");if(!(file instanceof File))return NextResponse.json({error:"File is required"},{status:400});
  const allowed=/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/pdf)$/;if(!allowed.test(file.type)||file.size>25*1024*1024)return NextResponse.json({error:"Unsupported file or file exceeds 25 MB"},{status:400});
  const bytes=Buffer.from(await file.arrayBuffer());const checksum=createHash("sha256").update(bytes).digest("hex");const extension=file.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"").toLowerCase()||"bin";const id=randomUUID();const path=`cms/${checksum.slice(0,2)}/${checksum}.${extension}`;
  if(actor.debug||!isFirebaseAdminConfigured()){const duplicate=[...debugMediaAssets.values()].find((asset)=>asset.checksum===checksum);if(duplicate)return NextResponse.json({asset:duplicate,debug:true,deduplicated:true});const asset:MediaAsset={id,name:file.name,path,url:`data:${file.type};base64,${bytes.toString("base64")}`,mimeType:file.type,bytes:file.size,checksum,uploadedBy:actor.uid,createdAt:new Date().toISOString(),usagePaths:[]};debugMediaAssets.set(id,asset);return NextResponse.json({asset,debug:true},{status:201})}
  const database=getAdminDb();const duplicate=await database.collection("mediaAssets").where("checksum","==",checksum).limit(1).get();if(!duplicate.empty)return NextResponse.json({asset:{id:duplicate.docs[0].id,...duplicate.docs[0].data()},deduplicated:true});
  const bucket=getAdminStorage().bucket();const target=bucket.file(path);await target.save(bytes,{contentType:file.type,resumable:false,metadata:{metadata:{uploadedBy:actor.uid,checksum}}});await target.makePublic();const asset:MediaAsset={id,name:file.name,path,url:`https://storage.googleapis.com/${bucket.name}/${path}`,mimeType:file.type,bytes:file.size,checksum,uploadedBy:actor.uid,createdAt:new Date().toISOString(),usagePaths:[]};await database.collection("mediaAssets").doc(id).create(asset);await writeAdminAudit(actor,{action:"media.upload",targetType:"media",targetId:id,request,after:{path,mimeType:file.type,bytes:file.size,checksum}});return NextResponse.json({asset},{status:201});
}
