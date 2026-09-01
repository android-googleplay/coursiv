import { certificatePrograms, getCourse, getProgramCourses, requiredCourseLessons, toolCourses } from "./member-data";
import { mergeLearnerState, type LearnerState } from "./learner-state";

export type CertificateDefinition = {
  courseId: string;
  courseTitle: string;
  courseHours: number;
};

function durationHours(duration: string) {
  return Math.max(1, Number.parseInt(duration, 10) || 1);
}

export function isCourseComplete(state: LearnerState, courseId: string) {
  const required = requiredCourseLessons(getCourse(courseId)).map((lesson) => lesson.id);
  const completed = new Set(state.courses[courseId]?.completedLessonIds ?? []);
  return required.length > 0 && required.every((lessonId) => completed.has(lessonId));
}

export function eligibleCertificateDefinitions(value: Partial<LearnerState> | null | undefined): CertificateDefinition[] {
  const state = mergeLearnerState(value);
  const courses = toolCourses
    .filter((course) => isCourseComplete(state, course.id))
    .map((course) => ({ courseId: course.id, courseTitle: course.title, courseHours: durationHours(course.duration ?? "1h") }));
  const programs = certificatePrograms
    .filter((program) => {
      const assessment = state.programAssessments[program.id];
      return Boolean(assessment?.passedAt && assessment.score >= 70) && getProgramCourses(program.id).every((course) => isCourseComplete(state, course.id));
    })
    .map((program) => ({
      courseId: `program-${program.id}`,
      courseTitle: program.title,
      courseHours: getProgramCourses(program.id).reduce((total, course) => total + durationHours(course.duration), 0),
    }));
  return [...courses, ...programs];
}
