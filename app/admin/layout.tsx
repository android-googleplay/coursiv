import { AdminAccessGate } from "@/components/admin/admin-access-gate";
import { headers } from "next/headers";
import { getStaffActor } from "@/lib/platform/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const incoming=await headers();const requestHeaders=new Headers();incoming.forEach((value,key)=>requestHeaders.set(key,value));
  const protocol=requestHeaders.get("x-forwarded-proto")??"http";const host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost";
  const actor=await getStaffActor(new Request(`${protocol}://${host}/admin`,{headers:requestHeaders}));
  return actor?children:<AdminAccessGate/>;
}
