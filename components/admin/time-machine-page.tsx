"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudCog, DatabaseBackup, History, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { AdminShell } from "./admin-pages";
import type { ContentCheckpoint } from "@/lib/platform/admin-time-machine-content";

type Build = {
  id: string;
  name: string;
  displayName?: string;
  state: string;
  createTime?: string;
  instantRollbackAvailable: boolean;
  source?: { codebase?: { commit?: string; branch?: string } };
  latestSuccessfulRollout?: { createTime?: string } | null;
};
type Preview = { counts: { added: number; modified: number; deleted: number }; changes: { added: string[]; modified: string[]; deleted: string[] } };

export function TimeMachinePage() {
  const [checkpoints,setCheckpoints]=useState<ContentCheckpoint[]>([]);
  const [builds,setBuilds]=useState<Build[]>([]);
  const [deploymentConfigured,setDeploymentConfigured]=useState(true);
  const [deploymentMissing,setDeploymentMissing]=useState<string[]>([]);
  const [selected,setSelected]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [reason,setReason]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const [contentResponse,deploymentResponse]=await Promise.all([fetch("/api/admin/time-machine/content",{cache:"no-store"}),fetch("/api/admin/time-machine/deployments",{cache:"no-store"})]);
    const content=await contentResponse.json();const deployment=await deploymentResponse.json();
    if(contentResponse.ok)setCheckpoints(content.checkpoints??[]);else setMessage(content.error??"Could not load checkpoints");
    setBuilds(deployment.builds??[]);setDeploymentConfigured(deployment.configured!==false);setDeploymentMissing(deployment.missing??[]);
    if(deployment.error)setMessage(deployment.error);
  },[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);

  const createCheckpoint=async()=>{
    if(!reason.trim())return setMessage("Enter a reason first.");
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/admin/time-machine/content/checkpoints",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({label:"Manual restore point",reason,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage("Manual checkpoint created.");setReason("");await load()}catch(error){setMessage(error instanceof Error?error.message:"Checkpoint failed")}finally{setBusy(false)}
  };
  const inspect=async(id:string)=>{
    setSelected(id);setPreview(null);setConfirmation("");setMessage("");
    const response=await fetch("/api/admin/time-machine/content/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkpointId:id})});const data=await response.json();
    if(response.ok)setPreview(data);else setMessage(data.error??"Preview failed");
  };
  const restore=async()=>{
    if(!selected||!reason.trim()||confirmation!=="RESTORE CONTENT")return setMessage("Reason and exact confirmation are required.");
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/admin/time-machine/content/restore",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({checkpointId:selected,reason,confirmation,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage(`Content restored. Recovery job ${data.job.id} completed.`);setReason("");setConfirmation("");setPreview(null);await load()}catch(error){setMessage(error instanceof Error?error.message:"Restore failed")}finally{setBusy(false)}
  };
  const rollbackDeployment=async(build:Build)=>{
    if(!reason.trim()||confirmation!=="ROLLBACK DEPLOYMENT")return setMessage("Reason and exact deployment confirmation are required.");
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/admin/time-machine/deployments/rollback",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({buildId:build.id,reason,confirmation,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage(`Rollback accepted. Job ${data.job.id} is switching production traffic.`);setReason("");setConfirmation("")}catch(error){setMessage(error instanceof Error?error.message:"Deployment rollback failed")}finally{setBusy(false)}
  };

  return <AdminShell title="Time Machine" subtitle="Content recovery and Firebase App Hosting rollback">
    <p className="tm-boundary"><ShieldCheck/>Protected boundary: only courses, lessons and content metadata can be restored. User data, progress, billing, certificates and audit logs are never included.</p>
    {message&&<p className="cms-message">{message}</p>}
    <div className="tm-grid">
      <section className="admin-panel">
        <div className="admin-panel-title"><div><h2>Content restore points</h2><p>Automatic, daily and manual snapshots · retained for 90 days</p></div><DatabaseBackup/></div>
        <div className="tm-actions"><label>Reason<input value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Why is this action needed?"/></label><button disabled={busy} onClick={createCheckpoint}><History/>Create checkpoint</button><button disabled={busy} onClick={()=>void load()}><RefreshCw/>Refresh</button></div>
        <div className="admin-table-wrap"><table><thead><tr><th>Restore point</th><th>Documents</th><th>Status</th><th/></tr></thead><tbody>{checkpoints.map((checkpoint)=><tr key={checkpoint.id}><td><b>{checkpoint.label}</b><small>{new Date(checkpoint.createdAt).toLocaleString()} · {checkpoint.kind}</small></td><td>{checkpoint.counts.courses} courses · {checkpoint.counts.lessons} lessons</td><td><em className={`status ${checkpoint.status==="ready"?"active":"past_due"}`}>{checkpoint.status}</em></td><td><button disabled={checkpoint.status!=="ready"} onClick={()=>void inspect(checkpoint.id)}>Preview</button></td></tr>)}</tbody></table></div>
        {preview&&<div className="tm-preview"><h3>Restore preview</h3><p><b>{preview.counts.added}</b> recreate · <b>{preview.counts.modified}</b> overwrite · <b>{preview.counts.deleted}</b> remove</p><details><summary>Review affected documents</summary>{(["added","modified","deleted"] as const).map((type)=><div key={type}><strong>{type}</strong><ul>{preview.changes[type].map((item)=><li key={item}>{item}</li>)}</ul></div>)}</details><label>Type RESTORE CONTENT<input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)}/></label><button className="tm-danger" disabled={busy||confirmation!=="RESTORE CONTENT"||!reason.trim()} onClick={restore}><RotateCcw/>Restore selected content</button></div>}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-title"><div><h2>Deployment restore</h2><p>Firebase App Hosting instant rollback</p></div><CloudCog/></div>
        {!deploymentConfigured?<p className="tm-warning"><AlertTriangle/>Add server-only configuration: {deploymentMissing.join(", ")}.</p>:<div className="admin-table-wrap"><table><thead><tr><th>Build</th><th>Created</th><th>Status</th><th/></tr></thead><tbody>{builds.map((build,index)=><tr key={build.name}><td><b>{build.displayName||build.id}</b><small>{build.source?.codebase?.commit?.slice(0,12)||"Commit unavailable"}{index===0?" · newest":""}</small></td><td>{build.createTime?new Date(build.createTime).toLocaleString():"—"}</td><td><em className={`status ${build.instantRollbackAvailable?"active":"past_due"}`}>{build.instantRollbackAvailable?"ready":"unavailable"}</em></td><td><button disabled={busy||!build.instantRollbackAvailable||confirmation!=="ROLLBACK DEPLOYMENT"||!reason.trim()} onClick={()=>void rollbackDeployment(build)}>Roll back</button></td></tr>)}</tbody></table></div>}
        <div className="tm-confirm"><label>Reason<input value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Incident or rollback reason"/></label><label>Type ROLLBACK DEPLOYMENT<input value={confirmation} onChange={(event)=>setConfirmation(event.target.value)}/></label><p><AlertTriangle/>Instant rollback restores both the selected code and the environment configuration stored with that build.</p></div>
      </section>
    </div>
  </AdminShell>;
}
