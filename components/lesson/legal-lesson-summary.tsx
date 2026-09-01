import { Check } from "lucide-react";
import { SafeRichText } from "../shared/safe-rich-text";

const ARTICLE_PREFIX = /^第\s*(\d+)\s*條[：:]\s*/u;
const ANNEX_PREFIX = /^(附件[一二三])[：:]\s*/u;

function splitLearningPoint(point:string,index:number) {
  const article=point.match(ARTICLE_PREFIX);
  if(article)return {label:`第 ${article[1]} 條`,text:point.replace(ARTICLE_PREFIX,"")};
  const annex=point.match(ANNEX_PREFIX);
  if(annex)return {label:annex[1],text:point.replace(ANNEX_PREFIX,"")};
  return {label:`重點 ${index+1}`,text:point};
}

export function LegalLessonSummaryHeading({title,count,unit}:{title:string;count:number;unit:"條文"|"重點"}) {
  return <header className="legal-lesson-summary-hero"><span aria-hidden="true"><Check/></span><small>{count}/{count} {unit}完成</small><h1>{title}</h1><p>做得好！你已經逐項完成理解同測試。</p></header>;
}

export function LegalLessonPointList({items,summary=false}:{items:string[];summary?:boolean}) {
  return <ol className={summary?"legal-lesson-points summary":"legal-lesson-points overview"}>{items.map((point,index)=>{const item=splitLearningPoint(point,index);return <li key={`${item.label}-${item.text}`}><span>{item.label}</span><SafeRichText value={item.text} as="p" className="legal-lesson-point-text" emphasizeLegalText/>{summary?<i aria-hidden="true"><Check/></i>:null}</li>})}</ol>;
}
