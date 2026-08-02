import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/platform/admin-auth";
import { getAdminAuth, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";

export async function GET(request:Request){
  const actor=await requireStaff(request,["admin","support"]);
  if(!actor)return NextResponse.json({error:"Support access required"},{status:403});
  if(actor.debug||!isFirebaseAdminConfigured()){
    return NextResponse.json({assignees:[
      {id:"debug-admin",displayName:"Debug Admin",email:"admin@coursiv.local",role:"admin"},
      {id:"debug-support",displayName:"Support Agent",email:"support@coursiv.local",role:"support"},
    ]});
  }
  const assignees:Array<{id:string;displayName:string;email:string;role:string}>=[];
  let pageToken:string|undefined;
  do{
    const page=await getAdminAuth().listUsers(1000,pageToken);
    for(const user of page.users){
      const role=user.customClaims?.admin===true?"admin":String(user.customClaims?.staffRole??"");
      if(!["admin","support"].includes(role)||user.disabled)continue;
      assignees.push({id:user.uid,displayName:user.displayName??user.email?.split("@")[0]??"Staff member",email:user.email??"",role});
    }
    pageToken=page.pageToken;
  }while(pageToken);
  return NextResponse.json({assignees:assignees.sort((a,b)=>a.displayName.localeCompare(b.displayName))});
}
