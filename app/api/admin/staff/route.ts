import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminAuth, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin"]);if(!actor)return NextResponse.json({error:"Administrator access required"},{status:403});
  if(actor.debug||!isFirebaseAdminConfigured())return NextResponse.json({staff:[{id:"debug-admin",email:"admin@coursiv.local",displayName:"Debug Admin",role:"admin",disabled:false}]});
  const users=[];let pageToken:string|undefined;
  do{const page=await getAdminAuth().listUsers(1000,pageToken);for(const user of page.users){const claims=user.customClaims??{};const role=claims.admin===true?"admin":claims.staffRole;if(["admin","editor","support","analyst"].includes(String(role)))users.push({id:user.uid,email:user.email??"",displayName:user.displayName??"",role,disabled:user.disabled})}pageToken=page.pageToken}while(pageToken);
  return NextResponse.json({staff:users});
}
