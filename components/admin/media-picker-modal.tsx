"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Film, Image as ImageIcon, Search, Upload, X } from "lucide-react";
import type { MediaAsset } from "@/lib/platform/types";

const formatBytes=(bytes:number)=>{
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
};

export function MediaPickerModal({
  kind,
  currentUrl,
  onSelect,
  onClose,
}:{
  kind:"image"|"video";
  currentUrl?:string;
  onSelect:(asset:MediaAsset)=>void;
  onClose:()=>void;
}){
  const [assets,setAssets]=useState<MediaAsset[]>([]);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{let active=true;fetch(`/api/admin/media?kind=${kind}`).then(async(response)=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(active)setAssets(data.assets??[])}).catch((reason)=>{if(active)setError(reason instanceof Error?reason.message:"Unable to load media")}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[kind]);
  const filtered=useMemo(()=>{const value=query.trim().toLowerCase();return value?assets.filter((asset)=>`${asset.name??""} ${asset.mimeType}`.toLowerCase().includes(value)):assets},[assets,query]);
  const upload=async(file:File)=>{
    setUploading(true);setError("");
    try{
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/admin/media",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:form});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Upload failed");
      setAssets((current)=>[data.asset,...current.filter((asset)=>asset.id!==data.asset.id)]);
    }catch(reason){setError(reason instanceof Error?reason.message:"Upload failed")}
    finally{setUploading(false)}
  };

  return <div className="cms-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!uploading)onClose()}}>
    <section className="cms-modal cms-media-picker" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
      <header><div><small>MEDIA LIBRARY</small><h2 id="media-picker-title">Choose {kind==="image"?"an image":"a video"}</h2><p>Reuse an existing asset or upload a new file. Duplicate uploads are automatically reused.</p></div><button type="button" disabled={uploading} onClick={onClose} aria-label="Close media library"><X/></button></header>
      <div className="cms-media-picker-toolbar"><label><Search/><input autoFocus aria-label="Search media" placeholder="Search course, lesson or filename" value={query} onChange={(event)=>setQuery(event.target.value)}/></label><span>{busy?"Loading…":`${filtered.length} of ${assets.length}`}</span><label className="cms-media-picker-upload"><Upload/>{uploading?"Uploading…":"Upload new"}<input disabled={uploading} type="file" accept={kind==="image"?"image/png,image/jpeg,image/webp,image/gif":"video/mp4,video/webm"} onChange={(event)=>{const file=event.target.files?.[0];if(file)void upload(file)}}/></label></div>
      {error&&<p className="cms-inline-error" role="alert">{error}</p>}
      <div className="cms-media-grid">{busy?<div className="cms-media-empty">Loading media…</div>:filtered.length?filtered.map((asset)=>{const selected=asset.url===currentUrl;return <button type="button" className={`cms-media-card ${selected?"selected":""}`} key={asset.id} onClick={()=>{onSelect(asset);onClose()}}>
        <span>{asset.mimeType.startsWith("image/")?<Image unoptimized width={240} height={150} src={asset.url} alt={asset.name??"Media asset"}/>:<Film/>}{selected&&<em><Check/>Current</em>}</span>
        <strong>{asset.name??"Uploaded asset"}</strong>
        <small>{asset.mimeType.replace(/^.*\//,"").toUpperCase()} · {asset.bytes?formatBytes(asset.bytes):"Remote"} · used {asset.usagePaths?.length??0}×<br/>{asset.uploadedBy==="canonical-import"?"Imported course content":new Date(asset.createdAt).toLocaleDateString()}</small>
      </button>}):<div className="cms-media-empty">{kind==="image"?<ImageIcon/>:<Film/>}<strong>No {kind}s yet</strong><span>Upload the first file to add it to the reusable library.</span></div>}</div>
    </section>
  </div>;
}
