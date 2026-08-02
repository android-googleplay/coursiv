import { allCourseLessons, getCourse, getProgramCourses } from "./member-data";

export type CourseLearningProgress = {
  completedLessonIds: string[];
  lastLessonId: string | null;
  lastScreenId: string | null;
  updatedAt: string | null;
};

export type ChallengeLearningProgress = {
  joinedAt: string;
  completedDays: number[];
  completedDayDates: Record<string, string>;
  completedAt: string | null;
};

export type LearnerPreferences = {
  language: string;
  darkMode: boolean;
  soundEffects: boolean;
  pushNotifications: boolean;
  analyticsConsent: boolean;
  timezone: string;
};

export type AiConversation = {
  id: string;
  title: string;
  messages: { role: "user" | "assistant"; text: string }[];
  updatedAt: string;
};

export type LearnerState = {
  version: 2;
  courses: Record<string, CourseLearningProgress>;
  activityDates: string[];
  challenges: Record<string, ChallengeLearningProgress>;
  gamePoints: number;
  completedGameIds: string[];
  programAssessments: Record<string, { score: number; passedAt: string | null }>;
  preferences: LearnerPreferences;
  conversations: AiConversation[];
};

export const LEARNER_STATE_STORAGE_KEY = "lumora.learner.state.v2";

export function learnerStateStorageKey(userId: string) {
  return `${LEARNER_STATE_STORAGE_KEY}:${userId}`;
}

export function localDateKey(date = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function defaultLearnerState(): LearnerState {
  const timezone = typeof Intl === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    version: 2,
    courses: {},
    activityDates: [],
    challenges: {},
    gamePoints: 0,
    completedGameIds: [],
    programAssessments: {},
    preferences: { language: "English", darkMode: false, soundEffects: true, pushNotifications: false, analyticsConsent: true, timezone },
    conversations: [],
  };
}

export function mergeLearnerState(value: Partial<LearnerState> | null | undefined): LearnerState {
  const fallback = defaultLearnerState();
  if (!value) return fallback;
  return {
    ...fallback,
    ...value,
    version: 2,
    courses: value.courses ?? {},
    activityDates: Array.from(new Set(value.activityDates ?? [])).sort(),
    challenges: Object.fromEntries(Object.entries(value.challenges ?? {}).map(([id, entry]) => [id, { ...entry, completedDayDates: entry.completedDayDates ?? {} }])),
    completedGameIds: Array.from(new Set(value.completedGameIds ?? [])),
    programAssessments: value.programAssessments ?? {},
    preferences: { ...fallback.preferences, ...(value.preferences ?? {}) },
    conversations: value.conversations ?? [],
  };
}

export function canCompleteChallengeDay(entry: ChallengeLearningProgress | null | undefined, todayKey: string) {
  return !Object.values(entry?.completedDayDates ?? {}).includes(todayKey);
}

export function coursePercent(state: LearnerState, courseId: string) {
  const course = getCourse(courseId);
  const completed = state.courses[courseId]?.completedLessonIds.length ?? 0;
  return Math.min(100, Math.round((completed / allCourseLessons(course).length) * 100));
}

export function programCompletedCourses(state: LearnerState, programId = "ai-mastery") {
  return getProgramCourses(programId).filter((course) => coursePercent(state, course.id) === 100).length;
}

export function programPercent(state: LearnerState, programId: string) {
  const courses = getProgramCourses(programId);
  if (!courses.length) return 0;
  return Math.round(courses.reduce((total, course) => total + coursePercent(state, course.id), 0) / courses.length);
}

function dateAtUtcNoon(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

export function calculateStreaks(activityDates: string[], todayKey: string) {
  const unique = Array.from(new Set(activityDates)).sort();
  const set = new Set(unique);
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of unique) {
    const date = dateAtUtcNoon(key);
    run = previous && Math.round((date.getTime() - previous.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  let cursor = dateAtUtcNoon(todayKey);
  if (!set.has(todayKey)) cursor = new Date(cursor.getTime() - 86_400_000);
  let current = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return { current, longest, todayComplete: set.has(todayKey) };
}

export function weekDateKeys(today = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") {
  const todayKey = localDateKey(today, timezone);
  const base = dateAtUtcNoon(todayKey);
  const day = base.getUTCDay() || 7;
  const monday = new Date(base.getTime() - (day - 1) * 86_400_000);
  return Array.from({ length: 7 }, (_, index) => new Date(monday.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}
