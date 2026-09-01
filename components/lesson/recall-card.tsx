"use client";

import { useState } from "react";
import type { CoursivContentBlock } from "../../lib/coursiv-content";
import { richTextPlainText } from "../../lib/rich-text";

type CalloutBlock=Extract<CoursivContentBlock,{type:"callout"}>;

export function recallAnswerPoints(value:string) {
  const plainText=richTextPlainText(value);
  const answer=plainText.match(/講出[：:]\s*(.+?)(?:。講得出|$)/)?.[1]?.trim()??plainText;
  return answer.split(/\s*→\s*/).map((point)=>point.trim()).filter(Boolean);
}

export function RecallCard({block}:{block:CalloutBlock}) {
  const [revealed,setRevealed]=useState(false);
  const answerPoints=recallAnswerPoints(block.text);
  return <aside className="canonical-callout recall-card">
    <strong>最後重溫</strong>
    <p>先唔好睇答案，試下自己講出今課三個重點。</p>
    <button type="button" aria-expanded={revealed} onClick={()=>setRevealed((current)=>!current)}>{revealed?"收起答案":"顯示答案"}</button>
    {revealed?<div className="recall-answer" aria-live="polite"><small>參考答案</small><ul>{answerPoints.map((point,index)=><li key={`${point}-${index}`}>{point}</li>)}</ul></div>:null}
  </aside>;
}
