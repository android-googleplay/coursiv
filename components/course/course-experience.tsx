"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, BookOpen, Check, ChevronDown, ChevronLeft, Info, LockKeyhole, Menu, Play, X } from "lucide-react";
import { allCourseLessons, certificatePrograms, courseCatalog, getCourse, requiredCourseLessons, type CatalogItem, type CourseDefinition, type LessonDefinition } from "@/lib/member-data";
import { LESSON_ID } from "@/lib/lesson-data";
import { LessonModal } from "./lesson-modal";
import { useLearner } from "@/components/member/learner-context";
import { useAuth } from "@/components/auth/auth-context";
import { courseUnlocksAllLessons, lessonNodeState, type LessonNodeState } from "@/lib/course-access";
import { hasStartedLesson, lessonStartedStorageKey } from "@/lib/learner-state";
import { ButtonText } from "../member/button-text";

const EMPTY_COMPLETED_LESSON_IDS:string[]=[];

function courseUpdatedLabel(value?: string) {
  if (!value) return "July 2026";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "July 2026" : new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function LessonNode({ lesson, code, index, state, justCompleted, buttonRef, onOpen }: { lesson: LessonDefinition; code: string; index: number; state: LessonNodeState; justCompleted: boolean; buttonRef: (node: HTMLButtonElement | null) => void; onOpen: () => void }) {
  return (
    <article className={`member-lesson-node ${index % 2 ? "right" : "left"} ${state}${justCompleted ? " just-completed" : ""}`} data-lesson-id={lesson.id}>
      <button ref={buttonRef} type="button" onClick={onOpen} aria-label={`${code} · ${state === "completed" ? "Review" : state === "locked" ? "Preview" : "Start"} ${lesson.title}`}>
        {state === "completed" ? <Check size={34} strokeWidth={3.5} /> : state === "locked" ? <LockKeyhole size={27} /> : index === 0 ? <Play size={31} fill="currentColor" /> : <BookOpen size={29} fill="currentColor" />}
      </button>
      <h2><small>{code}</small><span>{lesson.title}</span></h2>
    </article>
  );
}

export function CourseExperience({runtimeCourse,runtimeCatalog=[],runtimeCourses=[]}:{runtimeCourse?:CourseDefinition;runtimeCatalog?:CatalogItem[];runtimeCourses?:CourseDefinition[]}={}) {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { state: learnerState, resetCourse, resetLesson } = useLearner();
  const normalizedId = params.courseId === "ai-mastery" ? "chatgpt" : params.courseId;
  const effectiveCatalog=runtimeCatalog.length?runtimeCatalog:courseCatalog;
  const courseExists = Boolean(runtimeCourse)||effectiveCatalog.some((item)=>item.id===normalizedId);
  const course = runtimeCourse??runtimeCourses.find((item)=>item.id===normalizedId)??getCourse(normalizedId);
  const [switcher, setSwitcher] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonDefinition | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [restartingLesson, setRestartingLesson] = useState(false);
  const [lessonRestartError, setLessonRestartError] = useState("");
  const [selectedLessonStarted, setSelectedLessonStarted] = useState(false);
  const [lockedLesson, setLockedLesson] = useState<string | null>(null);
  const lessonButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const completedLessonId = searchParams.get("completedLesson");
  const courseProgress = learnerState.courses[course.id];
  const completedLessonIds = courseProgress?.completedLessonIds ?? EMPTY_COMPLETED_LESSON_IDS;
  const hasCourseProgress = Boolean(completedLessonIds.length || courseProgress?.lastLessonId || courseProgress?.lastScreenId);
  const isShortsCourse = course.id === "google-sheet-with-ai-shorts" || course.id === "google-slide-with-ai-short";
  const allLessonsUnlocked = courseUnlocksAllLessons({
    demoUser: auth.user?.demo === true,
    shortsCourse: isShortsCourse,
    debugMode: process.env.NEXT_PUBLIC_COURSIV_DEBUG_ADMIN === "true",
  });
  const courseLessons = useMemo(() => allCourseLessons(course), [course]);
  const requiredLessons = useMemo(() => requiredCourseLessons(course), [course]);
  const completedCount = requiredLessons.filter((lesson)=>completedLessonIds.includes(lesson.id)).length;
  const score = requiredLessons.length?Math.min(100,Math.round(completedCount/requiredLessons.length*100)):0;
  const resumeLesson = courseLessons.find((lesson) => !completedLessonIds.includes(lesson.id)) ?? courseLessons.at(-1);
  const relatedProgram = certificatePrograms.find((program)=>program.courseIds.includes(course.id));
  const relatedCourseIndex = relatedProgram?.courseIds.indexOf(course.id)??-1;
  const nextCourseTitle = relatedProgram&&relatedCourseIndex >= 0 && relatedCourseIndex < relatedProgram.courseIds.length - 1 ? getCourse(relatedProgram.courseIds[relatedCourseIndex + 1]).title : relatedProgram?`${relatedProgram.title} skills check`:"Explore more practical courses";

  useEffect(()=>{
    if(!completedLessonId||!completedLessonIds.includes(completedLessonId))return;
    const frame=requestAnimationFrame(()=>{
      const target=lessonButtonRefs.current.get(completedLessonId);
      if(!target)return;
      target.scrollIntoView({behavior:"smooth",block:"center"});
      target.focus({preventScroll:true});
    });
    const cleanup=window.setTimeout(()=>window.history.replaceState(window.history.state,"",`/course/${course.id}`),1400);
    return()=>{cancelAnimationFrame(frame);window.clearTimeout(cleanup)};
  },[completedLessonId,completedLessonIds,course.id]);

  const closeModal = useCallback(() => setModalOpen(false), []);
  const openLessonModal=useCallback((lesson:LessonDefinition)=>{
    const hasLocalProgress=typeof window!=="undefined"&&localStorage.getItem(lessonStartedStorageKey(course.id,lesson.id))==="1";
    const started=hasLocalProgress||hasStartedLesson(courseProgress,lesson.id);
    setSelectedLesson(lesson);
    setSelectedLessonStarted(started);
    setLessonRestartError("");
    setModalOpen(true);
  },[course.id,courseProgress]);
  const reset=async()=>{if(!window.confirm("Reset all learning progress for this course? Earned certificates will remain in your profile."))return;setResetting(true);setCourseError("");try{await resetCourse(course.id);setMenuOpen(false)}catch(reason){setCourseError(reason instanceof Error?reason.message:"Unable to reset course progress")}finally{setResetting(false)}};
  const restartSelectedLesson=async()=>{if(!selectedLesson||restartingLesson||!window.confirm("Restart this lesson? Your progress and answers for this lesson will be cleared."))return;setRestartingLesson(true);setLessonRestartError("");try{await resetLesson(course.id,selectedLesson.id);router.push(selectedLesson.id===LESSON_ID?"/course/ai-mastery/lesson/discovering-modes?mode=read&restart=1":`/course/${course.id}/lesson/${selectedLesson.id}?mode=read&restart=1`)}catch(reason){setLessonRestartError(reason instanceof Error?reason.message:"Unable to restart this lesson")}finally{setRestartingLesson(false)}};

  if(!courseExists)return <main className="course-stage member-course-stage"><section className="member-content empty-page"><h1>Course not found</h1><p>This link does not match any available Coursiv course.</p><button className="member-primary" onClick={()=>router.push("/courses")}><ButtonText>Browse Courses</ButtonText></button></section></main>;

  return (
    <main className="course-stage member-course-stage">
      <header className="course-header">
        <button type="button" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard"><ChevronLeft size={26} /></button>
        <button type="button" className="course-title-button" aria-expanded={switcher} onClick={() => setSwitcher((value) => !value)}><strong><span className="course-title-text">{course.title}</span><ChevronDown size={17} /></strong><span>{`Last updated ${courseUpdatedLabel(course.sourceUpdatedAt)}`}</span></button>
        <span className="course-score"><BadgeCheck size={17} fill="currentColor" /> {score}%</span>
      </header>
      {switcher && <div className="course-switcher">{effectiveCatalog.map((catalogItem) => {const item=runtimeCourses.find((value)=>value.id===catalogItem.id)??getCourse(catalogItem.id);return <button key={item.id} className={item.id === course.id ? "active" : ""} onClick={() => { setSwitcher(false); router.push(`/course/${item.id}`); }}><i style={{ background: item.color }}>{item.title.slice(0, 2)}</i><span><strong>{item.title}</strong><small>{allCourseLessons(item).length} lessons · {item.duration}</small></span>{item.id === course.id && <Check size={18} />}</button>})}</div>}

      <section className="course-map member-course-map">
        <div className="unit-card">
          <span className="unit-thumbnail" style={{ background: `linear-gradient(135deg, ${course.color}, #6962ff)` }}><span>AI</span></span>
          <div><small>UNIT 1</small><strong>{course.title}</strong><span><Info size={15} /> About this course</span></div>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open course menu"><Menu size={26} /></button>
        </div>

        <div className="member-path">
          {course.sections.map((section,sectionIndex) => {const sectionCode=String.fromCharCode(65+sectionIndex);return <div className="course-section" key={section.title ?? "course-start"}>{section.title && <div className="section-divider"><b>{sectionCode}</b><span>{section.title}</span></div>}{section.lessons.map((lesson,lessonIndex) => {
            const index = courseLessons.findIndex((item) => item.id === lesson.id);
            const state = lessonNodeState({ lessonId:lesson.id,lessonIndex:index,completedLessonIds,allLessonsUnlocked });
            const code=`${sectionCode}${lessonIndex+1}`;
            return <LessonNode key={lesson.id} lesson={lesson} code={code} index={index} state={state} justCompleted={completedLessonId===lesson.id&&state==="completed"} buttonRef={(node)=>{if(node)lessonButtonRefs.current.set(lesson.id,node);else lessonButtonRefs.current.delete(lesson.id)}} onOpen={() => { if(state==="locked"){setLockedLesson(lesson.title);return;} if(isShortsCourse||course.id==="basic-law"&&lesson.id.startsWith("mock-")){router.push(`/course/${course.id}/lesson/${lesson.id}`);return;} openLessonModal(lesson); }} />;
          })}</div>})}
        </div>

        <section className="course-completion-card"><TrophyMark /><span><strong>{`${completedCount}/${requiredLessons.length} ${requiredLessons.length===courseLessons.length?"lessons":"core lessons"} complete`}</strong><small>Complete every required lesson to unlock your certificate.</small></span></section>
        <section className="up-next-card"><small>UP NEXT</small><strong>{nextCourseTitle}</strong><button onClick={() => router.push(relatedProgram?`/certificate-programs/${relatedProgram.id}`:"/courses")}><ButtonText>{relatedProgram?"View program":"Browse courses"}</ButtonText></button></section>
      </section>

      {modalOpen && selectedLesson && <LessonModal courseTitle={course.title} lessonTitle={selectedLesson.title} onClose={closeModal} onRead={() => router.push(selectedLesson.id===LESSON_ID?"/course/ai-mastery/lesson/discovering-modes?mode=read":`/course/${course.id}/lesson/${selectedLesson.id}?mode=read`)} onListen={() => router.push(selectedLesson.id===LESSON_ID?"/course/ai-mastery/lesson/discovering-modes?mode=listen":`/course/${course.id}/lesson/${selectedLesson.id}?mode=listen`)} onRestart={selectedLessonStarted?()=>void restartSelectedLesson():undefined} restarting={restartingLesson} restartError={selectedLessonStarted?lessonRestartError:""} />}
      {menuOpen && <div className="lesson-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}><section className="course-menu-modal" role="dialog" aria-modal="true"><button type="button" onClick={()=>setMenuOpen(false)} aria-label="Close"><X size={19}/></button><span className="unit-thumbnail" style={{background:`linear-gradient(135deg, ${course.color}, #6962ff)`}}>AI</span><h2>{course.title}</h2><p>{courseLessons.length} practical lessons · {course.duration}<br/>Progress: {completedCount} completed · {score}%</p><button onClick={()=>{setMenuOpen(false);if(resumeLesson)openLessonModal(resumeLesson)}}><Play/> <ButtonText>{score===100?"Review final lesson":"Continue learning"}</ButtonText></button>{relatedProgram&&<button className="secondary" onClick={()=>router.push(`/certificate-programs/${relatedProgram.id}`)}><BadgeCheck/><ButtonText>View certificate program</ButtonText></button>}{hasCourseProgress&&<button className="danger" disabled={resetting} onClick={()=>void reset()}><ButtonText>{resetting?"Resetting…":"Reset course progress"}</ButtonText></button>}{courseError&&<p className="assistant-error" role="alert">{courseError}</p>}</section></div>}
      {lockedLesson && <div className="lesson-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLockedLesson(null)}><section className="coming-soon-modal" role="dialog" aria-modal="true"><button type="button" onClick={() => setLockedLesson(null)} aria-label="Close"><X size={19} /></button><LockKeyhole/><h2>Lesson locked</h2><p>Complete the previous lesson before starting {lockedLesson}.</p></section></div>}
    </main>
  );
}

function TrophyMark() { return <span className="trophy-mark">🏆</span>; }
