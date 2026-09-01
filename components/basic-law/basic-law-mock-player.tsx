"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Flag, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLearner } from "@/components/member/learner-context";
import { SafeRichText } from "@/components/shared/safe-rich-text";
import { scrollQuestionAfterReset, scrollResultIntoView } from "@/components/shared/use-scroll-to-result";
import type { BasicLawMock, BasicLawQuestion } from "@/lib/basic-law-types";

type SavedMock={seconds:number;answers:Record<string,string>;flags:string[];index:number;submitted:boolean;score:number|null};

export function BasicLawMockPlayer({mock,questions,courseId="basic-law"}:{mock:BasicLawMock;questions:BasicLawQuestion[];courseId?:string}) {
  const router=useRouter();
  const {completeLesson}=useLearner();
  const storageKey=`basic-law.mock.v1:${mock.id}`;
  const [saved]=useState<SavedMock|null>(()=>{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem(storageKey)??"null") as SavedMock|null}catch{return null}});
  const [seconds,setSeconds]=useState(saved?.submitted?mock.durationMinutes*60:(saved?.seconds??mock.durationMinutes*60));
  const [answers,setAnswers]=useState<Record<string,string>>(saved?.submitted?{}:(saved?.answers??{}));
  const [flags,setFlags]=useState<Set<string>>(()=>new Set(saved?.submitted?[]:(saved?.flags??[])));
  const [index,setIndex]=useState(saved?.submitted?0:(saved?.index??0));
  const [submitted,setSubmitted]=useState(false);
  const [score,setScore]=useState<number|null>(null);
  const [confirmIncomplete,setConfirmIncomplete]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const answersRef=useRef(answers);
  const flagsRef=useRef(flags);
  useEffect(()=>{answersRef.current=answers},[answers]);
  useEffect(()=>{flagsRef.current=flags},[flags]);
  useEffect(()=>{if(!submitted||score===null)return;const frame=requestAnimationFrame(()=>scrollResultIntoView(document.querySelector<HTMLElement>(".bl-mock-result>div:first-child")));return()=>cancelAnimationFrame(frame)},[score,submitted]);

  const unanswered=questions.length-Object.keys(answers).length;
  const question=questions[index];
  const currentAnswer=question?answers[question.id]:undefined;
  const formattedTime=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;

  const finish=useCallback(async()=>{
    if(submitted||saving)return;
    const result=questions.reduce((total,item)=>total+(answersRef.current[item.id]===item.correctOptionId?1:0),0);
    setSaving(true);setError("");setScore(result);setSubmitted(true);setConfirmIncomplete(false);
    const previousBest=Number(localStorage.getItem(`basic-law.mock.best.v1:${mock.id}`)??0);
    localStorage.setItem(`basic-law.mock.best.v1:${mock.id}`,String(Math.max(previousBest,result)));
    localStorage.setItem(storageKey,JSON.stringify({seconds,answers:answersRef.current,flags:[...flagsRef.current],index,submitted:true,score:result} satisfies SavedMock));
    try{await completeLesson(courseId,mock.id)}catch(reason){setError(reason instanceof Error?reason.message:"未能儲存完成狀態")}finally{setSaving(false)}
  },[completeLesson,courseId,index,mock.id,questions,saving,seconds,storageKey,submitted]);

  const finishRef=useRef(finish);
  useEffect(()=>{finishRef.current=finish},[finish]);
  useEffect(()=>{if(submitted)return;const timer=window.setInterval(()=>setSeconds((value)=>{if(value<=1){window.clearInterval(timer);queueMicrotask(()=>void finishRef.current());return 0}return value-1}),1000);return()=>window.clearInterval(timer)},[submitted]);
  useEffect(()=>{if(submitted||seconds%5!==0)return;localStorage.setItem(storageKey,JSON.stringify({seconds,answers,flags:[...flags],index,submitted:false,score:null} satisfies SavedMock))},[answers,flags,index,seconds,storageKey,submitted]);

  const toggleFlag=()=>question&&setFlags((current)=>{const next=new Set(current);if(next.has(question.id))next.delete(question.id);else next.add(question.id);return next});
  const requestSubmit=()=>{if(unanswered>0&&!confirmIncomplete){setConfirmIncomplete(true);return}void finish()};
  const restart=()=>{localStorage.removeItem(storageKey);setSeconds(mock.durationMinutes*60);setAnswers({});setFlags(new Set());setIndex(0);setSubmitted(false);setScore(null);setConfirmIncomplete(false);setError("");scrollQuestionAfterReset(()=>document.querySelector<HTMLElement>(".bl-mock-question"))};
  const resultLabel=score!==null&&score>=mock.targetScore?"目標達成":score!==null&&score>=mock.passScore?"合格，但仲可以再穩啲":"未達合格線";

  if(submitted&&score!==null)return <main className="basic-law-mock"><header className="bl-mock-top"><button onClick={()=>router.push(`/course/${courseId}?completedLesson=${encodeURIComponent(mock.id)}`)}><ArrowLeft/> 返回課程</button><strong>{mock.title}</strong><span>Internal prototype</span></header><section className="bl-mock-result"><div className={score>=mock.targetScore?"target":score>=mock.passScore?"pass":"retry"}><ShieldCheck/><small>{resultLabel}</small><strong>{score}<span>/20</span></strong><p>合格線 {mock.passScore}/20 · 穩定目標 {mock.targetScore}/20</p></div><div className="bl-mock-review"><h2>逐題檢討</h2>{questions.map((item,questionIndex)=>{const chosen=answers[item.id];const correct=chosen===item.correctOptionId;return <details key={item.id}><summary><span>{correct?<Check/>:<X/>} 第 {questionIndex+1} 題</span><b>{correct?"Correct":`答案 ${item.correctOptionId}`}</b></summary><h3>{item.questionZh}</h3><p lang="en">{item.questionEn}</p><p><strong>你揀：</strong>{chosen??"未作答"}　<strong>正確：</strong>{item.correctOptionId}</p><SafeRichText value={item.explanationZh} className="bl-feedback-explanation" emphasizeFeedback highlights={[item.options.find((option)=>option.id===item.correctOptionId)?.labelZh??""]}/></details>})}</div>{error?<p className="assistant-error" role="alert">{error}</p>:null}<footer><button onClick={restart}><RotateCcw/>重新挑戰</button><button className="primary" onClick={()=>router.push("/course/basic-law-practice/practice")}>針對弱項操練</button></footer></section></main>;

  return <main className="basic-law-mock"><header className="bl-mock-top"><button onClick={()=>router.push(`/course/${courseId}`)}><ArrowLeft/> 暫停並返回</button><strong>{mock.title}</strong><span className={seconds<300?"urgent":""}><Clock3/> {formattedTime}</span></header><div className="bl-mock-progress"><span style={{width:`${Object.keys(answers).length/questions.length*100}%`}}/></div><section className="bl-mock-layout"><aside><h2>題目</h2><div>{questions.map((item,questionIndex)=><button className={`${questionIndex===index?"active":""} ${answers[item.id]?"answered":""}`} onClick={()=>{setIndex(questionIndex);setConfirmIncomplete(false)}} key={item.id}>{questionIndex+1}{flags.has(item.id)?<Flag/>:null}</button>)}</div><p>{Object.keys(answers).length}/20 已答 · {flags.size} 已標記</p><button className="submit" onClick={requestSubmit}>{confirmIncomplete?`仍然交卷（${unanswered} 題未答）`:"交卷"}</button>{confirmIncomplete?<small><AlertTriangle/> 未答題會當作答錯。</small>:null}</aside><article className="bl-mock-question"><div><span>QUESTION {index+1} OF {questions.length}</span><button className={question&&flags.has(question.id)?"flagged":""} onClick={toggleFlag}><Flag/> {question&&flags.has(question.id)?"已標記":"稍後再看"}</button></div><h1>{question?.questionZh}</h1><p lang="en">{question?.questionEn}</p><div className="bl-bank-options">{question?.options.map((option)=><button className={currentAnswer===option.id?"selected":""} onClick={()=>question&&setAnswers((current)=>({...current,[question.id]:option.id}))} key={option.id}><b>{option.id}</b><span><strong>{option.labelZh}</strong><small lang="en">{option.labelEn}</small></span></button>)}</div><footer><button disabled={index===0} onClick={()=>{setIndex((value)=>Math.max(0,value-1));setConfirmIncomplete(false)}}><ChevronLeft/>上一題</button><button disabled={index===questions.length-1} onClick={()=>{setIndex((value)=>Math.min(questions.length-1,value+1));setConfirmIncomplete(false)}}>下一題<ChevronRight/></button></footer></article></section></main>;
}
