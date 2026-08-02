"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Lightbulb, Play, Volume2 } from "lucide-react";
import { allCourseLessons, courseCatalog, getCourse } from "@/lib/member-data";
import { useLearner } from "@/components/member/learner-context";
import { lessonGuidance } from "@/lib/lesson-content";

function titleFromId(id:string){return id.split("-").map((word)=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}

export function GenericLessonPlayer(){
  const params=useParams<{courseId:string;lessonId:string}>();const search=useSearchParams();const router=useRouter();const {state,saveScreen,completeLesson}=useLearner();const courseExists=courseCatalog.some((item)=>item.id===params.courseId);const course=getCourse(params.courseId);const lesson=allCourseLessons(course).find((item)=>item.id===params.lessonId);const lessonExists=courseExists&&Boolean(lesson);const title=lesson?.title??titleFromId(params.lessonId);const saved=state.courses[course.id]?.lastLessonId===params.lessonId?Number(state.courses[course.id]?.lastScreenId?.replace("step-","")??0):0;const [step,setStep]=useState(Math.min(Math.max(saved,0),3));const [choice,setChoice]=useState<number|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const saveQueue=useRef<Promise<void>>(Promise.resolve());const listen=search.get("mode")==="listen";
  const guidance=useMemo(()=>lessonGuidance(title,course.title),[course.title,title]);
  const screens=useMemo(()=>[
    {heading:`Why ${title} matters`,body:guidance.objective},
    {heading:"Use a five-part working method",body:`Work through ${guidance.framework.map(([label])=>label).join(", ")}. Each part removes a different source of guesswork.`},
    {heading:"Try a practical decision",body:`Which instruction gives an AI assistant the best chance of helping with ${title}?`},
    {heading:"Your next action",body:guidance.practice},
  ],[guidance,title]);
  const screen=screens[step];
  useEffect(()=>{if(!lessonExists)return;const operation=saveQueue.current.catch(()=>undefined).then(()=>saveScreen(course.id,params.lessonId,`step-${step}`));saveQueue.current=operation;void operation.catch((reason)=>setError(reason instanceof Error?reason.message:"Unable to save this screen"))},[course.id,lessonExists,params.lessonId,saveScreen,step]);
  const speak=useCallback(()=>{if(!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(`${screen.heading}. ${screen.body}`);utterance.lang="en-US";window.speechSynthesis.speak(utterance)},[screen]);
  useEffect(()=>{if(listen)speak();return()=>window.speechSynthesis?.cancel()},[listen,speak]);
  const next=async()=>{if(!lessonExists||step===2&&choice!==1||busy)return;setError("");if(step<screens.length-1){setStep((value)=>value+1);setChoice(null);window.scrollTo({top:0,behavior:"smooth"});return;}setBusy(true);try{await saveQueue.current;await completeLesson(course.id,params.lessonId);router.push(`/course/${course.id}`)}catch(reason){setError(reason instanceof Error?reason.message:"Unable to save learning progress")}finally{setBusy(false)}};
  if(!lessonExists)return <main className="generic-lesson"><section><h1>Lesson not found</h1><p>This link does not match a lesson in this Coursiv course.</p><button className="member-primary" onClick={()=>router.push(courseExists?`/course/${course.id}`:"/courses")}>Return to Courses</button></section></main>;
  return <main className="generic-lesson"><header><button onClick={()=>router.push(`/course/${course.id}`)} aria-label="Back to course"><ArrowLeft/></button><div><span style={{width:`${((step+1)/screens.length)*100}%`}}/></div><button onClick={speak} aria-label="Play narration"><Volume2/></button></header><section><small>{course.title.toUpperCase()} · LESSON {allCourseLessons(course).findIndex((item)=>item.id===params.lessonId)+1}</small><h1>{screen.heading}</h1><p>{screen.body}</p>{step===0&&<div className="lesson-principle"><Lightbulb/><strong>{guidance.principle}</strong><span>{guidance.explanation}</span></div>}{step===1&&<ol className="clear-framework">{guidance.framework.map(([label,detail])=><li key={label}><i>{label[0]}</i><span><strong>{label}</strong><small>{detail}</small></span></li>)}</ol>}{step===2&&<div className="generic-choices"><button className={choice===0?"selected":""} onClick={()=>setChoice(0)}>{guidance.weakInstruction}</button><button className={choice===1?"selected correct":""} onClick={()=>setChoice(1)}>{guidance.strongInstruction}</button>{choice===0&&<p>Add the missing result, boundaries, and review method.</p>}{choice===1&&<p><Check/>{guidance.explanation}</p>}</div>}{step===3&&<div className="lesson-principle"><Play/><strong>Practise immediately</strong><span>{guidance.practice}</span></div>}{error&&<p className="assistant-error" role="alert">{error}</p>}</section><footer><button disabled={busy||step===2&&choice!==1} onClick={()=>void next()}>{busy?"Saving…":step===screens.length-1?"Complete lesson":"Continue"}</button></footer></main>
}
