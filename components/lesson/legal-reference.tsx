import type { CoursivContentBlock } from "../../lib/coursiv-content";
import { SafeRichText } from "../shared/safe-rich-text";

export function legalReferenceParts(value:string) {
  const [lead="",...points]=value.split(/\s*•\s*/u).map((part)=>part.trim());
  return {lead,points:points.filter(Boolean)};
}

function LegalReferenceText({value,lang}:{value:string;lang?:"en"}) {
  const {lead,points}=legalReferenceParts(value);
  if(!points.length)return lang?<p lang={lang}>{value}</p>:<SafeRichText value={value} as="p" emphasizeLegalText/>;
  return <div className="legal-reference-text" lang={lang}>{lead&&(lang?<p>{lead}</p>:<SafeRichText value={lead} as="p" emphasizeLegalText/>)}<ul>{points.map((point,index)=><li key={`${index}-${point}`}>{lang?point:<SafeRichText value={point} as="span" emphasizeLegalText/>}</li>)}</ul></div>;
}

export function LegalReference({block,initiallyExpanded}:{block:Extract<CoursivContentBlock,{type:"legal-reference"}>;initiallyExpanded:boolean}) {
  return <details className="canonical-legal-reference" open={initiallyExpanded}><summary><span><strong>{block.title}</strong><small>{block.items.length} 條參考</small></span></summary><div aria-label={`${block.title}條文內容`}>{block.items.map((item)=><article key={`${block.id}-${item.citationZh}`}><header><strong>{item.citationZh}</strong><small>{item.citationEn}</small></header><LegalReferenceText value={item.textZh}/><LegalReferenceText value={item.textEn} lang="en"/><footer><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">官方來源 Official source</a><small>核對日期 {item.verifiedAt}</small></footer></article>)}</div></details>;
}
