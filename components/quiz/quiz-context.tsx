"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { quizQuestions } from "@/lib/quiz-data";

type Answers = Record<string, string[]>;
type Stage = "welcome" | "quiz" | "complete";

type PersistedQuizState = {
  stage: Stage;
  currentQuestion: number;
  answers: Answers;
};

type QuizContextValue = PersistedQuizState & {
  hydrated: boolean;
  startQuiz: () => void;
  toggleAnswer: (optionId: string) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
};

const STORAGE_KEY = "lumora.quiz.v1";
const initialState: PersistedQuizState = { stage: "welcome", currentQuestion: 0, answers: {} };
const QuizContext = createContext<QuizContextValue | null>(null);

function readStoredState(): PersistedQuizState {
  if (typeof window === "undefined") return initialState;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved) as PersistedQuizState;
    return {
      stage: parsed.stage ?? "welcome",
      currentQuestion: Math.min(Math.max(parsed.currentQuestion ?? 0, 0), quizQuestions.length - 1),
      answers: parsed.answers ?? {},
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return initialState;
  }
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedQuizState>(readStoredState);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const startQuiz = useCallback(() => setState((value) => ({ ...value, stage: "quiz" })), []);

  const toggleAnswer = useCallback((optionId: string) => {
    setState((value) => {
      const question = quizQuestions[value.currentQuestion];
      const selected = value.answers[question.id] ?? [];
      let updated: string[];

      if (question.type === "single") {
        updated = [optionId];
      } else if (optionId === "none") {
        updated = selected.includes("none") ? [] : ["none"];
      } else {
        updated = selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected.filter((id) => id !== "none"), optionId];
      }

      return { ...value, answers: { ...value.answers, [question.id]: updated } };
    });
  }, []);

  const next = useCallback(() => {
    setState((value) =>
      value.currentQuestion === quizQuestions.length - 1
        ? { ...value, stage: "complete" }
        : { ...value, currentQuestion: value.currentQuestion + 1 },
    );
  }, []);

  const back = useCallback(() => {
    setState((value) =>
      value.currentQuestion === 0
        ? { ...value, stage: "welcome" }
        : { ...value, currentQuestion: value.currentQuestion - 1 },
    );
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  const contextValue = useMemo(
    () => ({ ...state, hydrated, startQuiz, toggleAnswer, next, back, reset }),
    [state, hydrated, startQuiz, toggleAnswer, next, back, reset],
  );

  return <QuizContext.Provider value={contextValue}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) throw new Error("useQuiz must be used within QuizProvider");
  return context;
}
