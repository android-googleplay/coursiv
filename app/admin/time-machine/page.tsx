import { TimeMachinePage } from "@/components/admin/time-machine-page";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffActor } from "@/lib/platform/admin-auth";

export default async function Page(){
  const incoming=await headers();const requestHeaders=new Headers();incoming.forEach((value,key)=>requestHeaders.set(key,value));
  const protocol=requestHeaders.get("x-forwarded-proto")??"http";const host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost";
  const actor=await getStaffActor(new Request(`${protocol}://${host}/admin/time-machine`,{headers:requestHeaders}));
  if(actor?.role!=="admin")redirect("/admin");
  return <TimeMachinePage/>
}
