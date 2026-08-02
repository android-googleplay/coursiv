import "server-only";

import type { CertificateDefinition } from "./certificate-eligibility";
import { readCoursivCatalog } from "./coursiv-content.server";
import { certificatePrograms } from "./member-data";
import { mergeLearnerState, type LearnerState } from "./learner-state";

function durationHours(duration: string) {
  return Math.max(1, Number.parseInt(duration, 10) || 1);
}

export async function eligibleCertificateDefinitionsFromContent(value: Partial<LearnerState> | null | undefined): Promise<CertificateDefinition[]> {
  const state=mergeLearnerState(value);
  const catalog=await readCoursivCatalog({includeArchived:true});
  const completed=(courseId:string,lessonIds:string[])=>{
    const done=new Set(state.courses[courseId]?.completedLessonIds??[]);
    return lessonIds.length>0&&lessonIds.every((lessonId)=>done.has(lessonId));
  };
  const courses=catalog.filter((course)=>course.kind==="tool").filter((course)=>completed(course.id,course.sections.flatMap((section)=>section.lessons.map((lesson)=>lesson.id)))).map((course)=>({courseId:course.id,courseTitle:course.title,courseHours:durationHours(course.duration)}));
  const byId=new Map(catalog.map((course)=>[course.id,course]));
  const programs=certificatePrograms.filter((program)=>{
    const assessment=state.programAssessments[program.id];
    return Boolean(assessment?.passedAt&&assessment.score>=70)&&program.courseIds.every((courseId)=>{const course=byId.get(courseId);return Boolean(course&&completed(courseId,course.sections.flatMap((section)=>section.lessons.map((lesson)=>lesson.id))))});
  }).map((program)=>({courseId:`program-${program.id}`,courseTitle:program.title,courseHours:program.courseIds.reduce((total,courseId)=>total+durationHours(byId.get(courseId)?.duration??"1 hour"),0)}));
  return [...courses,...programs];
}
