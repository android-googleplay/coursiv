"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Filter, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLearner } from "@/components/member/learner-context";
import { SafeRichText } from "@/components/shared/safe-rich-text";
import { scrollQuestionAfterReset, useScrollToResult } from "@/components/shared/use-scroll-to-result";
import { compareBasicLawQuestions } from "@/lib/basic-law-question-order";
import type { BasicLawDifficulty, BasicLawDomain, BasicLawQuestion, BasicLawTrapType } from "@/lib/basic-law-types";

const domainLabels: Record<BasicLawDomain,string> = { "basic-law":"《基本法》", nsl:"《香港國安法》" };
const trapLabels: Record<BasicLawTrapType,string> = { "negative-wording":"否定字眼", numbers:"數字期限", authority:"權力主體", wording:"近義字眼" };

export function BasicLawPracticeBank({questions,courseId="basic-law-practice"}:{questions:BasicLawQuestion[];courseId?:string}) {
  const router=useRouter();
  const {state:learnerState,completeLesson}=useLearner();
  const completionRequested=useRef(false);
  const [domain,setDomain]=useState<"all"|BasicLawDomain>("all");
  const [difficulty,setDifficulty]=useState<"all"|BasicLawDifficulty>("all");
  const [trap,setTrap]=useState<"all"|BasicLawTrapType>("all");
  const [article,setArticle]=useState("all");
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [checked,setChecked]=useState(false);
  const [correctCount,setCorrectCount]=useState(0);
  const [saveError,setSaveError]=useState("");
  const feedbackRef=useScrollToResult<HTMLDivElement>(checked);

  const articles=useMemo(()=>Array.from(new Set(questions.filter((question)=>domain==="all"||question.domain===domain).map((question)=>question.article).filter((value):value is number=>value!==null))).sort((a,b)=>a-b),[domain,questions]);
  const filtered=useMemo(()=>questions.filter((question)=>(domain==="all"||question.domain===domain)&&(difficulty==="all"||question.difficulty===difficulty)&&(trap==="all"||question.trapType===trap)&&(article==="all"||question.article===Number(article))).sort(compareBasicLawQuestions),[article,difficulty,domain,questions,trap]);
  const question=filtered[index%Math.max(filtered.length,1)];
  const correct=Boolean(checked&&question&&selected===question.correctOptionId);
  const lessonComplete=learnerState.courses[courseId]?.completedLessonIds.includes("practice-bank")??false;

  const changeFilter=(apply:()=>void)=>{apply();setIndex(0);setSelected(null);setChecked(false)};
  const next=()=>{setIndex((value)=>filtered.length?((value+1)%filtered.length):0);setSelected(null);setChecked(false)};
  const retry=()=>{const card=document.querySelector<HTMLElement>(".bl-bank-card");setSelected(null);setChecked(false);scrollQuestionAfterReset(()=>card)};
  const check=()=>{
    if(!selected||!question)return;
    setChecked(true);
    if(selected===question.correctOptionId)setCorrectCount((value)=>value+1);
    if(!lessonComplete&&!completionRequested.current){
      completionRequested.current=true;
      setSaveError("");
      void completeLesson(courseId,"practice-bank").catch(()=>{
        completionRequested.current=false;
        setSaveError("暫時未能儲存完成進度，請再試一次。");
      });
    }
  };

  return <main className="basic-law-bank">
    <header><button onClick={()=>router.push("/courses")} aria-label="Back to courses"><ArrowLeft/></button><div><small>INTERNAL BLNST PROTOTYPE</small><h1>題庫操練場 Practice Bank</h1><p>{questions.length} 題 · 即時改錯 · 按弱項篩選</p></div><span><ShieldCheck/> {correctCount} correct</span></header>
    {saveError?<p className="assistant-error" role="alert">{saveError}</p>:null}
    <section className="bl-bank-layout">
      <aside><h2><Filter/> 選擇操練範圍</h2><label>法律範圍<select value={domain} onChange={(event)=>changeFilter(()=>setDomain(event.target.value as typeof domain))}><option value="all">全部 {questions.length} 題</option><option value="basic-law">《基本法》</option><option value="nsl">《香港國安法》</option></select></label><label>條文<select value={article} onChange={(event)=>changeFilter(()=>setArticle(event.target.value))}><option value="all">全部條文</option>{articles.map((value)=><option value={value} key={value}>第 {value} 條</option>)}</select></label><label>陷阱類型<select value={trap} onChange={(event)=>changeFilter(()=>setTrap(event.target.value as typeof trap))}><option value="all">全部陷阱</option>{Object.entries(trapLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>難度<select value={difficulty} onChange={(event)=>changeFilter(()=>setDifficulty(event.target.value as typeof difficulty))}><option value="all">全部難度</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><p><strong>{filtered.length}</strong> 題符合篩選</p></aside>
      <article className="bl-bank-card">{question?<><div className="bl-bank-meta"><span>{domainLabels[question.domain]}</span><span>{question.article?`第 ${question.article} 條`:"附件／相關文件"}</span><span>{trapLabels[question.trapType]}</span><b>{index+1}/{filtered.length}</b></div><h2>{question.questionZh}</h2><p lang="en">{question.questionEn}</p><div className="bl-bank-options">{question.options.map((option)=>{const isSelected=selected===option.id;const state=checked?(option.id===question.correctOptionId?"correct":isSelected?"incorrect":""):isSelected?"selected":"";return <button className={state} disabled={checked} onClick={()=>setSelected(option.id)} key={option.id}><b>{option.id}</b><span><strong>{option.labelZh}</strong><small lang="en">{option.labelEn}</small></span>{checked&&option.id===question.correctOptionId?<Check/>:checked&&isSelected?<X/>:null}</button>})}</div>{checked?<div ref={feedbackRef} className={`bl-bank-feedback ${correct?"correct":"incorrect"}`}><strong>{correct?"答啱！":"未中，再鎖定條文用字"}</strong><SafeRichText value={question.explanationZh} className="bl-feedback-explanation" emphasizeFeedback highlights={[question.options.find((option)=>option.id===question.correctOptionId)?.labelZh??""]}/><a href={question.officialSource} target="_blank" rel="noopener noreferrer">查看官方來源</a></div>:null}<footer>{checked?<button onClick={retry}><RotateCcw/>再答一次</button>:<span/>}<button className="primary" disabled={!selected} onClick={checked?next:check}>{checked?<>下一題 <ArrowRight/></>:"檢查答案"}</button></footer></>:<div className="bl-bank-empty"><h2>暫時冇符合條件嘅題目</h2><button onClick={()=>{setDomain("all");setDifficulty("all");setTrap("all");setArticle("all")}}>清除篩選</button></div>}</article>
    </section>
  </main>;
}
