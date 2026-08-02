import { lessonScreens } from "./lesson-data";
import { aiMasteryCourses, allCourseLessons, courseCatalog, getCourse } from "./member-data";

export const GENERIC_LESSON_SCREEN_IDS = ["step-0", "step-1", "step-2", "step-3"] as const;

export function isKnownCourse(courseId: string) {
  return courseCatalog.some((course) => course.id === courseId);
}

export function lessonRequirement(courseId: string, lessonId: string) {
  if (!isKnownCourse(courseId)) return null;
  let course = getCourse(courseId);
  let lesson = allCourseLessons(course).find((item) => item.id === lessonId);
  if (!lesson) {
    const legacyCourse = aiMasteryCourses.find((item) => item.id === courseId);
    const legacyLesson = legacyCourse ? allCourseLessons(legacyCourse).find((item) => item.id === lessonId) : undefined;
    if (legacyCourse && legacyLesson) { course = legacyCourse; lesson = legacyLesson; }
  }
  if (!lesson) return null;
  const screenIds = lesson.screenIds?.length ? lesson.screenIds : courseId === "chatgpt" && lessonId === "discovering-modes"
    ? lessonScreens.map((screen) => screen.id)
    : [...GENERIC_LESSON_SCREEN_IDS];
  return { course, lesson, screenIds };
}

export function learningLessonDocumentId(courseId: string, lessonId: string) {
  return `${courseId}__${lessonId}`;
}
