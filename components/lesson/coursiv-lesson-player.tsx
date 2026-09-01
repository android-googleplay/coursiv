"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Check, ClipboardCheck, Copy, Home, RotateCcw, Volume2, X } from "lucide-react";
import type { CoursivContentBlock, CoursivLesson, CoursivLessonScreen } from "@/lib/coursiv-content";
import { useLearner } from "@/components/member/learner-context";
import { SafeRichText } from "@/components/shared/safe-rich-text";
import { scrollQuestionAfterReset, useScrollToResult } from "@/components/shared/use-scroll-to-result";
import { richTextEditorHtml, richTextPlainText } from "@/lib/rich-text";
import { coursivMediaUrl } from "@/lib/coursiv-media-url";
import { isPlainLanguageReview, PlainLanguageReview, type MatchingBlock } from "./plain-language-review";
import { RecallCard } from "./recall-card";
import { LegalReference } from "./legal-reference";
import { OptionalQuizActions } from "./optional-quiz-actions";
import { LegalLessonPointList, LegalLessonSummaryHeading } from "./legal-lesson-summary";
import { lessonStartedStorageKey } from "@/lib/learner-state";
import { ButtonText } from "../member/button-text";

type ChoiceBlock = Extract<CoursivContentBlock,{type:"single-choice"|"multi-choice"|"true-false"}>;
type ScreenAnswer = { blockId:string;values:string[] };

function spokenText(screen:CoursivLessonScreen) {
  const plain=(value:string)=>richTextPlainText(value);
  return screen.blocks.map((block)=>{
    if(block.type==="heading"||block.type==="paragraph")return plain(block.text);
    if(block.type==="list")return block.items.join(". ");
    if(block.type==="callout")return `${block.title??""}. ${plain(block.text)}`;
    if(block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false")return `${plain(block.question)}. ${block.options.map((option)=>plain(option.label)).join(". ")}`;
    if(block.type==="fill-in-blank")return `${block.prompt}. ${plain(block.template)}`;
    if(block.type==="ordering-task"||block.type==="matching-pairs"||block.type==="prompt-fixer"||block.type==="practice")return `${block.title}. ${block.prompt??""}`;
    if(block.type==="survey")return plain(block.question);
    if(block.type==="feedback")return `${block.title??""}. ${plain(block.text)}`;
    if(block.type==="legal-reference")return `${block.title}. ${block.items.map((item)=>`${item.citationZh}. ${plain(item.textZh)}`).join(". ")}`;
    return block.type==="unknown"?block.text??"":"";
  }).filter(Boolean).join(". ");
}

function Feedback({correct,text,onRetry,highlights=[],focusOnMount=true}:{correct:boolean;text?:string;onRetry?:()=>void;highlights?:string[];focusOnMount?:boolean}) {
  const message=text??(correct?"Great work — you can continue.":"Review your answer and try again.");
  const resultRef=useScrollToResult<HTMLDivElement>(focusOnMount);
  return <div ref={resultRef} className={`canonical-feedback ${correct?"correct":"incorrect"}`} role="status"><h2>{correct?<Check/>:<X/>}{correct?"Correct answer":"Not quite"}</h2><SafeRichText value={message} emphasizeFeedback highlights={highlights}/>{!correct&&onRetry&&<button onClick={(event)=>{const question=event.currentTarget.closest<HTMLElement>(".canonical-quiz,.canonical-fill,.canonical-order,.canonical-match,.canonical-prompt-fixer");onRetry();scrollQuestionAfterReset(()=>question)}}><RotateCcw/><ButtonText>Try again</ButtonText></button>}</div>;
}

function useFocusFeedbackOnAnswer(initiallyResolved:boolean) {
  const [focusFeedback]=useState(()=>!initiallyResolved);
  return focusFeedback;
}

function OptionLabel({value}:{value:string}) {
  return <SafeRichText value={value} as="span" inline className="canonical-option-label"/>;
}

function OptionIndex({index}:{index:number}) {
  return <span className="canonical-option-index">{String.fromCharCode(65+index)}</span>;
}

function FilledTemplate({template,selected,submitted,onRemove}:{template:string;selected:string[];submitted:boolean;onRemove:(index:number)=>void}) {
  let placeholderIndex=0;
  const escapeText=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  const markup=richTextEditorHtml(template).replace(/\[([^\]]+)\]/g,(_part,label:string)=>{
    const slot=placeholderIndex++;
    const value=selected[slot];
    const disabled=submitted||!value?" disabled":"";
    return `<button type="button" data-slot="${slot}" class="${value?"filled":""}"${disabled}>${escapeText(value??`[${label}]`)}</button>`;
  });
  return <div className="canonical-fill-template" onClick={(event)=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-slot]");if(!target||target.disabled)return;onRemove(Number(target.dataset.slot))}} dangerouslySetInnerHTML={{__html:markup}}/>;
}

function Choice({block,onResolved,initiallyResolved=false}:{block:ChoiceBlock;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const focusFeedback=useFocusFeedbackOnAnswer(initiallyResolved);
  const initialCorrectIds=block.options.filter((option)=>option.isCorrect).map((option)=>option.id);
  const [selected,setSelected]=useState<string[]>(initiallyResolved?initialCorrectIds:[]);const [submitted,setSubmitted]=useState(initiallyResolved);
  const correctIds=useMemo(()=>block.options.filter((option)=>option.isCorrect).map((option)=>option.id).sort(),[block.options]);
  const feedbackHighlights=useMemo(()=>block.options.filter((option)=>option.isCorrect).map((option)=>richTextPlainText(option.label.split(/<br\s*\/?\s*>|<small/i)[0])).filter((value)=>value.length>=2),[block.options]);
  const correct=submitted&&selected.slice().sort().join("|")===correctIds.join("|");
  const multiple=block.type==="multi-choice";
  const choose=(id:string)=>{if(!submitted)setSelected((current)=>multiple?(current.includes(id)?current.filter((item)=>item!==id):[...current,id]):[id])};
  const submit=()=>{setSubmitted(true);if(selected.slice().sort().join("|")===correctIds.join("|"))onResolved({blockId:block.id,values:selected})};
  const response=correct?block.feedbackCorrect:block.feedbackIncorrect;
  return <div className="canonical-quiz"><SafeRichText value={block.question} as="h1" inline/>{block.instruction&&<p>{block.instruction}</p>}<div className="canonical-options" role={multiple?"group":"radiogroup"}>{block.options.map((option,index)=><button type="button" role={multiple?"checkbox":"radio"} aria-checked={selected.includes(option.id)} className={selected.includes(option.id)?"selected":""} disabled={submitted} onClick={()=>choose(option.id)} key={option.id}>{option.image&&<img src={option.image} alt=""/>}<OptionIndex index={index}/><OptionLabel value={option.label}/></button>)}</div>{!submitted?<button className="canonical-submit" disabled={!selected.length} onClick={submit}><ButtonText>Submit</ButtonText></button>:<Feedback correct={correct} text={response?.text} highlights={feedbackHighlights} focusOnMount={focusFeedback} onRetry={()=>{setSelected([]);setSubmitted(false)}}/>}</div>;
}

function Fill({block,onResolved,title,tool,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"fill-in-blank"}>;onResolved:(answer:ScreenAnswer)=>void;title?:string;tool?:CoursivLessonScreen["practiceTool"];initiallyResolved?:boolean}) {
  const focusFeedback=useFocusFeedbackOnAnswer(initiallyResolved);
  const [selected,setSelected]=useState<string[]>(initiallyResolved?block.correctTokens:[]);const [submitted,setSubmitted]=useState(initiallyResolved);const correct=submitted&&selected.join("|")===block.correctTokens.join("|");
  const check=()=>{setSubmitted(true);if(selected.join("|")===block.correctTokens.join("|"))onResolved({blockId:block.id,values:selected})};
  return <div className="canonical-fill"><h1>{title??block.prompt}</h1>{title&&<p>{block.prompt}</p>}<div className="practice-tool-label">{tool?.icon?<img src={tool.icon} alt=""/>:<span>✦</span>} <strong>{tool?.name??"AI Tool"}</strong></div><FilledTemplate template={block.template} selected={selected} submitted={submitted} onRemove={(slot)=>setSelected((current)=>current.filter((_,index)=>index!==slot))}/><div className="canonical-tokens">{block.tokens.map((token,index)=><button disabled={submitted||selected.filter((item)=>item===token).length>=block.tokens.filter((item)=>item===token).length} onClick={()=>setSelected((current)=>[...current,token])} key={`${token}-${index}`}>{token}</button>)}</div>{!submitted?<button className="canonical-submit" disabled={selected.length!==block.placeholders.length} onClick={check}><ButtonText>Check</ButtonText></button>:<Feedback correct={correct} text={correct?(block.feedback?.text??block.exampleResponse):undefined} focusOnMount={focusFeedback} onRetry={()=>{setSelected([]);setSubmitted(false)}}/>}</div>;
}

function Ordering({block,onResolved,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"ordering-task"}>;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const focusFeedback=useFocusFeedbackOnAnswer(initiallyResolved);
  const [selected,setSelected]=useState<string[]>(initiallyResolved?block.correctItems:[]);const [submitted,setSubmitted]=useState(initiallyResolved);const correct=submitted&&selected.join("|")===block.correctItems.join("|");
  const remaining=block.items.filter((item)=>!selected.includes(item));const check=()=>{setSubmitted(true);if(selected.join("|")===block.correctItems.join("|"))onResolved({blockId:block.id,values:selected})};
  return <div className="canonical-order"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<div className="canonical-filled ordered">{selected.length?selected.map((item,index)=><button disabled={submitted} onClick={()=>setSelected((current)=>current.filter((_,i)=>i!==index))} key={item}><b>{index+1}</b>{item}</button>):<span>Choose the steps in the correct order</span>}</div><div className="canonical-tokens stacked">{remaining.map((item)=><button disabled={submitted} onClick={()=>setSelected((current)=>[...current,item])} key={item}>{item}</button>)}</div>{!submitted?<button className="canonical-submit" disabled={selected.length!==block.items.length} onClick={check}><ButtonText>Check</ButtonText></button>:<Feedback correct={correct} text={(correct?block.feedbackCorrect:block.feedbackIncorrect)?.text} focusOnMount={focusFeedback} onRetry={()=>{setSelected([]);setSubmitted(false)}}/>}</div>;
}

function MatchingPairs({block,onResolved,initiallyResolved=false}:{block:MatchingBlock;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const focusFeedback=useFocusFeedbackOnAnswer(initiallyResolved);
  const [answers,setAnswers]=useState<Record<string,string>>(initiallyResolved?Object.fromEntries(block.pairs.map((pair)=>[pair.id,pair.right])):{});const [submitted,setSubmitted]=useState(initiallyResolved);const values=block.pairs.map((pair)=>answers[pair.id]??"");const correct=submitted&&values.every((value,index)=>value===block.pairs[index].right);
  const used=new Set(values);const check=()=>{setSubmitted(true);if(values.every((value,index)=>value===block.pairs[index].right))onResolved({blockId:block.id,values})};
  const completed=values.filter(Boolean).length;
  return <div className="canonical-match"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<p className="match-instruction">逐項選擇最接近嘅答案；完成全部 {block.pairs.length} 組後就可以檢查。</p><div className="match-progress" role="status">已配對 {completed}/{block.pairs.length}</div><div className="match-select-list">{block.pairs.map((pair)=><label key={pair.id}><strong>{pair.left}</strong><select aria-label={`${pair.left} 配對答案`} value={answers[pair.id]??""} disabled={submitted} onChange={(event)=>setAnswers((current)=>({...current,[pair.id]:event.target.value}))}><option value="">請選擇答案</option>{block.pairs.map((choice)=><option value={choice.right} disabled={used.has(choice.right)&&answers[pair.id]!==choice.right} key={choice.right}>{choice.right}</option>)}</select>{answers[pair.id]&&<span className="match-selected-answer">你揀咗：{answers[pair.id]}</span>}</label>)}</div>{!submitted?<button className="canonical-submit" disabled={values.some((value)=>!value)} onClick={check}>{completed===block.pairs.length?"檢查答案":"完成全部配對先可檢查"}</button>:<Feedback correct={correct} focusOnMount={focusFeedback} onRetry={()=>{setAnswers({});setSubmitted(false)}}/>}</div>;
}

function Matching({block,onResolved,onRestart,initiallyResolved=false}:{block:MatchingBlock;onResolved:(answer:ScreenAnswer)=>void;onRestart?:()=>void;initiallyResolved?:boolean}) {
  return isPlainLanguageReview(block)?<PlainLanguageReview block={block} onResolved={onResolved} onRestart={onRestart}/>:<MatchingPairs block={block} initiallyResolved={initiallyResolved} onResolved={onResolved}/>;
}

function PromptFixer({block,onResolved,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"prompt-fixer"}>;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const focusFeedback=useFocusFeedbackOnAnswer(initiallyResolved);
  const [selected,setSelected]=useState<string|null>(initiallyResolved?(block.options.find((item)=>item.isCorrect)?.id??null):null);const [submitted,setSubmitted]=useState(initiallyResolved);const option=block.options.find((item)=>item.id===selected);const correct=Boolean(submitted&&option?.isCorrect);
  const submit=()=>{setSubmitted(true);if(option?.isCorrect)onResolved({blockId:block.id,values:[option.id]})};
  return <div className="canonical-prompt-fixer"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<div className="prompt-template">{block.template}</div><div className="canonical-options" role="radiogroup">{block.options.filter((item)=>!item.label.match(/^style$/i)).map((item,index)=><button role="radio" aria-checked={selected===item.id} className={selected===item.id?"selected":""} disabled={submitted} onClick={()=>setSelected(item.id)} key={item.id}><OptionIndex index={index}/><OptionLabel value={item.label}/></button>)}</div>{option?.outputLocalImage&&<img className="prompt-output" src={option.outputLocalImage} alt="Generated example"/>}{option?.outputText&&<p>{option.outputText}</p>}{!submitted?<button className="canonical-submit" disabled={!selected} onClick={submit}><ButtonText>Submit</ButtonText></button>:<Feedback correct={correct} text={(correct?block.feedbackCorrect:block.feedbackIncorrect)?.text} focusOnMount={focusFeedback} onRetry={()=>{setSelected(null);setSubmitted(false)}}/>}</div>;
}

function Survey({block,onResolved}:{block:Extract<CoursivContentBlock,{type:"survey"}>;onResolved:(answer:ScreenAnswer)=>void}) {const [selected,setSelected]=useState<string|null>(null);return <div className="canonical-quiz"><SafeRichText value={block.question} as="h1" inline/><div className="canonical-options" role="radiogroup">{block.options.map((option,index)=><button role="radio" aria-checked={selected===option.id} className={selected===option.id?"selected":""} onClick={()=>setSelected(option.id)} key={option.id}><OptionIndex index={index}/><OptionLabel value={option.label}/></button>)}</div><button className="canonical-submit" disabled={!selected} onClick={()=>selected&&onResolved({blockId:block.id,values:[selected]})}><ButtonText>Continue</ButtonText></button></div>}

function CopyPromptCallout({block}:{block:Extract<CoursivContentBlock,{type:"callout"}>}) {
  const [copied,setCopied]=useState(false);
  const copy=async()=>{
    try{
      await navigator.clipboard.writeText(richTextPlainText(block.text));
      setCopied(true);
      window.setTimeout(()=>setCopied(false),2000);
    }catch{setCopied(false)}
  };
  return <aside className="canonical-callout copy-prompt"><strong>{block.title??"Ready-to-use prompt"}</strong><SafeRichText value={block.text}/><button type="button" onClick={()=>void copy()} aria-label="Copy prompt">{copied?<Check/>:<Copy/>}<ButtonText>{copied?"Copied":"Copy prompt"}</ButtonText></button></aside>;
}

function Static({block,onResolved,current,summaryCount=0,summaryUnit="重點"}:{block:CoursivContentBlock;onResolved:(answer:ScreenAnswer)=>void;current:boolean;summaryCount?:number;summaryUnit?:"條文"|"重點"}) {
  if(block.type==="heading")return block.id.startsWith("basic-law-")&&block.id.endsWith("-review-h")?<LegalLessonSummaryHeading title={block.text} count={summaryCount} unit={summaryUnit}/>:<SafeRichText value={block.text} inline as={block.level<=2?"h1":"h2"}/>;
  if(block.type==="paragraph")return <SafeRichText value={block.text}/>;
  if(block.type==="list"){
    if(block.id.startsWith("basic-law-")&&block.id.endsWith("-map-list"))return <LegalLessonPointList items={block.items}/>;
    if(block.id.startsWith("basic-law-")&&block.id.endsWith("-review-list"))return <LegalLessonPointList items={block.items} summary/>;
    const Tag=block.ordered?"ol":"ul";return <Tag>{block.items.map((item)=><li key={item}>{item}</li>)}</Tag>;
  }
  if(block.type==="callout")return block.id.endsWith("-final-recall")?<RecallCard block={block}/>:block.tone==="copy-prompt"?<CopyPromptCallout block={block}/>:<aside className={`canonical-callout ${block.tone??""}`}>{block.title&&<strong>{block.title}</strong>}<SafeRichText value={block.text}/></aside>;
  if(block.type==="image")return <figure><img src={coursivMediaUrl(block.localSrc??block.src)} alt={block.alt} decoding="async"/>{block.alt&&<figcaption>{block.alt}</figcaption>}</figure>;
  if(block.type==="video")return <video controls playsInline poster={coursivMediaUrl(block.poster)} src={coursivMediaUrl(block.src)}/>;
  if(block.type==="practice")return <div className="canonical-practice"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<button className="canonical-submit" onClick={()=>onResolved({blockId:block.id,values:["submitted"]})}><ButtonText>I&apos;ve completed this practice</ButtonText></button></div>;
  if(block.type==="feedback")return <div className={`canonical-feedback ${block.correct===false?"incorrect":"correct"}`}><h2>{block.title}</h2><SafeRichText value={block.text}/></div>;
  if(block.type==="legal-reference")return <LegalReference key={current?"current":"past"} block={block} initiallyExpanded={current}/>;
  if(block.type==="unknown")return <div className="canonical-unknown"><small>{block.sourceType}</small>{block.text&&<p>{block.text}</p>}</div>;
  return null;
}

function isInteractive(block:CoursivContentBlock) {return ["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type)}

function isRepeatedBasicLawQuestionTip(screen:CoursivLessonScreen) {
  return screen.blocks.some((block)=>block.type==="callout"&&block.title==="拆題提示");
}

function lessonScreenIndex(screens:CoursivLessonScreen[],savedId:string|null|undefined,courseId:string) {
  if(!savedId)return -1;
  const exact=screens.findIndex((item)=>item.id===savedId||item.blocks.some((block)=>block.id===savedId));
  if(exact>=0||courseId!=="basic-law")return exact;
  if(savedId.endsWith("-screen-05"))return screens.findIndex((item)=>item.id===`${savedId.slice(0,-2)}04`);
  if(savedId.endsWith("-screen-16"))return screens.findIndex((item)=>item.id===`${savedId.slice(0,-2)}17`);
  return -1;
}

function ScreenContent({screen,onResolved,onPlainLanguageRestart,resolved=false,current=false}:{screen:CoursivLessonScreen;onResolved:(answer:ScreenAnswer)=>void;onPlainLanguageRestart?:()=>void;resolved?:boolean;current?:boolean}) {
  const summaryItems=screen.blocks.find((block)=>block.type==="list"&&block.id.endsWith("-review-list"));
  const summaryCount=summaryItems?.type==="list"?summaryItems.items.length:0;
  const summaryUnit=summaryItems?.type==="list"&&summaryItems.items.every((item)=>/^第\s*\d+\s*條[：:]/u.test(item))?"條文":"重點";
  return <>{screen.blocks.map((block)=>block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false"?<Choice key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="fill-in-blank"?<Fill key={block.id} block={block} title={screen.title} tool={screen.practiceTool} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="ordering-task"?<Ordering key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="matching-pairs"?<Matching key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved} onRestart={onPlainLanguageRestart}/>:block.type==="prompt-fixer"?<PromptFixer key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="survey"?<Survey key={block.id} block={block} onResolved={onResolved}/>:<Static key={block.id} block={block} current={current} summaryCount={summaryCount} summaryUnit={summaryUnit} onResolved={onResolved}/>)}</>;
}

function PracticePreview({screen,resolved,onOpen}:{screen:CoursivLessonScreen;resolved:boolean;onOpen:()=>void}) {
  const block=screen.blocks[0];
  const plainLanguage=block?.type==="matching-pairs"&&isPlainLanguageReview(block);
  const title=plainLanguage?`${block.pairs.length} 題快速小測`:screen.title??("title" in (block??{})?String((block as {title?:string}).title??"Guided practice"):"Guided practice");
  const prompt=plainLanguage?"逐題選出正確解釋，答完即時核對。":block&&"prompt" in block?block.prompt:undefined;
  return <div className={`canonical-practice-preview ${resolved?"completed":""}`}>{resolved&&<span><Check/>Task completed</span>}<h1>{title}</h1>{prompt&&<p>{prompt}</p>}{(!plainLanguage||resolved)&&<button onClick={onOpen}>{plainLanguage?"再做一次":<ButtonText>{resolved?"Review practice":"Open Playground"}</ButtonText>}</button>}</div>;
}

export function CoursivLessonPlayer({courseId,courseTitle,lesson,backHref,completionHref,persistProgress=true}:{courseId:string;courseTitle:string;lesson:CoursivLesson;backHref?:string;completionHref?:string;persistProgress?:boolean}) {
  const router=useRouter();
  const search=useSearchParams();
  const restartRequested=search.get("restart")==="1";
  const {state,saveScreen,getLessonProgress,completeLesson,resetLesson}=useLearner();
  const saveScreenRef=useRef(saveScreen);
  const getLessonProgressRef=useRef(getLessonProgress);
  const screens=useMemo<CoursivLessonScreen[]>(()=>{
    const source=lesson.screens?.length?lesson.screens:(lesson.blocks??[]).map((block,index)=>({id:block.id,sourcePageId:"legacy",order:index,type:block.type,presentation:"content" as const,interactionPolicy:isInteractive(block)?"required-interaction" as const:"read" as const,blocks:[block]}));
    return courseId==="basic-law"&&lesson.slug!=="exam-map"?source.filter((screen)=>!isRepeatedBasicLawQuestionTip(screen)):source;
  },[courseId,lesson.blocks,lesson.screens,lesson.slug]);
  const savedId=persistProgress&&!restartRequested&&state.courses[courseId]?.lastLessonId===lesson.slug?state.courses[courseId]?.lastScreenId:null;
  const savedIndex=Math.max(0,lessonScreenIndex(screens,savedId,courseId));
  const resolvedStorageKey=`coursiv.resolved.v3:${courseId}:${lesson.slug}`;
  const skippedStorageKey=`coursiv.skipped.v3:${courseId}:${lesson.slug}`;
  const readStored=(key:string)=>{if(typeof window==="undefined")return{};try{return JSON.parse(localStorage.getItem(key)??"{}") as Record<string,boolean>}catch{return{}}};
  const [index,setIndex]=useState(savedIndex);
  const [resolved,setResolved]=useState<Record<string,boolean>>(()=>readStored(resolvedStorageKey));
  const [skipped,setSkipped]=useState<Record<string,boolean>>(()=>readStored(skippedStorageKey));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [practiceScreenId,setPracticeScreenId]=useState<string|null>(null);
  const [reviewInProgress,setReviewInProgress]=useState(false);
  const queue=useRef(Promise.resolve());
  const activeScreenRef=useRef<HTMLDivElement|null>(null);
  const screen=screens[index];
  const listen=search.get("mode")==="listen";
  const interactive=screen?.blocks.some(isInteractive)??false;
  const optionalPractice=screen?.interactionPolicy==="optional-practice";
  const optionalQuiz=Boolean(optionalPractice&&screen?.blocks[0]?.type==="matching-pairs"&&isPlainLanguageReview(screen.blocks[0]));
  const basicLawOverview=courseId==="basic-law"&&lesson.slug!=="exam-map"&&Boolean(screen?.blocks.some((block)=>block.type==="heading"&&block.text==="今課重點"));
  const practiceScreen=practiceScreenId?screens.find((item)=>item.id===practiceScreenId&&item.interactionPolicy==="optional-practice")??null:null;
  const canContinue=!interactive||Boolean(screen&&(resolved[screen.id]||(optionalPractice&&skipped[screen.id])));

  useEffect(()=>{saveScreenRef.current=saveScreen},[saveScreen]);
  useEffect(()=>{getLessonProgressRef.current=getLessonProgress},[getLessonProgress]);
  useEffect(()=>{
    const nextScreen=screens[index+1];
    if(!nextScreen)return;
    for(const block of nextScreen.blocks){
      if(block.type!=="image")continue;
      const source=coursivMediaUrl(block.localSrc??block.src);
      if(!source)continue;
      const image=new window.Image();
      image.decoding="async";
      image.src=source;
    }
  },[index,screens]);
  useEffect(()=>{localStorage.setItem(resolvedStorageKey,JSON.stringify(resolved))},[resolved,resolvedStorageKey]);
  useEffect(()=>{localStorage.setItem(skippedStorageKey,JSON.stringify(skipped))},[skipped,skippedStorageKey]);
  useEffect(()=>{if(!persistProgress)return;let active=true;void getLessonProgressRef.current(courseId,lesson.slug).then((progress)=>{if(!active)return;setResolved((current)=>({...current,...Object.fromEntries(progress.resolvedScreenIds.map((id)=>[id,true]))}));setSkipped((current)=>({...current,...Object.fromEntries(progress.skippedScreenIds.map((id)=>[id,true]))}));if(progress.lastScreenId&&!restartRequested){const remoteIndex=lessonScreenIndex(screens,progress.lastScreenId,courseId);if(remoteIndex>=0)setIndex(remoteIndex)}}).catch(()=>undefined);return()=>{active=false}},[courseId,lesson.slug,persistProgress,restartRequested,screens]);
  useEffect(()=>{if(!persistProgress||!screen)return;const operation=queue.current.catch(()=>undefined).then(()=>saveScreenRef.current(courseId,lesson.slug,screen.id));queue.current=operation;void operation.catch((reason)=>setError(reason instanceof Error?reason.message:"Unable to save this screen"))},[screen,courseId,lesson.slug,persistProgress]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>activeScreenRef.current?.scrollIntoView({behavior:"auto",block:"start"}));return()=>cancelAnimationFrame(frame)},[index]);
  const speak=useCallback(()=>{if(!screen||!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(spokenText(screen));utterance.lang="en-US";window.speechSynthesis.speak(utterance)},[screen]);
  useEffect(()=>{if(listen&&!screen?.audioSource)speak();return()=>window.speechSynthesis?.cancel()},[screen?.audioSource,listen,speak]);

  const resolve=async(targetScreen:CoursivLessonScreen,answer:ScreenAnswer)=>{
    localStorage.setItem(lessonStartedStorageKey(courseId,lesson.slug),"1");
    setError("");
    setResolved((current)=>({...current,[targetScreen.id]:true}));
    setSkipped((current)=>{const next={...current};delete next[targetScreen.id];return next});
    if(targetScreen.id===practiceScreenId)setReviewInProgress(false);
    if(!persistProgress)return;
    try{
      const operation=queue.current.catch(()=>undefined).then(()=>saveScreen(courseId,lesson.slug,targetScreen.id,{outcome:"answered",...answer}));
      queue.current=operation.then(()=>undefined);
      await operation;
    }catch(reason){
      setResolved((current)=>{const next={...current};delete next[targetScreen.id];return next});
      setError(reason instanceof Error?reason.message:"Unable to save this answer");
    }
  };
  const courseHref=backHref??`/course/${courseId}`;
  const restartLesson=async()=>{if(busy||!window.confirm("Restart this lesson? Your progress and answers for this lesson will be cleared."))return;setBusy(true);setError("");try{await queue.current;await resetLesson(courseId,lesson.slug);window.speechSynthesis?.cancel();localStorage.removeItem(resolvedStorageKey);localStorage.removeItem(skippedStorageKey);setResolved({});setSkipped({});setPracticeScreenId(null);setReviewInProgress(false);setIndex(0)}catch(reason){setError(reason instanceof Error?reason.message:"Unable to restart this lesson")}finally{setBusy(false)}};
  const advance=async()=>{await queue.current;localStorage.setItem(lessonStartedStorageKey(courseId,lesson.slug),"1");if(index<screens.length-1){setIndex((value)=>value+1);return}if(persistProgress)await completeLesson(courseId,lesson.slug);localStorage.removeItem(resolvedStorageKey);localStorage.removeItem(skippedStorageKey);router.push(completionHref??`${courseHref}?completedLesson=${encodeURIComponent(lesson.slug)}`)};
  const next=async()=>{if(!canContinue||busy)return;setBusy(true);setError("");try{await advance()}catch(reason){setError(reason instanceof Error?reason.message:"Unable to continue this lesson")}finally{setBusy(false)}};
  const openCurrentPractice=()=>{if(!screen||screen.interactionPolicy!=="optional-practice")return;setReviewInProgress(Boolean(resolved[screen.id]));setPracticeScreenId(screen.id)};
  const skipPractice=async()=>{if(!screen||screen.interactionPolicy!=="optional-practice"||busy)return;setBusy(true);setError("");try{localStorage.setItem(lessonStartedStorageKey(courseId,lesson.slug),"1");await queue.current;if(persistProgress)await saveScreen(courseId,lesson.slug,screen.id,{outcome:"skipped"});setSkipped((current)=>({...current,[screen.id]:true}));setResolved((current)=>{const next={...current};delete next[screen.id];return next});setPracticeScreenId(null);await advance()}catch(reason){setError(reason instanceof Error?reason.message:"Unable to skip this practice")}finally{setBusy(false)}};
  const chooseBasicLawPath=(target:"law"|"test")=>{if(busy)return;localStorage.setItem(lessonStartedStorageKey(courseId,lesson.slug),"1");const targetIndex=target==="law"?index+1:screens.findIndex((item)=>item.presentation==="knowledge-check");if(targetIndex>index)setIndex(targetIndex)};
  if(!screen)return <main className="canonical-lesson"><section><h1>Lesson content is empty</h1><button onClick={()=>router.push(courseHref)}><ButtonText>Return to course</ButtonText></button></section></main>;
  const showLessonFooter=!interactive||Boolean(resolved[screen.id])||optionalPractice;
  return (
    <main className="canonical-lesson">
      <header>
        <button onClick={()=>router.push(courseHref)} aria-label="Back to course"><Home/></button>
        <div className="canonical-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={screens.length} aria-valuenow={index}>
          <span style={{width:`${index/screens.length*100}%`}}/>
        </div>
        <button className="canonical-restart" type="button" disabled={index===0||busy} onClick={restartLesson} aria-label="Restart lesson" title="Restart lesson"><RotateCcw/></button>
        {lesson.hasAudio||screen.audioSource?<button onClick={speak} aria-label={listen?"Play narration":"Enable audio"}><Volume2/></button>:<span/>}
      </header>
      {listen&&screen.audioSource&&<audio className="canonical-audio" controls autoPlay src={screen.audioSource}/>}
      <section aria-label={`${courseTitle} · ${index+1}/${screens.length}`}>
        {screens.slice(0,index+1).map((visibleScreen,visibleIndex)=><div className={`canonical-screen${visibleIndex===index?" current":""}`} ref={visibleIndex===index?activeScreenRef:undefined} data-screen-id={visibleScreen.id} data-presentation={visibleScreen.presentation} key={visibleScreen.id}>{visibleScreen.interactionPolicy==="optional-practice"?<PracticePreview screen={visibleScreen} resolved={Boolean(resolved[visibleScreen.id])} onOpen={()=>{setReviewInProgress(Boolean(resolved[visibleScreen.id]));setPracticeScreenId(visibleScreen.id)}}/>:<ScreenContent screen={visibleScreen} current={visibleIndex===index} resolved={Boolean(resolved[visibleScreen.id])} onResolved={(answer)=>void resolve(visibleScreen,answer)}/>}</div>)}
        {error&&<p className="assistant-error" role="alert">{error}</p>}
      </section>
      {showLessonFooter&&(
        basicLawOverview?
          <footer className="basic-law-overview-actions">
            <button className="secondary" disabled={busy} onClick={()=>chooseBasicLawPath("law")}><BookOpen/><ButtonText>Read the full law</ButtonText></button>
            <button disabled={busy} onClick={()=>chooseBasicLawPath("test")}><ClipboardCheck/><ButtonText>Skip reading and start the quiz</ButtonText></button>
          </footer>:
          optionalQuiz&&!resolved[screen.id]?
            <OptionalQuizActions busy={busy} onStart={openCurrentPractice} onSkip={()=>void skipPractice()}/>:
            <footer>
              <button disabled={busy||(!optionalPractice&&!canContinue)} onClick={()=>optionalPractice&&!resolved[screen.id]?void skipPractice():void next()}>
                <ButtonText>{busy?"Saving…":optionalPractice&&!resolved[screen.id]?"Skip practice":index===screens.length-1?"Finish Lesson":"Continue"}</ButtonText>
              </button>
            </footer>
      )}
      {practiceScreen&&<div className="canonical-practice-overlay" role="dialog" aria-modal="true"><header><button onClick={()=>{setReviewInProgress(false);setPracticeScreenId(null)}} aria-label="Close practice"><X/></button></header><section><ScreenContent screen={practiceScreen} current resolved={Boolean(resolved[practiceScreen.id])} onResolved={(answer)=>void resolve(practiceScreen,answer)} onPlainLanguageRestart={()=>setReviewInProgress(true)}/>{error&&<p className="assistant-error" role="alert">{error}</p>}</section>{resolved[practiceScreen.id]&&!reviewInProgress&&<footer><div><strong>完成小測</strong><span>已完成所有題目，可以繼續課堂。</span></div><button onClick={()=>{const isCurrent=practiceScreen.id===screen.id;setReviewInProgress(false);setPracticeScreenId(null);if(isCurrent)void next()}}>{practiceScreen.id===screen.id?"繼續課堂":"關閉"}</button></footer>}</div>}
    </main>
  );
}
