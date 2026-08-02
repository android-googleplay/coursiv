"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type AdminActionField = {
  name: string;
  label: string;
  placeholder?: string;
  help?: string;
  kind?: "text" | "textarea" | "select";
  options?: Array<{ value: string; label: string }>;
  initialValue?: string;
  required?: boolean;
};

export type AdminActionDialog = {
  key: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  fields?: AdminActionField[];
  onConfirm: (values: Record<string, string>) => void | Promise<void>;
};

export function AdminActionModal({
  dialog,
  onClose,
}: {
  dialog: AdminActionDialog;
  onClose: () => void;
}) {
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries((dialog.fields??[]).map((field)=>[field.name,field.initialValue??""])));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const submit=async()=>{
    if(busy)return;
    const missing=(dialog.fields??[]).find((field)=>field.required&&!values[field.name]?.trim());
    if(missing){setError(`${missing.label} is required.`);return}
    setBusy(true);setError("");
    try{await dialog.onConfirm(Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()])));onClose()}
    catch(reason){setError(reason instanceof Error?reason.message:"This action could not be completed.")}
    finally{setBusy(false)}
  };

  return <div className="cms-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onClose()}}>
    <section className={`cms-modal cms-action-modal ${dialog.tone==="danger"?"danger":""}`} role="alertdialog" aria-modal="true" aria-labelledby="admin-action-title" aria-describedby="admin-action-description">
      <header><div><small>{dialog.tone==="danger"?"PLEASE REVIEW":"CONFIRM ACTION"}</small><h2 id="admin-action-title">{dialog.title}</h2><p id="admin-action-description">{dialog.description}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close confirmation"><X/></button></header>
      <form onSubmit={(event)=>{event.preventDefault();void submit()}}>
        {(dialog.fields??[]).map((field)=><label key={field.name}>{field.label}
          {field.kind==="textarea"?<textarea autoFocus={field===(dialog.fields??[])[0]} value={values[field.name]??""} onChange={(event)=>setValues((current)=>({...current,[field.name]:event.target.value}))} placeholder={field.placeholder}/>:field.kind==="select"?<select autoFocus={field===(dialog.fields??[])[0]} value={values[field.name]??""} onChange={(event)=>setValues((current)=>({...current,[field.name]:event.target.value}))}>{field.options?.map((option)=><option value={option.value} key={option.value}>{option.label}</option>)}</select>:<input autoFocus={field===(dialog.fields??[])[0]} value={values[field.name]??""} onChange={(event)=>setValues((current)=>({...current,[field.name]:event.target.value}))} placeholder={field.placeholder}/>}
          {field.help&&<small>{field.help}</small>}
        </label>)}
        {error&&<p className="cms-inline-error" role="alert">{error}</p>}
        <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button autoFocus={!(dialog.fields??[]).length} className={dialog.tone==="danger"?"danger":"primary"} disabled={busy} type="submit">{busy?"Working…":dialog.confirmLabel}</button></footer>
      </form>
    </section>
  </div>;
}
