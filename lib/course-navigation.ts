export type LessonMode = "read" | "listen";

export function courseEntryHref(courseId: string) {
  if (courseId === "basic-law-practice") return "/course/basic-law-practice/practice";
  if (courseId === "basic-law-mocks") return "/use-cases/basic-law-mocks";
  return `/course/${courseId}`;
}

export function courseLessonHref(courseId: string, lessonId: string, mode: LessonMode = "read") {
  if (courseId === "basic-law-practice" && lessonId === "practice-bank") {
    return "/course/basic-law-practice/practice";
  }

  if ((courseId === "basic-law-mocks" || courseId === "basic-law") && /^mock-[1-4]$/.test(lessonId)) {
    return `/course/basic-law-mocks/mock/${lessonId}`;
  }

  return `/course/${courseId}/lesson/${lessonId}?mode=${mode}`;
}
