"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AdminShell } from "./admin-pages";
import { AdminActionModal, type AdminActionDialog } from "./admin-action-modal";
import type { StaffRole } from "@/lib/platform/types";

type StaffRow={id:string;email:string;displayName:string;role:StaffRole;disabled:boolean};
const roles:StaffRole[]=["admin","editor","support","analyst"];

export function StaffManagementPage(){
  const [staff,setStaff]=useState<StaffRow[]>([]);const [message,setMessage]=useState("");const [actionDialog,setActionDialog]=useState<AdminActionDialog|null>(null);
  const load=useCallback(()=>fetch("/api/admin/staff").then((response)=>response.json()).then((data)=>setStaff(data.staff??[])),[]);
  useEffect(()=>{void load()},[load]);
  const requestRoleChange=(item:StaffRow,role:StaffRole)=>{if(role===item.role)return;setActionDialog({key:`${item.id}:${role}`,title:`Give ${role} access to ${item.displayName||item.email}?`,description:`This changes ${item.email} from ${item.role} to ${role}. The new permissions take effect after their Firebase token refreshes.`,confirmLabel:"Update staff role",tone:role==="admin"?"danger":"default",fields:[{name:"reason",label:"Reason for role change",kind:"textarea",placeholder:"Explain why this access is required",required:true}],onConfirm:async({reason})=>{const response=await fetch(`/api/admin/staff/${item.id}`,{method:"PUT",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({role,reason,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Role could not be updated");setMessage("Staff role updated");await load()}})};
  return <AdminShell title="Staff & Roles" subtitle="Admin, editor, support and analyst access"><p className="cms-warning"><ShieldCheck/>Role changes take effect when the staff member refreshes their Firebase token.</p>{message&&<p className="cms-message">{message}</p>}<section className="admin-panel admin-table-wrap"><table><thead><tr><th>Staff member</th><th>UID</th><th>Role</th><th>Status</th></tr></thead><tbody>{staff.map((item)=><tr key={item.id}><td>{item.displayName||item.email}<small>{item.email}</small></td><td>{item.id}</td><td><select aria-label={`Role for ${item.email}`} value={item.role} onChange={(event)=>requestRoleChange(item,event.target.value as StaffRole)}>{roles.map((role)=><option key={role}>{role}</option>)}</select></td><td><em className={`status ${item.disabled?"past_due":"active"}`}>{item.disabled?"suspended":"active"}</em></td></tr>)}</tbody></table></section>{actionDialog&&<AdminActionModal key={actionDialog.key} dialog={actionDialog} onClose={()=>setActionDialog(null)}/>}</AdminShell>;
}
