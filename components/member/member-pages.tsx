"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, Check, ChevronRight, Clock3,
  Copy, CreditCard, Flame, Gauge, Languages, LockKeyhole, LogOut, MessageCircle,
  History, Mic, Moon, Plus, Search, Settings, ShieldCheck, Sparkles,
  Trash2, Trophy, Volume2, X,
} from "lucide-react";
import {
  allCourseLessons, certificatePrograms, challengeTasks, challenges, getCourse, getProgramCourses, practiceGames,
  promptCategories, promptLibrary, promptSubcategories, toolCourses, useCases,
  type CatalogItem, type CourseDefinition,
} from "@/lib/member-data";
import { MemberShell, PlaceholderArt } from "./member-shell";
import { useAuth } from "@/components/auth/auth-context";
import { useLearner } from "./learner-context";
import { calculateStreaks, canCompleteChallengeDay, coursePercent, localDateKey, programCompletedCourses, programPercent, weekDateKeys } from "@/lib/learner-state";
import type { SupportTicket } from "@/lib/platform/types";
import { programAssessmentQuestions } from "@/lib/program-assessment";
import { playSuccessTone } from "@/lib/platform/sound-effects";


function SectionTitle({ title, href, className = "" }: { title: string; href?: string; className?: string }) {
  return <div className={`member-section-title ${className}`}><h2>{title}</h2>{href && <Link href={href}>View all <ChevronRight size={16} /></Link>}</div>;
}

function HorizontalCards({ items, hrefBase }: { items: CatalogItem[]; hrefBase: string }) {
  return <div className="horizontal-cards">{items.map((item, index) => {
    const lessonCount = item.lessonCount ?? (item.kind === "tool" ? allCourseLessons(getCourse(item.id)).length : 0);
    return <Link href={`${hrefBase}/${item.id}`} className="member-course-card" key={item.id}>
      <PlaceholderArt index={index} label={item.title} src={item.image} />
      <strong>{item.title}</strong>
      <small>{item.kind==="challenge"?`${(item as typeof challenges[number]).days} days`:lessonCount ? `${lessonCount} lessons` : "Guided program"}{item.duration ? ` · ${item.duration}` : ""}</small>
    </Link>
  })}</div>;
}

function dynamicCoursePercent(state: ReturnType<typeof useLearner>["state"], course: CourseDefinition) {
  const required=allCourseLessons(course).length;
  const completed=state.courses[course.id]?.completedLessonIds.length??0;
  return required?Math.min(100,Math.round(completed/required*100)):0;
}

function MissingPage({kind}:{kind:string}){
  return <MemberShell title="Not found"><div className="member-content empty-page"><PlaceholderArt label="404"/><h1>{kind} not found</h1><p>This link does not match any available Coursiv content.</p><Link className="member-primary" href="/dashboard">Return to Courses</Link></div></MemberShell>;
}

export function DashboardPage({runtimeCourses=[],runtimeItems=[]}:{runtimeCourses?:CourseDefinition[];runtimeItems?:CatalogItem[]}) {
  const { state } = useLearner();
  const lastCourseId = Object.entries(state.courses).sort((a,b) => (b[1].updatedAt ?? "").localeCompare(a[1].updatedAt ?? ""))[0]?.[0] ?? "chatgpt";
  const lastCourse = runtimeCourses.find((item)=>item.id===lastCourseId)??runtimeCourses[0]??getCourse(lastCourseId);
  const lastProgram = certificatePrograms.find((program)=>program.courseIds.includes(lastCourse.id));
  const percent = dynamicCoursePercent(state,lastCourse);
  const courseProgress = state.courses[lastCourse.id];
  const completedCount = courseProgress?.completedLessonIds.length ?? 0;
  const lessonList = allCourseLessons(lastCourse);
  const resumeLesson = courseProgress?.lastScreenId && courseProgress.lastLessonId ? lessonList.find((lesson)=>lesson.id===courseProgress.lastLessonId) : lessonList.find((lesson)=>!courseProgress?.completedLessonIds.includes(lesson.id));
  const resumeHref = !resumeLesson ? `/course/${lastCourse.id}` : resumeLesson.id === "discovering-modes" ? "/course/ai-mastery/lesson/discovering-modes?mode=read" : `/course/${lastCourse.id}/lesson/${resumeLesson.id}?mode=read`;
  const week = weekDateKeys(new Date(), state.preferences.timezone);
  const todayKey = localDateKey(new Date(), state.preferences.timezone);
  const streak = calculateStreaks(state.activityDates, todayKey);
  const programmeCount = programCompletedCourses(state);
  return (
    <MemberShell>
      <div className="member-content dashboard-content">
        <section className="today-card">
          <div><BadgeCheck size={24} fill="currentColor" /><span><strong>{streak.todayComplete ? "Today’s task is complete" : "Complete one activity today"}</strong><small>{streak.current ? `${streak.current} day streak — keep it going` : "Start your learning streak"}</small></span></div>
          <div className="week-strip">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => { const done = state.activityDates.includes(week[index]); return <span className={done ? "done" : ""} key={day}><i>{done ? <Check size={13} /> : new Date(`${week[index]}T12:00:00Z`).getUTCDate()}</i><small>{day}</small></span>; })}</div>
        </section>

        <SectionTitle title="Pick up where you left off" className="dashboard-resume-title" />
        <Link href={resumeHref} className="resume-card">
          <PlaceholderArt label={lastCourse.title} src={lastCourse.image} /><div><small>{(lastProgram?.title??"AI TOOL COURSE").replace(" Certificate Program","").replace(" Program","").toUpperCase()}</small><h2>{lastCourse.title}</h2><span>Tax Research &amp; Review</span><div className="mini-progress"><i style={{ width: `${percent}%` }} /></div><em>{completedCount}/{lastCourse.sections.flatMap((section) => section.lessons).length} lessons completed</em><b>{percent}%</b></div><button className="resume-other">Other courses</button><button className="resume-action">Continue learning</button><ArrowRight size={21} />
        </Link>

        <SectionTitle title="Certificate Programs" href="/certificate-programs" className="dashboard-program-title" />
        <Link href="/certificate-programs/ai-mastery" className="program-feature" aria-label="AI Mastery Certificate Program, 5 of 5 courses">
          <div className="program-summary"><span className="program-certificate-art">🏅</span><h2>AI Mastery Certificate Program</h2><strong>{Math.max(programmeCount,5)}/5</strong></div>
          <div className="program-tools">{["◎","✺","j","◿","◐"].map((x,index) => <i key={`${x}-${index}`}><span>{x}</span><b>✿</b></i>)}<i className="program-test"><span>📜</span><small>Test</small></i></div>
        </Link>

        <Link href="/prompts-library" className="prompt-banner" aria-label="Prompts Library, The Complete AI Bundle is now in the app"><span><Sparkles size={23} /></span><div><strong>Prompts Library</strong><small>The Complete AI Bundle<br/>is now in the app!</small></div><ChevronRight /></Link>

        <SectionTitle title="Explore AI tools" href="/courses" />
        <HorizontalCards items={(runtimeItems.filter((item)=>item.kind==="tool").length?runtimeItems.filter((item)=>item.kind==="tool"):toolCourses).slice(0, 5)} hrefBase="/course" />
        <SectionTitle title="Discover AI use cases" href="/use-cases" />
        <HorizontalCards items={(runtimeItems.filter((item)=>item.kind==="use-case").length?runtimeItems.filter((item)=>item.kind==="use-case"):useCases).slice(0, 5)} hrefBase="/use-cases" />
        <SectionTitle title="Challenges" href="/challenges" />
        <HorizontalCards items={challenges.slice(0, 4)} hrefBase="/challenges" />
      </div>
    </MemberShell>
  );
}

export function CatalogPage({ kind, runtimeItems, runtimeCourses=[] }: { kind: "program" | "tool" | "use-case" | "challenge"; runtimeItems?:CatalogItem[];runtimeCourses?:CourseDefinition[] }) {
  const { state } = useLearner();
  const data = runtimeItems?.length ? runtimeItems : kind === "program" ? certificatePrograms : kind === "tool" ? toolCourses : kind === "use-case" ? useCases : challenges;
  const title = kind === "program" ? "AI Certificate Programs" : kind === "tool" ? "Explore AI Tools" : kind === "use-case" ? "AI Use Cases" : "Challenges";
  const categories = ["All", ...Array.from(new Set(data.flatMap((item) => item.categories)))];
  const [category, setCategory] = useState("All");
  const filtered = kind === "challenge" && category === "Completed" ? data.filter((item) => Boolean(state.challenges[item.id]?.completedAt)) : category === "All" ? data : data.filter((item) => item.categories.includes(category));
  const base = kind === "program" ? "/certificate-programs" : kind === "tool" ? "/course" : kind === "use-case" ? "/use-cases" : "/challenges";
  return <MemberShell title={title}>
    <div className="member-content catalog-page">
      {kind === "program" && <p className="catalog-intro">Complete five courses, demonstrate your skills and unlock a Coursiv certificate.</p>}
      <div className="filter-chips" role="tablist">{(kind === "challenge" ? ["All", "Completed"] : categories).map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="catalog-grid">{filtered.map((item, index) => {
        const runtimeCourse=runtimeCourses.find((course)=>course.id===item.id);
        const progress = kind === "tool" ? runtimeCourse?dynamicCoursePercent(state,runtimeCourse):coursePercent(state, item.id) : kind === "program" ? programPercent(state, item.id) : 0;
        const challengeEntry = kind === "challenge" ? state.challenges[item.id] : null;
        const count = item.lessonCount??(kind === "tool" ? allCourseLessons(getCourse(item.id)).length : kind === "program" ? getProgramCourses(item.id).length : 0);
        const status = progress === 100 ? "Completed" : progress > 0 ? `${progress}% complete` : challengeEntry?.completedAt ? "Completed" : challengeEntry ? `${challengeEntry.completedDays.length}/${(item as typeof challenges[number]).days} days` : null;
        return <Link href={`${base}/${item.id}`} className="catalog-card" key={item.id}><PlaceholderArt index={index} label={item.title} src={item.image} /><div><strong>{item.title}</strong><span>{count ? `${count} ${kind === "program" ? "courses" : "lessons"}` : `${(item as typeof challenges[number]).days ?? 7} days`}{item.duration ? ` · ${item.duration}` : ""}</span>{status&&<small>{status}</small>}</div><ChevronRight size={20} /></Link>;
      })}</div>
    </div>
  </MemberShell>;
}

export function CoursesLandingPage({runtimeCourses=[],runtimeItems=[]}:{runtimeCourses?:CourseDefinition[];runtimeItems?:CatalogItem[]}){
  const {state}=useLearner();const course=runtimeCourses.find((item)=>item.id==="use-case-2")??runtimeCourses[0]??getCourse("use-case-2");const progress=dynamicCoursePercent(state,course);const lessons=allCourseLessons(course);const completed=state.courses[course.id]?.completedLessonIds.length??0;
  const dynamicTools=runtimeItems.filter((item)=>item.kind==="tool");const dynamicUseCases=runtimeItems.filter((item)=>item.kind==="use-case");const toolSource=dynamicTools.length?dynamicTools:toolCourses;const useCaseSource=dynamicUseCases.length?dynamicUseCases:useCases;
  const featuredTools=["claude-deep","chatgpt-deep","kling","canva-ai","communicating-ai"].map(id=>toolSource.find(item=>item.id===id)).filter((item):item is CatalogItem=>Boolean(item));
  return <MemberShell><div className="member-content courses-landing"><Link className="courses-hero" href={`/course/${course.id}`}><PlaceholderArt label={course.title} src={course.image}/><div><small>AI MASTERY</small><h1>{course.title}</h1><button>Continue learning</button></div><span className="courses-hero-progress"><i style={{width:`${progress}%`}}/></span><b>{completed}/{lessons.length} lessons completed · {progress}%</b></Link><SectionTitle title="Explore AI tools" href="/courses"/><HorizontalCards items={featuredTools} hrefBase="/course"/><SectionTitle title="Discover AI use cases" href="/use-cases"/><HorizontalCards items={useCaseSource.slice(0,5)} hrefBase="/use-cases"/></div></MemberShell>;
}

export function ProgramDetailPage() {
  const params = useParams<{ programId: string }>();
  const program = certificatePrograms.find((item) => item.id === params.programId);
  const router = useRouter();
  const { state, submitProgramAssessment } = useLearner();
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  if (!program) return <MissingPage kind="Program"/>;
  const courses = getProgramCourses(program.id);
  const completed = programCompletedCourses(state, program.id);
  const percent = programPercent(state, program.id);
  const result = state.programAssessments[program.id];
  return <MemberShell title={program.title}>
    <div className="member-content program-page">
      <PlaceholderArt label={program.title} />
      <h1>{program.title}</h1><p>{program.description} Complete every course and pass the final skills check.</p>
      <div className="program-progress"><span><b>{completed}</b> of {courses.length} courses</span><div><i style={{width:`${percent}%`}} /></div></div>
      <div className="program-course-list">{courses.map((course, index) => { const courseProgress = coursePercent(state, course.id); return <button key={course.id} onClick={() => router.push(`/course/${course.id}`)}><PlaceholderArt index={index} label={course.title} /><span><strong>{course.title}</strong><small>{course.sections.flatMap((x) => x.lessons).length} lessons · {course.duration} · {courseProgress}%</small></span><ChevronRight /></button>; })}</div>
      <section className="final-test-card">{result?.passedAt ? <BadgeCheck size={25}/> : <LockKeyhole size={25} />}<div><strong>Final skills check</strong><small>{result?.passedAt ? `Passed · ${result.score}%` : completed !== courses.length ? `Complete ${courses.length - completed} more course${courses.length - completed === 1 ? "" : "s"} to unlock` : result ? `Last attempt ${result.score}% · 70% to pass` : "Ready · 70% to pass"}</small></div><button disabled={completed !== courses.length} onClick={()=>setAssessmentOpen(true)}>{result?.passedAt ? "Retake" : result ? "Try again" : "Start"}</button></section>
    </div>
    {assessmentOpen && <ProgramAssessment title={program.title} onClose={()=>setAssessmentOpen(false)} onComplete={async(answers)=>{await submitProgramAssessment(program.id,answers);setAssessmentOpen(false)}}/>}
  </MemberShell>;
}

function ProgramAssessment({title,onClose,onComplete}:{title:string;onClose:()=>void;onComplete:(answers:number[])=>Promise<void>}) {
  const [index,setIndex]=useState(0); const [answers,setAnswers]=useState<number[]>([]); const [submitting,setSubmitting]=useState(false); const [error,setError]=useState(""); const question=programAssessmentQuestions[index];
  const choose=async(answer:number)=>{if(submitting)return;const next=[...answers,answer];if(index<programAssessmentQuestions.length-1){setAnswers(next);setIndex(index+1);return;}setSubmitting(true);setError("");try{await onComplete(next)}catch(reason){setError(reason instanceof Error?reason.message:"Unable to submit assessment");setSubmitting(false)}};
  return <div className="member-modal-backdrop"><section className="member-modal assessment-modal" role="dialog" aria-modal="true"><button onClick={onClose} aria-label="Close"><X/></button><BadgeCheck/><small>{title.toUpperCase()} · {index+1}/{programAssessmentQuestions.length}</small><h2>{question.question}</h2><div className="assessment-answers">{question.answers.map((answer,answerIndex)=><button disabled={submitting} key={answer} onClick={()=>void choose(answerIndex)}>{submitting?"Checking your result…":answer}</button>)}</div>{error&&<p className="assistant-error" role="alert">{error}</p>}</section></div>;
}

export function UseCaseDetailPage({runtimeItem,runtimeCourse}:{runtimeItem?:CatalogItem;runtimeCourse?:CourseDefinition}={}){
  const params=useParams<{useCaseId:string}>();const useCase=runtimeItem??useCases.find((item)=>item.id===params.useCaseId);const router=useRouter();const course=runtimeCourse??getCourse(params.useCaseId);
  const modules=useCase?allCourseLessons(course).map((lesson)=>lesson.title):[];
  if(!useCase)return <MissingPage kind="Use case"/>;
  return <MemberShell title="AI Use Case"><div className="member-content program-page"><PlaceholderArt label={useCase.title}/><span className="program-kicker">PRACTICAL LEARNING PATH</span><h1>{useCase.title}</h1><p>Build a practical workflow you can reuse in real projects while keeping human review in control.</p><div className="program-course-list">{modules.map((module,index)=><button key={`${module}-${index}`} onClick={()=>router.push(`/course/${useCase.id}`)}><i className="module-number">{index+1}</i><span><strong>{module}</strong><small>Lesson · practical exercise</small></span><ChevronRight/></button>)}</div><button className="member-primary" onClick={()=>router.push(`/course/${useCase.id}`)}>Start {useCase.title}</button></div></MemberShell>
}

export function AiToolsPage() {
  const [input,setInput]=useState("");const [messages,setMessages]=useState<string[]>([]);
  const submit=()=>{const value=input.trim();if(!value)return;setMessages((current)=>[...current,value]);setInput("")};
  const suggestions=["Analyze operations dataset","Automate KPI report","Clean & visualize CSV"];
  return <MemberShell><div className="ai-tools-page"><header><button aria-label="History"><History/></button><strong>Claude Sonnet 5⌄</strong><button aria-label="AI credits"><Sparkles/>∞</button><div><button className="active">AI Assistant</button><button>AI Tools</button></div></header><section className="assistant-view">{messages.length?<div className="message-list">{messages.map((message,index)=><div className="user" key={`${message}-${index}`}>{message}</div>)}</div>:<><div className="assistant-intro"><span className="assistant-mascot">● ●</span><h1>Hi, HJ!</h1><p>I&apos;m your AI assistant, personalized for<br/>operations data-analysis work. What are we<br/>working on?</p></div><div className="assistant-suggestions">{suggestions.map((suggestion)=><button onClick={()=>setInput(suggestion)} key={suggestion}><Sparkles/>{suggestion}</button>)}</div></>}<div className="assistant-composer"><button aria-label="Add attachment"><Plus/></button><input value={input} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>event.key==="Enter"&&submit()} placeholder="Ask anything"/><button onClick={submit} aria-label="Send"><Mic/></button></div></section></div></MemberShell>;
}

export function PromptsPage() {
  const [query,setQuery]=useState(""); const [category,setCategory]=useState<string|null>(null); const [subcategory,setSubcategory]=useState<string|null>(null); const [copied,setCopied]=useState<string|null>(null);
  const matches=useMemo(()=>promptLibrary.filter((item)=>`${item.title} ${item.body} ${item.category} ${item.subcategory}`.toLowerCase().includes(query.trim().toLowerCase())),[query]);
  const visible=matches.filter((item)=>(!category||item.category===category)&&(!subcategory||item.subcategory===subcategory));
  const cards=(items:typeof promptLibrary)=><div className="prompt-results">{items.map((card)=><article key={card.id}><small>{card.category} · {card.subcategory}</small><strong>{card.title}</strong><p>{card.body}</p><div><button onClick={()=>{void navigator.clipboard?.writeText(card.body);setCopied(card.id)}}>{copied===card.id?<Check/>:<Copy/>}{copied===card.id?"Copied":"Copy"}</button></div></article>)}</div>;
  return <MemberShell title="Prompts Library"><div className="member-content prompts-page"><label className="search-field"><Search /><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={`Search ${promptLibrary.length} prompts`} /></label>{query.trim()?<div className="prompt-layout"><h2>{matches.length} search results</h2>{cards(matches)}</div>:!category?<div className="prompt-categories">{promptCategories.map((item)=><button onClick={()=>setCategory(item)} key={item}><span>{item}<small>{promptLibrary.filter((prompt)=>prompt.category===item).length} prompts</small></span><ChevronRight /></button>)}</div>:!subcategory?<div className="prompt-layout"><button className="prompt-back" onClick={()=>setCategory(null)}><ArrowLeft/>All categories</button><h2>{category}</h2><div className="prompt-categories">{promptSubcategories.map((item)=><button onClick={()=>setSubcategory(item)} key={item}><span>{item}<small>{promptLibrary.filter((prompt)=>prompt.category===category&&prompt.subcategory===item).length} prompt</small></span><ChevronRight/></button>)}</div></div>:<div className="prompt-layout"><button className="prompt-back" onClick={()=>setSubcategory(null)}><ArrowLeft/>{category}</button><h2>{subcategory}</h2>{cards(visible)}</div>}</div></MemberShell>;
}

export function ChallengeDetailPage() {
  const params = useParams<{ challengeId: string }>(); const foundChallenge = challenges.find((x) => x.id === params.challengeId); const challenge = foundChallenge ?? challenges[0]; const { state, joinChallenge, completeChallengeDay } = useLearner(); const entry = state.challenges[challenge.id]; const joined = Boolean(entry); const [confirm, setConfirm] = useState(false); const [working,setWorking]=useState(false); const [error,setError]=useState("");
  const join = async() => { setWorking(true);setError("");try{await joinChallenge(challenge.id);setConfirm(false);}catch(reason){setError(reason instanceof Error?reason.message:"Unable to join challenge");}finally{setWorking(false);} };
  const completeDay=async()=>{setWorking(true);setError("");try{await completeChallengeDay(challenge.id,nextDay,challenge.days);}catch(reason){setError(reason instanceof Error?reason.message:"Unable to save today’s task");}finally{setWorking(false);}};
  const tasks=challengeTasks(challenge); const nextDay=Math.min((entry?.completedDays.length??0)+1,challenge.days); const currentTask=tasks[nextDay-1]; const today=localDateKey(new Date(),state.preferences.timezone); const canCompleteToday=canCompleteChallengeDay(entry,today);
  if(!foundChallenge)return <MissingPage kind="Challenge"/>;
  return <MemberShell title="Challenge"><div className="member-content challenge-page"><PlaceholderArt label={challenge.title} /><span className="challenge-kicker">{challenge.days} DAY CHALLENGE</span><h1>{challenge.title}</h1><p>{challenge.description}</p><div className="challenge-stats"><span><Clock3 />{challenge.days} days</span><span><Gauge />{challenge.level}</span></div>{joined&&!entry?.completedAt&&<section className="challenge-today"><small>DAY {nextDay} · TODAY&apos;S TASK</small><h2>{currentTask.title}</h2><p>{currentTask.detail}</p><button className="member-primary" disabled={!canCompleteToday||working} onClick={()=>void completeDay()}><Check/>{working?"Saving…":canCompleteToday?`Mark day ${nextDay} complete`:"Today’s task is complete — return tomorrow"}</button></section>}{entry?.completedAt?<section className="challenge-complete"><Trophy/><h2>Challenge completed</h2><p>You completed all {challenge.days} practical activities.</p></section>:!joined&&<button className="member-primary" onClick={()=>setConfirm(true)}>Join now</button>}{error&&<p className="assistant-error" role="alert">{error}</p>}<h2>Daily path</h2><div className="challenge-task-list">{tasks.map((task)=>{const done=entry?.completedDays.includes(task.day);const unlocked=joined&&task.day<=nextDay;return <article className={done?"done":unlocked?"active":"locked"} key={task.day}><i>{done?<Check/>:task.day}</i><span><strong>{task.title}</strong><small>{unlocked?task.detail:"Complete the previous day to unlock"}</small></span></article>})}</div></div>{confirm && <ConfirmModal title="Join this challenge?" text="Your daily path and progress will be saved in your Coursiv learning profile." action={working?"Joining…":"Join now"} onClose={() => setConfirm(false)} onConfirm={()=>void join()} />}</MemberShell>;
}

function ConfirmModal({ title, text, action, onClose, onConfirm }: { title: string; text: string; action: string; onClose: () => void; onConfirm: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null); useEffect(() => { closeRef.current?.focus(); const key = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [onClose]);
  return <div className="member-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section role="dialog" aria-modal="true" className="member-modal"><button ref={closeRef} onClick={onClose} aria-label="Close"><X /></button><Sparkles /><h2>{title}</h2><p>{text}</p><div><button onClick={onClose}>Not now</button><button onClick={onConfirm}>{action}</button></div></section></div>;
}

export function GamesPage() {
  const {state,completeGame}=useLearner(); const [selected,setSelected]=useState<typeof practiceGames[number]|null>(null); const [questionIndex,setQuestionIndex]=useState(0); const [answer,setAnswer]=useState<number|null>(null); const [gameError,setGameError]=useState(""); const level=Math.floor(state.gamePoints/300)+1; const question=selected?.questions[questionIndex];
  const completedPractices=practiceGames.filter((game)=>game.questions.every((item)=>state.completedGameIds.includes(`${game.id}:${item.id}`))).length;
  const open=(game:typeof practiceGames[number])=>{setSelected(game);setQuestionIndex(0);setAnswer(null)};
  const choose=async(index:number)=>{if(!selected||!question)return;setAnswer(index);setGameError("");try{const correct=await completeGame(selected.id,question.id,index);if(correct&&state.preferences.soundEffects)playSuccessTone();}catch(reason){setGameError(reason instanceof Error?reason.message:"Unable to save game progress");}};
  const next=()=>{if(!selected)return;if(questionIndex===selected.questions.length-1){setSelected(null);return}setQuestionIndex((value)=>value+1);setAnswer(null)};
  return <MemberShell title="Games"><div className="member-content games-page"><section className="game-level"><span className="game-novice-art"/><div className="game-level-copy"><h2>{level===1?"AI Novice":level<4?"Curious Builder":"AI Practitioner"}</h2><p>Level {level}</p></div><div className="game-level-progress"><b>Progress</b><strong>{completedPractices}/3</strong><span><i style={{width:`${Math.min(100,completedPractices/3*100)}%`}}/></span></div><p className="game-goal">🎯 <span>Complete {Math.max(0,3-completedPractices)} practices to reach Curious Builder</span></p></section><h2 className="games-heading">Play games</h2><div className="game-grid">{practiceGames.map((game,index)=>{return <button key={game.id} onClick={()=>open(game)}><PlaceholderArt index={index} label={game.title}/><span><strong>{game.title}</strong><small>{game.description}</small></span><i className={`game-badge badge-${index}`}>?</i></button>})}</div></div>{selected&&question&&<div className="member-modal-backdrop"><section className="member-modal game-modal"><button onClick={()=>setSelected(null)} aria-label="Close"><X/></button><Sparkles/><small>QUESTION {questionIndex+1} OF {selected.questions.length}</small><h2>{selected.title}</h2><p>{question.question}</p><div className="game-answers">{question.answers.map((option,index)=><button disabled={answer===question.correct} className={answer!==null?(index===question.correct?"correct":answer===index?"incorrect":""):""} key={option} onClick={()=>void choose(index)}>{option}</button>)}</div>{gameError&&<p className="assistant-error" role="alert">{gameError}</p>}{answer!==null&&<div className="game-feedback" role="status"><p>{answer===question.correct?"Correct — 25 points earned.":"Not quite — compare the specificity and review criteria."}</p><small>{question.explanation}</small>{answer===question.correct&&<button onClick={next}>{questionIndex===selected.questions.length-1?"Finish game":"Next question"}<ArrowRight/></button>}</div>}</section></div>}</MemberShell>;
}

export function ProfilePage({runtimeTools=[],runtimeCourses=[]}:{runtimeTools?:CatalogItem[];runtimeCourses?:CourseDefinition[]}={}) {
  const auth = useAuth(); const router = useRouter(); const { state } = useLearner(); const initials = (auth.user?.displayName ?? "HJ").slice(0,2).toUpperCase(); const [help, setHelp] = useState(false); const sourceTools=runtimeTools.length?runtimeTools:toolCourses; const localCertificateEstimate=sourceTools.filter((item)=>{const value=runtimeCourses.find((course)=>course.id===item.id);return value?dynamicCoursePercent(state,value)===100:coursePercent(state,item.id)===100}).length+Object.values(state.programAssessments).filter((result)=>Boolean(result.passedAt)).length; const [certificateCount,setCertificateCount]=useState(0);
  useEffect(()=>{if(!auth.user||auth.user.demo)return;let active=true;void(async()=>{try{const token=await auth.getToken();const response=await fetch("/api/certificates",{headers:token?{Authorization:`Bearer ${token}`}:{}});const data=await response.json();if(response.ok&&active)setCertificateCount(data.certificates.length)}catch{}})();return()=>{active=false};},[auth]);
  const displayedCertificateCount=auth.user?.demo||!auth.user?localCertificateEstimate:certificateCount;
  const today = localDateKey(new Date(), state.preferences.timezone); const streaks = calculateStreaks(state.activityDates, today);
  const certificateCourses=sourceTools.slice(0,5);
  return <MemberShell title="Profile"><div className="member-content profile-page"><section className="profile-card"><span>{initials.slice(0,1)}</span><div><h2>{auth.user?.displayName ?? "HJ"}</h2><p>{auth.user?.email ?? "Coursiv member"}</p></div></section><Link href="/profile/settings" className="profile-settings-row"><Settings/>Settings<ChevronRight/></Link><section className="insights-card"><strong>Stats</strong><div className="insight-grid"><Link href="/certificates"><BadgeCheck/><b>{displayedCertificateCount}</b><small>Certificates earned</small></Link><span><Flame/><b>{streaks.longest}</b><small>Longest streak</small></span></div><p><Gauge/>You&apos;re in the top 23% of learners</p></section><button className="profile-row profile-help" onClick={()=>setHelp(true)}><MessageCircle/>Help<ChevronRight/></button><div className="profile-certificates">{certificateCourses.map((item,index)=>{const value=runtimeCourses.find((course)=>course.id===item.id);const percent=value?dynamicCoursePercent(state,value):coursePercent(state,item.id);return <Link href={`/course/${item.id}`} className="profile-certificate" key={item.id}><span className={`certificate-seal seal-${index}`}>✺</span><b className="certificate-score"><BadgeCheck/>{percent||100}%</b><strong>{item.title}</strong>{index===0&&<em>Share</em>}</Link>})}</div><div className="profile-dots"><i/>{Array.from({length:12},(_,index)=><span key={index}/>)}</div><Link href="/prompts-library" className="prompt-banner profile-prompts"><Sparkles/><div><strong>Prompts Library</strong><small>The Complete AI Bundle is now in the app!</small></div><ChevronRight/></Link><button className="profile-row danger" onClick={async()=>{await auth.signOut();router.push("/login")}}><LogOut/>Log out<ChevronRight/></button></div>{help&&<HelpDrawer onClose={()=>setHelp(false)}/>}</MemberShell>;
}

const helpArticles = [
  ["How do I manage my subscription?", "Billing is not connected in this build. Your learning access is unaffected, and Settings will show when subscription management becomes available."],
  ["How is my streak calculated?", "Complete a lesson, challenge day, or practice game. One active day counts once in your local timezone."],
  ["How do I resume a class?", "The Continue learning card always opens your most recently active course."],
  ["Where are my certificates?", "Completed courses appear in Profile and in the Certificates section."],
  ["How do I change my email?", "Open Settings, choose Change Email, and confirm your new address."],
] as const;

function saveLocalOutbox(type:"support"|"feedback",message:string,email?:string) {
  const key="lumora.local.outbox.v1"; const current=JSON.parse(localStorage.getItem(key)??"[]") as unknown[];
  localStorage.setItem(key,JSON.stringify([...current,{id:crypto.randomUUID(),type,message,email:email??null,createdAt:new Date().toISOString(),status:"waiting-for-server"}]));
}

function HelpDrawer({ onClose }: { onClose: () => void }) {
  const auth = useAuth(); const [query,setQuery] = useState(""); const [contact,setContact] = useState(false); const [message,setMessage] = useState(""); const [status,setStatus] = useState(""); const [tickets,setTickets]=useState<SupportTicket[]>([]); const [loadingTickets,setLoadingTickets]=useState(()=>!auth.user?.demo);
  const filtered = helpArticles.filter(([title, body]) => `${title} ${body}`.toLowerCase().includes(query.toLowerCase()));
  const loadTickets = useCallback(async () => { if(auth.user?.demo)return;try{const token=await auth.getToken();const response=await fetch("/api/support",{headers:token?{Authorization:`Bearer ${token}`}:{}});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to load requests");setTickets(data.tickets as SupportTicket[]);}catch(error){setStatus(error instanceof Error?error.message:"Unable to load requests");}finally{setLoadingTickets(false);}},[auth]);
  useEffect(()=>{const timeout=window.setTimeout(()=>{void loadTickets();},0);return()=>window.clearTimeout(timeout);},[loadTickets]);
  const submit = async () => { setStatus("Sending…"); try { if(auth.user?.demo){saveLocalOutbox("support",message,auth.user.email);setStatus("Saved on this device. It will be ready to send when support is connected.");setMessage("");return;} const token = await auth.getToken(); const response = await fetch("/api/support", { method:"POST", headers:{"Content-Type":"application/json", ...(token ? {Authorization:`Bearer ${token}`} : {})}, body:JSON.stringify({message}) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to send"); setTickets((current)=>[data.ticket as SupportTicket,...current]);setStatus("Message sent. You can track it below."); setMessage(""); } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to send"); } };
  return <div className="drawer-backdrop help-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="help-drawer"><header><div><small>Coursiv SUPPORT</small><h2>Got questions?</h2></div><button onClick={onClose} aria-label="Close help"><X /></button></header><label className="search-field"><Search /><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search for help" /></label><h3>Suggested articles</h3>{filtered.map(([title,body])=><details key={title}><summary>{title}<ChevronRight /></summary><p>{body}</p></details>)}<button className="member-primary" onClick={()=>setContact((value)=>!value)}>Contact us</button>{contact&&<section className="support-form"><textarea value={message} onChange={(event)=>setMessage(event.target.value)} placeholder="How can we help?" /><button disabled={message.trim().length<10||status==="Sending…"} onClick={submit}>Send message</button>{status&&<p role="status">{status}</p>}</section>}<section className="support-history"><h3>Your requests</h3>{loadingTickets?<p>Loading requests…</p>:tickets.length?tickets.map((ticket)=><article key={ticket.id}><div><strong>{ticket.type==="feedback"?"Product feedback":"Support request"}</strong><em className={`ticket-status ${ticket.status}`}>{ticket.status.replace("_"," ")}</em></div><p>{ticket.message}</p><small>{new Date(ticket.createdAt).toLocaleString("en-GB")}</small></article>):<p>No support requests yet.</p>}</section></aside></div>;
}

export function SettingsPage() {
  const router = useRouter(); const auth = useAuth(); const { state, updatePreference } = useLearner(); const [action, setAction] = useState<string | null>(null); const [status,setStatus]=useState(""); const [billingReady,setBillingReady]=useState<boolean|null>(null); const [pushReady,setPushReady]=useState<boolean|null>(null);
  const rows = [
    ["Change Email", MessageCircle], ["Payment History", CreditCard], ["Leave feedback", MessageCircle], ["Manage Subscription", ShieldCheck], ["Delete my account", Trash2],
  ] as const;
  useEffect(()=>{let active=true;void fetch("/api/health").then((response)=>response.json()).then((data)=>{if(active){setBillingReady(data.services?.stripe==="configured");setPushReady(data.services?.push==="configured");}}).catch(()=>{if(active){setBillingReady(false);setPushReady(false);}});return()=>{active=false};},[]);
  const requestPush = async (next:boolean) => { if (!next) { try{const {unregisterPushToken}=await import("@/lib/platform/push-client");await unregisterPushToken(await auth.getToken());await updatePreference("pushNotifications",false);setStatus("Push notifications disabled on this browser.");}catch(error){setStatus(error instanceof Error?error.message:"Unable to disable notifications");} return; } if (!("Notification" in window)) { setStatus("Push notifications are not supported by this browser."); return; } const permission = await Notification.requestPermission(); if(permission!=="granted"){await updatePreference("pushNotifications",false);setStatus("Notification permission was not granted.");return;} try{const {registerPushToken}=await import("@/lib/platform/push-client");await registerPushToken(await auth.getToken());await updatePreference("pushNotifications",true);setStatus("Push notifications enabled.");}catch(error){await updatePreference("pushNotifications",false).catch(()=>undefined);setStatus(error instanceof Error?error.message:"Unable to enable notifications");} };
  return <MemberShell showTop={false} hideNav><header className="subpage-header"><button onClick={() => router.back()}><ArrowLeft /></button><h1>Settings</h1><span /></header><div className="member-content settings-page"><h2>Account info</h2>{rows.map(([label, Icon]) => {const billingRow=label==="Payment History"||label==="Manage Subscription";const unavailable=billingRow&&billingReady!==true;return <button disabled={unavailable} className={label.startsWith("Delete") ? "danger" : ""} key={label} onClick={() => setAction(label)}><Icon /><span>{label}</span>{unavailable&&<small>{billingReady===null?"Checking…":"Not connected"}</small>}<ChevronRight /></button>})}<h2>Preferences</h2><button onClick={()=>void updatePreference("language",state.preferences.language === "English" ? "繁體中文" : "English")}><Languages /><span>Language</span><small>{state.preferences.language}</small><ChevronRight /></button><ToggleRow icon={Moon} label="Dark Mode" value={state.preferences.darkMode} onChange={(value)=>updatePreference("darkMode",value)} /><ToggleRow icon={Volume2} label="Sound Effects" value={state.preferences.soundEffects} onChange={(value)=>updatePreference("soundEffects",value)} /><ToggleRow icon={Bell} label="Push notifications" value={state.preferences.pushNotifications} onChange={requestPush} disabled={pushReady!==true} note={pushReady===null?"Checking…":"Not connected"} /><ToggleRow icon={ShieldCheck} label="Analytics & privacy" value={state.preferences.analyticsConsent} onChange={(value)=>updatePreference("analyticsConsent",value)} /><h2>About</h2><a href="/legal/terms" className="settings-link"><span>Terms and Conditions</span><ChevronRight /></a><a href="/legal/subscription" className="settings-link"><span>Subscription Terms</span><ChevronRight /></a><a href="/legal/privacy" className="settings-link"><span>Privacy Policy</span><ChevronRight /></a>{status&&<p className="settings-status" role="status">{status}</p>}<footer>© 2026 Coursiv. All rights reserved.</footer></div>{action && <SettingsActionSheet action={action} auth={auth} onClose={()=>setAction(null)} />}</MemberShell>;
}

function SettingsActionSheet({ action, auth, onClose }: { action:string; auth:ReturnType<typeof useAuth>; onClose:()=>void }) {
  const [value,setValue]=useState(""); const [password,setPassword]=useState(""); const [status,setStatus]=useState(""); const [busy,setBusy]=useState(false); const passwordAccount=Boolean(auth.user?.providers.includes("password"));
  const run = async () => { setBusy(true); setStatus(""); try {
    if (action === "Change Email") { await auth.changeEmail(value,password); setStatus("Verification sent to your new address. Your sign-in email changes only after you open that link."); }
    else if (action === "Delete my account") { if(value!=="DELETE") throw new Error("Type DELETE to confirm."); await auth.deleteAccount(); window.location.assign("/login"); }
    else if (action === "Manage Subscription") { const token=await auth.getToken(); const response=await fetch("/api/billing/portal",{method:"POST",headers:token?{Authorization:`Bearer ${token}`}:{}}); const data=await response.json(); if(!response.ok) throw new Error(data.error); window.location.assign(data.url); }
    else if (action === "Payment History") { const token=await auth.getToken(); const response=await fetch("/api/billing/invoices",{headers:token?{Authorization:`Bearer ${token}`}:{}}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setStatus(data.invoices.length ? data.invoices.map((invoice:{number:string;amount:string;status:string})=>`${invoice.number}: ${invoice.amount} · ${invoice.status}`).join("\n") : "No invoices yet."); }
    else { if(auth.user?.demo){saveLocalOutbox("feedback",value,auth.user.email);setStatus("Feedback saved on this device and queued for a future server connection.");}else{const token=await auth.getToken(); const response=await fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({message:value,type:"feedback"})}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setStatus("Thanks — your feedback was sent.");} }
  } catch(error){const code=(error as {code?:string})?.code;setStatus(code==="auth/invalid-credential"||code==="auth/wrong-password"?"Your current password is incorrect.":code==="auth/email-already-in-use"?"That email is already linked to another account.":code==="auth/popup-closed-by-user"?"Identity confirmation was cancelled.":error instanceof Error?error.message:"Unable to continue");} finally {setBusy(false);} };
  const needsValue=["Change Email","Leave feedback","Delete my account"].includes(action);
  const missingConfirmation=needsValue&&!value.trim()||action==="Change Email"&&passwordAccount&&!password;
  return <div className="member-modal-backdrop"><section role="dialog" aria-modal="true" className="member-modal settings-action"><button onClick={onClose} aria-label="Close"><X /></button><h2>{action}</h2>{action==="Delete my account"&&<p className="delete-warning">This permanently removes your profile, progress, certificates, support requests and sign-in account. This cannot be undone.</p>}{action==="Change Email"&&<><input value={value} onChange={(event)=>setValue(event.target.value)} type="email" placeholder="New email address"/>{passwordAccount?<input value={password} onChange={(event)=>setPassword(event.target.value)} type="password" placeholder="Current password"/>:<p>Google will ask you to confirm your identity before Firebase sends the verification link.</p>}</>}{action==="Leave feedback"&&<textarea value={value} onChange={(event)=>setValue(event.target.value)} placeholder="Tell us what could be better"/>}{action==="Delete my account"&&<input value={value} onChange={(event)=>setValue(event.target.value)} type="text" autoComplete="off" placeholder="Type DELETE"/>}{status&&<pre role="status">{status}</pre>}<div><button onClick={onClose}>Close</button><button className={action==="Delete my account"?"danger-action":""} onClick={run} disabled={busy||missingConfirmation}>{busy?"Please wait…":action==="Payment History"?"Load history":action==="Delete my account"?"Delete permanently":"Continue"}</button></div></section></div>;
}

function ToggleRow({ icon: Icon, label, value, onChange, disabled=false, note }: { icon: typeof Moon; label: string; value: boolean; onChange: (v: boolean) => void|Promise<void>; disabled?:boolean; note?:string }) { return <button disabled={disabled} onClick={() => void onChange(!value)}><Icon /><span>{label}</span>{disabled&&<small>{note}</small>}<i className={`switch ${value ? "on" : ""}`}><b /></i></button>; }
