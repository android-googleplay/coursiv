"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, BookOpen, Check, ChevronDown, ChevronLeft, Info, LockKeyhole, Menu, Play, X } from "lucide-react";
import { allCourseLessons, certificatePrograms, courseCatalog, getCourse, type CatalogItem, type CourseDefinition, type LessonDefinition } from "@/lib/member-data";
import { LESSON_ID } from "@/lib/lesson-data";
import { LessonModal } from "./lesson-modal";
import { useLearner } from "@/components/member/learner-context";

type NodeState = "available" | "locked" | "completed";

function LessonNode({ lesson, index, state, onOpen }: { lesson: LessonDefinition; index: number; state: NodeState; onOpen: () => void }) {
  return (
    <article className={`member-lesson-node ${index % 2 ? "right" : "left"} ${state}`}>
      <button type="button" onClick={onOpen} aria-label={`${state === "completed" ? "Review" : state === "locked" ? "Preview" : "Start"} ${lesson.title}`}>
        {state === "completed" ? <Check size={34} strokeWidth={3.5} /> : state === "locked" ? <LockKeyhole size={27} /> : index === 0 ? <Play size={31} fill="currentColor" /> : <BookOpen size={29} fill="currentColor" />}
      </button>
      <h2>{lesson.title}</h2>
    </article>
  );
}

export function CourseExperience({runtimeCourse,runtimeCatalog=[],runtimeCourses=[]}:{runtimeCourse?:CourseDefinition;runtimeCatalog?:CatalogItem[];runtimeCourses?:CourseDefinition[]}={}) {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { state: learnerState, resetCourse } = useLearner();
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
  const [lockedLesson, setLockedLesson] = useState<string | null>(null);
  const completedLessonIds = learnerState.courses[course.id]?.completedLessonIds ?? [];
  const courseLessons = useMemo(() => allCourseLessons(course), [course]);
  const completedCount = completedLessonIds.length;
  const score = courseLessons.length?Math.min(100,Math.round(completedCount/courseLessons.length*100)):0;
  const resumeLesson = courseLessons.find((lesson) => !completedLessonIds.includes(lesson.id)) ?? courseLessons.at(-1);
  const relatedProgram = certificatePrograms.find((program)=>program.courseIds.includes(course.id));
  const relatedCourseIndex = relatedProgram?.courseIds.indexOf(course.id)??-1;
  const nextCourseTitle = relatedProgram&&relatedCourseIndex >= 0 && relatedCourseIndex < relatedProgram.courseIds.length - 1 ? getCourse(relatedProgram.courseIds[relatedCourseIndex + 1]).title : relatedProgram?`${relatedProgram.title} skills check`:"Explore more practical courses";

  const closeModal = useCallback(() => setModalOpen(false), []);
  const reset=async()=>{if(!window.confirm("Reset all learning progress for this course? Earned certificates will remain in your profile."))return;setResetting(true);setCourseError("");try{await resetCourse(course.id);setMenuOpen(false)}catch(reason){setCourseError(reason instanceof Error?reason.message:"Unable to reset course progress")}finally{setResetting(false)}};

  if(!courseExists)return <main className="course-stage member-course-stage"><section className="member-content empty-page"><h1>Course not found</h1><p>This link does not match any available Coursiv course.</p><button className="member-primary" onClick={()=>router.push("/courses")}>Browse Courses</button></section></main>;

  return (
    <main className="course-stage member-course-stage">
      <header className="course-header">
        <button type="button" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard"><ChevronLeft size={26} /></button>
        <button className="course-title-button" onClick={() => setSwitcher((value) => !value)}><strong>{course.title} <ChevronDown size={17} /></strong><span>Last updated July 2026</span></button>
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
          {course.sections.map((section) => <div className="course-section" key={section.title ?? "course-start"}>{section.title && <div className="section-divider"><span>{section.title}</span></div>}{section.lessons.map((lesson) => {
            const index = courseLessons.findIndex((item) => item.id === lesson.id);
            const state: NodeState = completedLessonIds.includes(lesson.id) ? "completed" : index <= completedLessonIds.length ? "available" : "locked";
            return <LessonNode key={lesson.id} lesson={lesson} index={index} state={state} onOpen={() => { if(state==="locked"){setLockedLesson(lesson.title);return;} setSelectedLesson(lesson);setModalOpen(true); }} />;
          })}</div>)}
        </div>

        <section className="course-completion-card"><TrophyMark /><span><strong>{completedCount}/{courseLessons.length} lessons complete</strong><small>Complete every lesson to unlock your certificate.</small></span></section>
        <section className="up-next-card"><small>UP NEXT</small><strong>{nextCourseTitle}</strong><button onClick={() => router.push(relatedProgram?`/certificate-programs/${relatedProgram.id}`:"/courses")}>{relatedProgram?"View program":"Browse courses"}</button></section>
      </section>

      {modalOpen && selectedLesson && <LessonModal courseTitle={course.title} lessonTitle={selectedLesson.title} onClose={closeModal} onRead={() => router.push(selectedLesson.id===LESSON_ID?"/course/ai-mastery/lesson/discovering-modes?mode=read":`/course/${course.id}/lesson/${selectedLesson.id}?mode=read`)} onListen={() => router.push(selectedLesson.id===LESSON_ID?"/course/ai-mastery/lesson/discovering-modes?mode=listen":`/course/${course.id}/lesson/${selectedLesson.id}?mode=listen`)} />}
      {menuOpen && <div className="lesson-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}><section className="course-menu-modal" role="dialog" aria-modal="true"><button type="button" onClick={()=>setMenuOpen(false)} aria-label="Close"><X size={19}/></button><span className="unit-thumbnail" style={{background:`linear-gradient(135deg, ${course.color}, #6962ff)`}}>AI</span><h2>{course.title}</h2><p>{courseLessons.length} practical lessons · {course.duration}<br/>Progress: {completedCount} completed · {score}%</p><button onClick={()=>{setMenuOpen(false);if(resumeLesson){setSelectedLesson(resumeLesson);setModalOpen(true)}}}><Play/> {score===100?"Review final lesson":"Continue learning"}</button>{relatedProgram&&<button className="secondary" onClick={()=>router.push(`/certificate-programs/${relatedProgram.id}`)}><BadgeCheck/>View certificate program</button>}{completedCount>0&&<button className="danger" disabled={resetting} onClick={()=>void reset()}>{resetting?"Resetting…":"Reset course progress"}</button>}{courseError&&<p className="assistant-error" role="alert">{courseError}</p>}</section></div>}
      {lockedLesson && <div className="lesson-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLockedLesson(null)}><section className="coming-soon-modal" role="dialog" aria-modal="true"><button type="button" onClick={() => setLockedLesson(null)} aria-label="Close"><X size={19} /></button><LockKeyhole/><h2>Lesson locked</h2><p>Complete the previous lesson before starting {lockedLesson}.</p></section></div>}
    </main>
  );
}

function TrophyMark() { return <span className="trophy-mark">🏆</span>; }
