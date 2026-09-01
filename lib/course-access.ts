export type LessonNodeState = "available" | "locked" | "completed";

export function courseUnlocksAllLessons({
  demoUser,
  shortsCourse,
  debugMode,
}: {
  demoUser: boolean;
  shortsCourse: boolean;
  debugMode: boolean;
}) {
  return demoUser || shortsCourse || debugMode;
}

export function lessonNodeState({
  lessonId,
  lessonIndex,
  completedLessonIds,
  allLessonsUnlocked,
}: {
  lessonId: string;
  lessonIndex: number;
  completedLessonIds: string[];
  allLessonsUnlocked: boolean;
}): LessonNodeState {
  if (completedLessonIds.includes(lessonId)) return "completed";
  if (allLessonsUnlocked || lessonIndex <= completedLessonIds.length) return "available";
  return "locked";
}
