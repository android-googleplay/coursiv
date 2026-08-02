"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Image as ImageIcon, Search, Upload, X } from "lucide-react";
import type { MediaAsset } from "@/lib/platform/types";
import { AdminShell } from "./admin-pages";

function formatBytes(bytes:number) {
  if (!bytes) return "Remote asset";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function assetSearchText(asset:MediaAsset) {
  return [asset.name, asset.mimeType, asset.path, ...(asset.usagePaths ?? [])].filter(Boolean).join(" ").toLowerCase();
}

export function MediaLibraryPage() {
  const [assets,setAssets]=useState<MediaAsset[]>([]);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<MediaAsset|null>(null);
  const [copied,setCopied]=useState(false);
  const [visibleCount,setVisibleCount]=useState(48);

  useEffect(()=>{
    let active=true;
    fetch("/api/admin/media?kind=image",{cache:"no-store"})
      .then(async(response)=>{const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to load images");if(active)setAssets(data.assets??[])})
      .catch((reason)=>{if(active)setError(reason instanceof Error?reason.message:"Unable to load images")})
      .finally(()=>{if(active)setBusy(false)});
    return()=>{active=false};
  },[]);

  const filtered=useMemo(()=>{
    const value=query.trim().toLowerCase();
    return value?assets.filter((asset)=>assetSearchText(asset).includes(value)):assets;
  },[assets,query]);
  const visibleAssets=filtered.slice(0,visibleCount);
  const uploadedCount=assets.filter((asset)=>asset.uploadedBy!=="canonical-import").length;
  const usedCount=assets.filter((asset)=>(asset.usagePaths?.length??0)>0).length;

  const upload=async(file:File)=>{
    setUploading(true);setError("");
    try{
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/admin/media",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:form});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Upload failed");
      setAssets((current)=>[data.asset,...current.filter((asset)=>asset.id!==data.asset.id)]);
      setSelected(data.asset);
    }catch(reason){setError(reason instanceof Error?reason.message:"Upload failed")}
    finally{setUploading(false)}
  };

  const copyUrl=async()=>{
    if(!selected)return;
    await navigator.clipboard.writeText(selected.url);
    setCopied(true);
    window.setTimeout(()=>setCopied(false),1500);
  };

  return <AdminShell title="Media Library" subtitle="Preview and reuse uploaded course images">
    <div className="media-library-summary" aria-label="Image library summary">
      <span><strong>{assets.length}</strong><small>Images</small></span>
      <span><strong>{uploadedCount}</strong><small>Staff uploads</small></span>
      <span><strong>{usedCount}</strong><small>In use</small></span>
    </div>
    <section className="admin-panel media-library-panel">
      <div className="media-library-toolbar">
        <label><Search/><input aria-label="Search images" placeholder="Search filename, course or lesson" value={query} onChange={(event)=>{setQuery(event.target.value);setVisibleCount(48)}}/></label>
        <span>{busy?"Loading…":`${filtered.length} of ${assets.length} images`}</span>
        <label className="media-library-upload"><Upload/>{uploading?"Uploading…":"Upload image"}<input disabled={uploading} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event)=>{const file=event.target.files?.[0];event.currentTarget.value="";if(file)void upload(file)}}/></label>
      </div>
      {error&&<p className="cms-inline-error" role="alert">{error}</p>}
      <div className="media-library-grid">
        {busy?<div className="media-library-empty"><span className="media-library-loader"/><strong>Loading images…</strong></div>:filtered.length?<>{visibleAssets.map((asset)=><button type="button" className="media-library-card" key={asset.id} onClick={()=>{setSelected(asset);setCopied(false)}}>
          <span><Image unoptimized width={360} height={225} src={asset.url} alt={asset.name??"Uploaded image"}/><em>{asset.mimeType.replace("image/","").toUpperCase()}</em></span>
          <strong>{asset.name??"Untitled image"}</strong>
          <small>{formatBytes(asset.bytes)} · used {asset.usagePaths?.length??0}×</small>
        </button>)}{visibleAssets.length<filtered.length&&<button type="button" className="media-library-more" onClick={()=>setVisibleCount((count)=>count+48)}>Load 48 more<span>{filtered.length-visibleAssets.length} remaining</span></button>}</>:<div className="media-library-empty"><ImageIcon/><strong>No matching images</strong><span>{assets.length?"Try a different filename, course or lesson.":"Upload the first image to start the library."}</span></div>}
      </div>
    </section>
    {selected&&<div className="media-preview-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSelected(null)}}>
      <section className="media-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="media-preview-title">
        <header><div><small>IMAGE PREVIEW</small><h2 id="media-preview-title">{selected.name??"Untitled image"}</h2></div><button type="button" onClick={()=>setSelected(null)} aria-label="Close image preview"><X/></button></header>
        <div className="media-preview-image"><Image unoptimized width={1200} height={800} src={selected.url} alt={selected.name??"Uploaded image preview"}/></div>
        <dl>
          <div><dt>Type</dt><dd>{selected.mimeType}</dd></div>
          <div><dt>Size</dt><dd>{formatBytes(selected.bytes)}</dd></div>
          <div><dt>Uploaded</dt><dd>{selected.uploadedBy==="canonical-import"?"Imported course content":new Date(selected.createdAt).toLocaleString("en-HK",{dateStyle:"medium",timeStyle:"short"})}</dd></div>
          <div><dt>Used in</dt><dd>{selected.usagePaths?.length?selected.usagePaths.join(", "):"Not currently referenced"}</dd></div>
        </dl>
        <footer><button type="button" onClick={()=>void copyUrl()}><Copy/>{copied?"Copied":"Copy image URL"}</button><a href={selected.url} target="_blank" rel="noreferrer"><ExternalLink/>Open original</a></footer>
      </section>
    </div>}
  </AdminShell>;
}
