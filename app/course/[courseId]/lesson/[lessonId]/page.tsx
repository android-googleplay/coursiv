import { Suspense } from "react";
import { GenericLessonPlayer } from "@/components/lesson/generic-lesson-player";
import { CoursivLessonPlayer } from "@/components/lesson/coursiv-lesson-player";
import { readCoursivLesson } from "@/lib/coursiv-content.server";

export default async function LessonPage({params}:{params:Promise<{courseId:string;lessonId:string}>}){const {courseId,lessonId}=await params;const canonical=await readCoursivLesson(courseId,lessonId);return <Suspense fallback={<div className="onboarding-loading"><span/></div>}>{canonical?<CoursivLessonPlayer courseId={courseId} courseTitle={canonical.course.title} lesson={canonical.lesson}/>:<GenericLessonPlayer/>}</Suspense>}
