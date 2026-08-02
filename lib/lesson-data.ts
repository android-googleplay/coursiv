export type LessonMode = "read" | "listen";
export type ReasoningAnswer = "deep" | "speed";
export type TaskAnswer = "complex" | "simple";

export type LessonScreenId =
  | "possibilities"
  | "first-challenge"
  | "before-you-dive"
  | "model-tiers"
  | "intelligence-levels"
  | "reasoning-check"
  | "instant-explanation"
  | "task-challenge"
  | "deeper-reasoning"
  | "higher-intelligence";

export type LessonScreen = {
  id: LessonScreenId;
  progress: number;
  narration: string[];
};

export type LessonAnswerState = {
  reasoningChoice: ReasoningAnswer | null;
  reasoningSubmitted: boolean;
  taskChoice: TaskAnswer | null;
  taskResult: "correct" | "incorrect" | null;
};

export type LessonSession = {
  screenId: LessonScreenId;
  answers: LessonAnswerState;
  attempts: number;
};

export type CourseProgress = {
  completedLessonIds: string[];
};

export const LESSON_ID = "discovering-modes";
export const LESSON_STORAGE_KEY = "lumora.lesson.chatgpt.discovering-modes.v1";
export const COURSE_PROGRESS_STORAGE_KEY = "lumora.course.progress.v1";

export function lessonStorageKey(userId:string){return `${LESSON_STORAGE_KEY}:${userId}`;}

export const lessonScreens: LessonScreen[] = [
  {
    id: "possibilities",
    progress: 0,
    narration: [
      "Endless Possibilities With ChatGPT.",
      "Most people who use ChatGPT are only scratching the surface, and don't even know it. They type a question, get an answer, and call it a day.",
      "It works, but it's a fraction of what the tool can actually do. There's a whole layer of modes and features that completely changes how you interact with it, and this course is where you find out what you've been missing.",
    ],
  },
  {
    id: "first-challenge",
    progress: 3,
    narration: [
      "Your First ChatGPT Challenge.",
      "Imagine you're preparing for a job interview. You need company research, a tailored answer to tell me about yourself, and three practice questions, all from ChatGPT. Using the same approach for all three would slow you down.",
      "This lesson shows you how to match the right ChatGPT intelligence level and feature to the right task.",
    ],
  },
  {
    id: "before-you-dive",
    progress: 6,
    narration: [
      "Before You Dive In.",
      "Open ChatGPT, and the home page offers two modes: Chat and Work. Chat is where everyday tasks happen, questions, drafts, and research.",
      "Work is the power mode: an advanced workspace with extra settings for specialized, heavy-duty tasks.",
      "This course sticks with Chat. It covers most tasks you'll run into daily. Work gets its own deep dive in a separate course.",
    ],
  },
  {
    id: "model-tiers",
    progress: 10,
    narration: [
      "ChatGPT runs on a family of models that keep updating. The latest generation, GPT-5.6, comes in three tiers.",
      "Sol, the flagship and most capable. Terra, balances capability, speed, and cost. Luna, the fastest and lowest-cost in the family.",
      "Tiers and availability may change over time. In a standard ChatGPT conversation, however, you usually choose a reasoning level, not a model.",
    ],
  },
  {
    id: "intelligence-levels",
    progress: 14,
    narration: [
      "That reasoning level is the Intelligence setting.",
      "It has three levels, Instant, Medium, and High, and the one you pick shapes how much reasoning ChatGPT puts into your response.",
    ],
  },
  {
    id: "reasoning-check",
    progress: 17,
    narration: [
      "Say you need to quickly write a summary section in your resume as soon as possible. What would you choose? A level built to think longer and go deeper, or a level built for speed and immediate output?",
    ],
  },
  {
    id: "instant-explanation",
    progress: 20,
    narration: [
      "For quick, straightforward tasks, Instant is your best pick. It's the fastest option, designed for everyday questions and immediate results.",
    ],
  },
  {
    id: "task-challenge",
    progress: 23,
    narration: [
      "Task Challenge. Evaluate this task and decide if it's simple or complex.",
      "Research the company, analyze the role, create interview answers, and give me practice questions.",
    ],
  },
  {
    id: "deeper-reasoning",
    progress: 27,
    narration: [
      "A multi-step task like this benefits from more reasoning. This is exactly what Medium and High are built for.",
      "Both spend more time thinking than Instant, so expect a slower, but deeper, response.",
    ],
  },
  {
    id: "higher-intelligence",
    progress: 30,
    narration: [
      "Prefer to skip the choice? Turn on Higher intelligence so Instant scales up to a higher intelligence level when a task needs deeper thinking.",
      "Find it in Settings, then General.",
    ],
  },
];

export const defaultLessonSession: LessonSession = {
  screenId: "possibilities",
  answers: {
    reasoningChoice: null,
    reasoningSubmitted: false,
    taskChoice: null,
    taskResult: null,
  },
  attempts: 0,
};

export function getLessonScreen(screenId: LessonScreenId) {
  return lessonScreens.find((screen) => screen.id === screenId) ?? lessonScreens[0];
}

export function getLessonScreenIndex(screenId: LessonScreenId) {
  const index = lessonScreens.findIndex((screen) => screen.id === screenId);
  return index < 0 ? 0 : index;
}

export function readCourseProgress(): CourseProgress {
  if (typeof window === "undefined") return { completedLessonIds: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY) ?? "{}") as Partial<CourseProgress>;
    return { completedLessonIds: Array.isArray(parsed.completedLessonIds) ? parsed.completedLessonIds : [] };
  } catch {
    return { completedLessonIds: [] };
  }
}
