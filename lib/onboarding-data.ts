export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ProgramId = "ai-mastery" | "personalized-ai" | "ai-accounting";

export type OnboardingState = {
  step: OnboardingStep;
  selectedProgram: ProgramId;
  completed: boolean;
};

export type ProgramDefinition = {
  id: ProgramId;
  title: string;
  description: string;
  thumbnail: "certificate" | "personalized" | "accounting";
  courseTitle: string;
  courseSubtitle: string;
};

export const ONBOARDING_STORAGE_KEY = "lumora.onboarding.v1";

export function onboardingStorageKey(userId: string) {
  return `${ONBOARDING_STORAGE_KEY}:${userId}`;
}

export const programs: ProgramDefinition[] = [
  {
    id: "ai-mastery",
    title: "AI Mastery Certificate Program",
    description: "Broad intro to leading AI tools, CPD-certified",
    thumbnail: "certificate",
    courseTitle: "ChatGPT",
    courseSubtitle: "5 courses · Beginner friendly",
  },
  {
    id: "personalized-ai",
    title: "Personalized AI Certificate Program",
    description: "Based on your quiz answers",
    thumbnail: "personalized",
    courseTitle: "Personalized AI",
    courseSubtitle: "5 courses · Built around your goals",
  },
  {
    id: "ai-accounting",
    title: "AI-Powered Accounting Program",
    description: "Transform accounting operations with AI",
    thumbnail: "accounting",
    courseTitle: "AI Accounting",
    courseSubtitle: "5 courses · Practical workflows",
  },
];

export const defaultOnboardingState: OnboardingState = {
  step: 0,
  selectedProgram: "ai-mastery",
  completed: false,
};

export function getProgram(programId: string | null | undefined) {
  return programs.find((program) => program.id === programId) ?? programs[0];
}

export function isProgramId(value: unknown): value is ProgramId {
  return programs.some((program) => program.id === value);
}
