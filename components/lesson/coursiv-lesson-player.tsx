"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, RotateCcw, Volume2, X } from "lucide-react";
import type { CoursivContentBlock, CoursivLesson, CoursivLessonScreen } from "@/lib/coursiv-content";
import { useLearner } from "@/components/member/learner-context";
import { SafeRichText } from "@/components/shared/safe-rich-text";
import { richTextEditorHtml, richTextPlainText } from "@/lib/rich-text";

type ChoiceBlock = Extract<CoursivContentBlock,{type:"single-choice"|"multi-choice"|"true-false"}>;
type ScreenAnswer = { blockId:string;values:string[] };

function spokenText(screen:CoursivLessonScreen) {
  const plain=(value:string)=>richTextPlainText(value);
  return screen.blocks.map((block)=>{
    if(block.type==="heading"||block.type==="paragraph")return plain(block.text);
    if(block.type==="list")return block.items.join(". ");
    if(block.type==="callout")return `${block.title??""}. ${plain(block.text)}`;
    if(block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false")return `${plain(block.question)}. ${block.options.map((option)=>option.label).join(". ")}`;
    if(block.type==="fill-in-blank")return `${block.prompt}. ${plain(block.template)}`;
    if(block.type==="ordering-task"||block.type==="matching-pairs"||block.type==="prompt-fixer"||block.type==="practice")return `${block.title}. ${block.prompt??""}`;
    if(block.type==="survey")return plain(block.question);
    if(block.type==="feedback")return `${block.title??""}. ${plain(block.text)}`;
    return block.type==="unknown"?block.text??"":"";
  }).filter(Boolean).join(". ");
}

function Feedback({correct,text,onRetry}:{correct:boolean;text?:string;onRetry?:()=>void}) {
  const message=text??(correct?"Great work — you can continue.":"Review your answer and try again.");
  return <div className={`canonical-feedback ${correct?"correct":"incorrect"}`} role="status"><h2>{correct?<Check/>:<X/>}{correct?"Correct answer":"Not quite"}</h2><SafeRichText value={message}/>{!correct&&onRetry&&<button onClick={onRetry}><RotateCcw/>Try again</button>}</div>;
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
  const initialCorrectIds=block.options.filter((option)=>option.isCorrect).map((option)=>option.id);
  const [selected,setSelected]=useState<string[]>(initiallyResolved?initialCorrectIds:[]);const [submitted,setSubmitted]=useState(initiallyResolved);
  const correctIds=useMemo(()=>block.options.filter((option)=>option.isCorrect).map((option)=>option.id).sort(),[block.options]);
  const correct=submitted&&selected.slice().sort().join("|")===correctIds.join("|");
  const multiple=block.type==="multi-choice";
  const choose=(id:string)=>{if(!submitted)setSelected((current)=>multiple?(current.includes(id)?current.filter((item)=>item!==id):[...current,id]):[id])};
  const submit=()=>{setSubmitted(true);if(selected.slice().sort().join("|")===correctIds.join("|"))onResolved({blockId:block.id,values:selected})};
  const response=correct?block.feedbackCorrect:block.feedbackIncorrect;
  return <div className="canonical-quiz"><SafeRichText value={block.question} as="h1" inline/>{block.instruction&&<p>{block.instruction}</p>}<div className="canonical-options" role={multiple?"group":"radiogroup"}>{block.options.map((option)=><button type="button" role={multiple?"checkbox":"radio"} aria-checked={selected.includes(option.id)} className={selected.includes(option.id)?"selected":""} disabled={submitted} onClick={()=>choose(option.id)} key={option.id}>{option.image&&<img src={option.image} alt=""/>}<i/>{option.label}</button>)}</div>{!submitted?<button className="canonical-submit" disabled={!selected.length} onClick={submit}>Submit</button>:<Feedback correct={correct} text={response?.text} onRetry={()=>{setSelected([]);setSubmitted(false)}}/>}</div>;
}

function Fill({block,onResolved,title,tool,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"fill-in-blank"}>;onResolved:(answer:ScreenAnswer)=>void;title?:string;tool?:CoursivLessonScreen["practiceTool"];initiallyResolved?:boolean}) {
  const [selected,setSelected]=useState<string[]>(initiallyResolved?block.correctTokens:[]);const [submitted,setSubmitted]=useState(initiallyResolved);const correct=submitted&&selected.join("|")===block.correctTokens.join("|");
  const check=()=>{setSubmitted(true);if(selected.join("|")===block.correctTokens.join("|"))onResolved({blockId:block.id,values:selected})};
  return <div className="canonical-fill"><h1>{title??block.prompt}</h1>{title&&<p>{block.prompt}</p>}<div className="practice-tool-label">{tool?.icon?<img src={tool.icon} alt=""/>:<span>✦</span>} <strong>{tool?.name??"AI Tool"}</strong></div><FilledTemplate template={block.template} selected={selected} submitted={submitted} onRemove={(slot)=>setSelected((current)=>current.filter((_,index)=>index!==slot))}/><div className="canonical-tokens">{block.tokens.map((token,index)=><button disabled={submitted||selected.filter((item)=>item===token).length>=block.tokens.filter((item)=>item===token).length} onClick={()=>setSelected((current)=>[...current,token])} key={`${token}-${index}`}>{token}</button>)}</div>{!submitted?<button className="canonical-submit" disabled={selected.length!==block.placeholders.length} onClick={check}>Check</button>:<Feedback correct={correct} text={correct?(block.feedback?.text??block.exampleResponse):undefined} onRetry={()=>{setSelected([]);setSubmitted(false)}}/>}</div>;
}

function Ordering({block,onResolved,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"ordering-task"}>;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const [selected,setSelected]=useState<string[]>(initiallyResolved?block.correctItems:[]);const [submitted,setSubmitted]=useState(initiallyResolved);const correct=submitted&&selected.join("|")===block.correctItems.join("|");
  const remaining=block.items.filter((item)=>!selected.includes(item));const check=()=>{setSubmitted(true);if(selected.join("|")===block.correctItems.join("|"))onResolved({blockId:block.id,values:selected})};
  return <div className="canonical-order"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<div className="canonical-filled ordered">{selected.length?selected.map((item,index)=><button disabled={submitted} onClick={()=>setSelected((current)=>current.filter((_,i)=>i!==index))} key={item}><b>{index+1}</b>{item}</button>):<span>Choose the steps in the correct order</span>}</div><div className="canonical-tokens stacked">{remaining.map((item)=><button disabled={submitted} onClick={()=>setSelected((current)=>[...current,item])} key={item}>{item}</button>)}</div>{!submitted?<button className="canonical-submit" disabled={selected.length!==block.items.length} onClick={check}>Check</button>:<Feedback correct={correct} text={(correct?block.feedbackCorrect:block.feedbackIncorrect)?.text} onRetry={()=>{setSelected([]);setSubmitted(false)}}/>}</div>;
}

function Matching({block,onResolved,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"matching-pairs"}>;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const [answers,setAnswers]=useState<Record<string,string>>(initiallyResolved?Object.fromEntries(block.pairs.map((pair)=>[pair.id,pair.right])):{});const [active,setActive]=useState<string|null>(null);const [submitted,setSubmitted]=useState(initiallyResolved);const values=block.pairs.map((pair)=>answers[pair.id]??"");const correct=submitted&&values.every((value,index)=>value===block.pairs[index].right);
  const used=new Set(values);const check=()=>{setSubmitted(true);if(values.every((value,index)=>value===block.pairs[index].right))onResolved({blockId:block.id,values})};
  return <div className="canonical-match"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<div className="match-grid"><div>{block.pairs.map((pair)=><button className={active===pair.id?"active":""} disabled={submitted} onClick={()=>setActive(pair.id)} key={pair.id}>{pair.left}<small>{answers[pair.id]??"Select a match"}</small></button>)}</div><div>{block.pairs.map((pair)=><button disabled={submitted||used.has(pair.right)} onClick={()=>{if(active){setAnswers((current)=>({...current,[active]:pair.right}));setActive(null)}}} key={pair.right}>{pair.right}</button>)}</div></div>{!submitted?<button className="canonical-submit" disabled={values.some((value)=>!value)} onClick={check}>Check</button>:<Feedback correct={correct} onRetry={()=>{setAnswers({});setSubmitted(false)}}/>}</div>;
}

function PromptFixer({block,onResolved,initiallyResolved=false}:{block:Extract<CoursivContentBlock,{type:"prompt-fixer"}>;onResolved:(answer:ScreenAnswer)=>void;initiallyResolved?:boolean}) {
  const [selected,setSelected]=useState<string|null>(initiallyResolved?(block.options.find((item)=>item.isCorrect)?.id??null):null);const [submitted,setSubmitted]=useState(initiallyResolved);const option=block.options.find((item)=>item.id===selected);const correct=Boolean(submitted&&option?.isCorrect);
  const submit=()=>{setSubmitted(true);if(option?.isCorrect)onResolved({blockId:block.id,values:[option.id]})};
  return <div className="canonical-prompt-fixer"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<div className="prompt-template">{block.template}</div><div className="canonical-options" role="radiogroup">{block.options.filter((item)=>!item.label.match(/^style$/i)).map((item)=><button role="radio" aria-checked={selected===item.id} className={selected===item.id?"selected":""} disabled={submitted} onClick={()=>setSelected(item.id)} key={item.id}><i/>{item.label}</button>)}</div>{option?.outputLocalImage&&<img className="prompt-output" src={option.outputLocalImage} alt="Generated example"/>}{option?.outputText&&<p>{option.outputText}</p>}{!submitted?<button className="canonical-submit" disabled={!selected} onClick={submit}>Submit</button>:<Feedback correct={correct} text={(correct?block.feedbackCorrect:block.feedbackIncorrect)?.text} onRetry={()=>{setSelected(null);setSubmitted(false)}}/>}</div>;
}

function Survey({block,onResolved}:{block:Extract<CoursivContentBlock,{type:"survey"}>;onResolved:(answer:ScreenAnswer)=>void}) {const [selected,setSelected]=useState<string|null>(null);return <div className="canonical-quiz"><SafeRichText value={block.question} as="h1" inline/><div className="canonical-options" role="radiogroup">{block.options.map((option)=><button role="radio" aria-checked={selected===option.id} className={selected===option.id?"selected":""} onClick={()=>setSelected(option.id)} key={option.id}><i/>{option.label}</button>)}</div><button className="canonical-submit" disabled={!selected} onClick={()=>selected&&onResolved({blockId:block.id,values:[selected]})}>Continue</button></div>}

function Static({block,onResolved}:{block:CoursivContentBlock;onResolved:(answer:ScreenAnswer)=>void}) {
  if(block.type==="heading")return <SafeRichText value={block.text} inline as={block.level<=2?"h1":"h2"}/>;
  if(block.type==="paragraph")return <SafeRichText value={block.text}/>;
  if(block.type==="list"){const Tag=block.ordered?"ol":"ul";return <Tag>{block.items.map((item)=><li key={item}>{item}</li>)}</Tag>}
  if(block.type==="callout")return <aside className={`canonical-callout ${block.tone??""}`}>{block.title&&<strong>{block.title}</strong>}<SafeRichText value={block.text}/></aside>;
  if(block.type==="image")return <figure><img src={block.localSrc??block.src} alt={block.alt}/>{block.alt&&<figcaption>{block.alt}</figcaption>}</figure>;
  if(block.type==="video")return <video controls playsInline poster={block.poster} src={block.src}/>;
  if(block.type==="practice")return <div className="canonical-practice"><h1>{block.title}</h1>{block.prompt&&<p>{block.prompt}</p>}<button className="canonical-submit" onClick={()=>onResolved({blockId:block.id,values:["submitted"]})}>I&apos;ve completed this practice</button></div>;
  if(block.type==="feedback")return <div className={`canonical-feedback ${block.correct===false?"incorrect":"correct"}`}><h2>{block.title}</h2><SafeRichText value={block.text}/></div>;
  if(block.type==="unknown")return <div className="canonical-unknown"><small>{block.sourceType}</small>{block.text&&<p>{block.text}</p>}</div>;
  return null;
}

function isInteractive(block:CoursivContentBlock) {return ["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type)}

function ScreenContent({screen,onResolved,resolved=false}:{screen:CoursivLessonScreen;onResolved:(answer:ScreenAnswer)=>void;resolved?:boolean}) {
  return <>{screen.blocks.map((block)=>block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false"?<Choice key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="fill-in-blank"?<Fill key={block.id} block={block} title={screen.title} tool={screen.practiceTool} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="ordering-task"?<Ordering key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="matching-pairs"?<Matching key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="prompt-fixer"?<PromptFixer key={block.id} block={block} initiallyResolved={resolved} onResolved={onResolved}/>:block.type==="survey"?<Survey key={block.id} block={block} onResolved={onResolved}/>:<Static key={block.id} block={block} onResolved={onResolved}/>)}</>;
}

function PracticePreview({screen,resolved,onOpen}:{screen:CoursivLessonScreen;resolved:boolean;onOpen:()=>void}) {
  const block=screen.blocks[0];
  const prompt=block&&"prompt" in block?block.prompt:undefined;
  return <div className={`canonical-practice-preview ${resolved?"completed":""}`}>{resolved&&<span><Check/>Task completed</span>}<h1>{screen.title??("title" in (block??{})?String((block as {title?:string}).title??"Guided practice"):"Guided practice")}</h1>{prompt&&<p>{prompt}</p>}<button onClick={onOpen}>{resolved?"Review practice":"Open Playground"}</button></div>;
}

export function CoursivLessonPlayer({courseId,courseTitle,lesson}:{courseId:string;courseTitle:string;lesson:CoursivLesson}) {
  const router=useRouter();
  const search=useSearchParams();
  const {state,saveScreen,getLessonProgress,completeLesson}=useLearner();
  const saveScreenRef=useRef(saveScreen);
  const getLessonProgressRef=useRef(getLessonProgress);
  const screens:CoursivLessonScreen[]=lesson.screens?.length?lesson.screens:(lesson.blocks??[]).map((block,index)=>({id:block.id,sourcePageId:"legacy",order:index,type:block.type,presentation:"content",interactionPolicy:isInteractive(block)?"required-interaction":"read",blocks:[block]}));
  const savedId=state.courses[courseId]?.lastLessonId===lesson.slug?state.courses[courseId]?.lastScreenId:null;
  const savedIndex=Math.max(0,screens.findIndex((item)=>item.id===savedId||item.blocks.some((block)=>block.id===savedId)));
  const resolvedStorageKey=`coursiv.resolved.v3:${courseId}:${lesson.slug}`;
  const skippedStorageKey=`coursiv.skipped.v3:${courseId}:${lesson.slug}`;
  const readStored=(key:string)=>{if(typeof window==="undefined")return{};try{return JSON.parse(localStorage.getItem(key)??"{}") as Record<string,boolean>}catch{return{}}};
  const [index,setIndex]=useState(savedIndex);
  const [resolved,setResolved]=useState<Record<string,boolean>>(()=>readStored(resolvedStorageKey));
  const [skipped,setSkipped]=useState<Record<string,boolean>>(()=>readStored(skippedStorageKey));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [practiceOpen,setPracticeOpen]=useState(false);
  const queue=useRef(Promise.resolve());
  const activeScreenRef=useRef<HTMLDivElement|null>(null);
  const autoOpenedPractice=useRef<string|null>(null);
  const screen=screens[index];
  const listen=search.get("mode")==="listen";
  const interactive=screen?.blocks.some(isInteractive)??false;
  const optionalPractice=screen?.interactionPolicy==="optional-practice";
  const canContinue=!interactive||Boolean(screen&&(resolved[screen.id]||(optionalPractice&&skipped[screen.id])));

  useEffect(()=>{saveScreenRef.current=saveScreen},[saveScreen]);
  useEffect(()=>{getLessonProgressRef.current=getLessonProgress},[getLessonProgress]);
  useEffect(()=>{localStorage.setItem(resolvedStorageKey,JSON.stringify(resolved))},[resolved,resolvedStorageKey]);
  useEffect(()=>{localStorage.setItem(skippedStorageKey,JSON.stringify(skipped))},[skipped,skippedStorageKey]);
  useEffect(()=>{let active=true;void getLessonProgressRef.current(courseId,lesson.slug).then((progress)=>{if(!active)return;setResolved((current)=>({...current,...Object.fromEntries(progress.resolvedScreenIds.map((id)=>[id,true]))}));setSkipped((current)=>({...current,...Object.fromEntries(progress.skippedScreenIds.map((id)=>[id,true]))}));if(progress.lastScreenId){const remoteIndex=screens.findIndex((item)=>item.id===progress.lastScreenId||item.blocks.some((block)=>block.id===progress.lastScreenId));if(remoteIndex>=0)setIndex(remoteIndex)}}).catch(()=>undefined);return()=>{active=false}},[courseId,lesson.slug,screens]);
  useEffect(()=>{if(!screen)return;const operation=queue.current.catch(()=>undefined).then(()=>saveScreenRef.current(courseId,lesson.slug,screen.id));queue.current=operation;void operation.catch((reason)=>setError(reason instanceof Error?reason.message:"Unable to save this screen"))},[screen,courseId,lesson.slug]);
  useEffect(()=>{if(!screen)return;if(screen.interactionPolicy==="optional-practice"&&autoOpenedPractice.current!==screen.id){autoOpenedPractice.current=screen.id;setPracticeOpen(!resolved[screen.id]&&!skipped[screen.id])}if(index===0)return;const frame=requestAnimationFrame(()=>activeScreenRef.current?.scrollIntoView({behavior:index===savedIndex?"auto":"smooth",block:"start"}));return()=>cancelAnimationFrame(frame)},[index,screen,resolved,skipped,savedIndex]);
  const speak=useCallback(()=>{if(!screen||!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(spokenText(screen));utterance.lang="en-US";window.speechSynthesis.speak(utterance)},[screen]);
  useEffect(()=>{if(listen&&!screen?.audioSource)speak();return()=>window.speechSynthesis?.cancel()},[screen?.audioSource,listen,speak]);

  const resolve=async(targetScreen:CoursivLessonScreen,answer:ScreenAnswer)=>{
    setError("");
    setResolved((current)=>({...current,[targetScreen.id]:true}));
    setSkipped((current)=>{const next={...current};delete next[targetScreen.id];return next});
    try{
      const operation=queue.current.catch(()=>undefined).then(()=>saveScreen(courseId,lesson.slug,targetScreen.id,{outcome:"answered",...answer}));
      queue.current=operation.then(()=>undefined);
      await operation;
    }catch(reason){
      setResolved((current)=>{const next={...current};delete next[targetScreen.id];return next});
      setError(reason instanceof Error?reason.message:"Unable to save this answer");
    }
  };
  const advance=async()=>{await queue.current;if(index<screens.length-1){setIndex((value)=>value+1);return}await completeLesson(courseId,lesson.slug);localStorage.removeItem(resolvedStorageKey);localStorage.removeItem(skippedStorageKey);router.push(`/course/${courseId}`)};
  const next=async()=>{if(!canContinue||busy)return;setBusy(true);setError("");try{await advance()}catch(reason){setError(reason instanceof Error?reason.message:"Unable to continue this lesson")}finally{setBusy(false)}};
  const skipPractice=async()=>{if(!screen||screen.interactionPolicy!=="optional-practice"||busy)return;setBusy(true);setError("");try{await queue.current;await saveScreen(courseId,lesson.slug,screen.id,{outcome:"skipped"});setSkipped((current)=>({...current,[screen.id]:true}));setResolved((current)=>{const next={...current};delete next[screen.id];return next});setPracticeOpen(false);await advance()}catch(reason){setError(reason instanceof Error?reason.message:"Unable to skip this practice")}finally{setBusy(false)}};
  if(!screen)return <main className="canonical-lesson"><section><h1>Lesson content is empty</h1><button onClick={()=>router.push(`/course/${courseId}`)}>Return to course</button></section></main>;
  const showLessonFooter=!interactive||Boolean(resolved[screen.id])||optionalPractice;
  return <main className="canonical-lesson"><header><button onClick={()=>router.push(`/course/${courseId}`)} aria-label="Back to course"><ArrowLeft/></button><div><span style={{width:`${index/screens.length*100}%`}}/></div>{lesson.hasAudio||screen.audioSource?<button onClick={speak} aria-label={listen?"Play narration":"Enable audio"}><Volume2/></button>:<span/>}</header>{listen&&screen.audioSource&&<audio className="canonical-audio" controls autoPlay src={screen.audioSource}/>}<section><small>{courseTitle.toUpperCase()} · {index+1}/{screens.length}</small>{screens.slice(0,index+1).map((visibleScreen,visibleIndex)=><div className="canonical-screen" ref={visibleIndex===index?activeScreenRef:undefined} data-screen-id={visibleScreen.id} data-presentation={visibleScreen.presentation} key={visibleScreen.id}>{visibleScreen.interactionPolicy==="optional-practice"?<PracticePreview screen={visibleScreen} resolved={Boolean(resolved[visibleScreen.id])} onOpen={()=>setPracticeOpen(true)}/>:<ScreenContent screen={visibleScreen} resolved={Boolean(resolved[visibleScreen.id])} onResolved={(answer)=>void resolve(visibleScreen,answer)}/>}</div>)}{error&&<p className="assistant-error" role="alert">{error}</p>}</section>{showLessonFooter&&<footer><button disabled={busy||(!optionalPractice&&!canContinue)} onClick={()=>optionalPractice&&!resolved[screen.id]?void skipPractice():void next()}>{busy?"Saving…":optionalPractice&&!resolved[screen.id]?"Skip practice":index===screens.length-1?"Finish Lesson":"Continue"}</button></footer>}{practiceOpen&&optionalPractice&&<div className="canonical-practice-overlay" role="dialog" aria-modal="true"><header><button onClick={()=>setPracticeOpen(false)} aria-label="Close practice"><X/></button></header><section><ScreenContent screen={screen} resolved={Boolean(resolved[screen.id])} onResolved={(answer)=>void resolve(screen,answer)}/>{error&&<p className="assistant-error" role="alert">{error}</p>}</section>{resolved[screen.id]&&<footer><div><strong>Amazing!</strong><span>You&apos;re right on track with your approach</span></div><button onClick={()=>{setPracticeOpen(false);void next()}}>Continue</button></footer>}</div>}</main>;
}
