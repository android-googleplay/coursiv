"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, CircleDollarSign, CreditCard, Mail } from "lucide-react";
import { AdminShell } from "./admin-pages";
import { AdminActionModal, type AdminActionDialog } from "./admin-action-modal";
import type { IssuedCertificate, SubscriptionRecord } from "@/lib/platform/types";

type BillingRow=SubscriptionRecord&{email?:string};

export function LiveAdminPaymentsPage(){
  const [rows,setRows]=useState<BillingRow[]>([]);const [error,setError]=useState("");
  useEffect(()=>{let active=true;fetch("/api/admin/billing").then(async(response)=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(active)setRows(data.subscriptions??[])}).catch((reason)=>{if(active)setError(reason instanceof Error?reason.message:"Unable to load billing")});return()=>{active=false}},[]);
  const totals=useMemo(()=>({active:rows.filter((item)=>item.status==="active").length,trial:rows.filter((item)=>item.status==="trialing").length,failed:rows.filter((item)=>["past_due","unpaid"].includes(item.status)).length}),[rows]);
  return <AdminShell title="Payments" subtitle="Stripe webhook-synchronised subscriptions and recovery status">
    {error&&<p className="cms-message">{error}</p>}<div className="admin-metrics"><article className="admin-metric"><span className="green"><CircleDollarSign/></span><div><small>Active subscriptions</small><strong>{totals.active}</strong><em>Paid access</em></div></article><article className="admin-metric"><span className="blue"><CreditCard/></span><div><small>Trials</small><strong>{totals.trial}</strong><em>Stripe status</em></div></article><article className="admin-metric"><span className="red"><AlertTriangle/></span><div><small>Payment recovery</small><strong>{totals.failed}</strong><em>Past due or unpaid</em></div></article></div>
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Subscriptions</h2><p>Refunds and subscription changes continue in Stripe Dashboard</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Subscription</th><th>Status</th><th>Renewal</th><th>Customer</th></tr></thead><tbody>{rows.map((item)=><tr key={item.id}><td>{item.email||item.userId}<small>{item.userId}</small></td><td>{item.stripeSubscriptionId}<small>{item.priceId}</small></td><td><em className={`status ${item.status}`}>{item.status.replaceAll("_"," ")}</em></td><td>{item.currentPeriodEnd??"—"}</td><td>{item.stripeCustomerId}</td></tr>)}</tbody></table></div></section>
  </AdminShell>;
}

export function LiveAdminCertificatesPage(){
  const [rows,setRows]=useState<IssuedCertificate[]>([]);const [message,setMessage]=useState("");const [busy,setBusy]=useState("");const [actionDialog,setActionDialog]=useState<AdminActionDialog|null>(null);
  useEffect(()=>{let active=true;fetch("/api/admin/certificates").then((response)=>response.json()).then((data)=>{if(active)setRows(data.certificates??[])});return()=>{active=false}},[]);
  const requestResend=(item:IssuedCertificate)=>setActionDialog({key:`resend:${item.id}`,title:`Resend certificate ${item.credentialId}?`,description:`A new delivery email will be queued for ${item.recipientEmail}. The credential itself is not reissued or changed.`,confirmLabel:"Resend certificate email",fields:[{name:"reason",label:"Reason for resend",kind:"textarea",placeholder:"For example: learner requested a new copy",required:true}],onConfirm:async({reason})=>{setBusy(item.id);try{const response=await fetch("/api/admin/certificates",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({certificateId:item.id,reason})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Certificate email could not be queued");setMessage("Certificate email queued")}finally{setBusy("")}}});
  return <AdminShell title="Certificates" subtitle="Issued credentials, delivery status and controlled resend">
    {message&&<p className="cms-message">{message}</p>}<div className="admin-metrics"><article className="admin-metric"><span><BadgeCheck/></span><div><small>Issued certificates</small><strong>{rows.length}</strong><em>Firestore records</em></div></article><article className="admin-metric"><span className="green"><Mail/></span><div><small>Email sent</small><strong>{rows.filter((item)=>item.emailStatus==="sent").length}</strong><em>Delivery requested</em></div></article></div>
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Issued credentials</h2><p>Certificate eligibility remains learner-progress driven</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Learner</th><th>Course</th><th>Credential</th><th>Email</th><th>Issued</th><th/></tr></thead><tbody>{rows.map((item)=><tr key={item.id}><td>{item.learnerName}<small>{item.recipientEmail}</small></td><td>{item.courseTitle}</td><td><a href={`/verify/${item.credentialId}`} target="_blank">{item.credentialId}</a></td><td><em className={`status ${item.emailStatus}`}>{item.emailStatus.replaceAll("_"," ")}</em></td><td>{new Date(item.issuedAt).toLocaleDateString()}</td><td><button disabled={busy===item.id} onClick={()=>requestResend(item)}>{busy===item.id?"Sending…":"Resend"}</button></td></tr>)}</tbody></table></div></section>
    {actionDialog&&<AdminActionModal key={actionDialog.key} dialog={actionDialog} onClose={()=>setActionDialog(null)}/>}
  </AdminShell>;
}
