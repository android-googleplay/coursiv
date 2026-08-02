export type WorksheetSubject = "english" | "chinese" | "logic" | "math";
export type WorksheetLevel = "k1" | "k2" | "p1" | "p2";
export type UiLocale = "zh-HK" | "en";

export type WorksheetConfig = {
  subject: WorksheetSubject;
  level: WorksheetLevel;
  questionCount: number;
  questionsPerPage: number;
  includeAnswers: boolean;
  locale: UiLocale;
  seed: number;
};

export type MatchQuestion = {
  kind: "match";
  id: string;
  left: string[];
  right: string[];
  answers: number[];
};

export type MathQuestion = {
  kind: "math";
  id: string;
  expression: string;
  answer: number;
};

export type LogicQuestion = {
  kind: "logic";
  id: string;
  puzzle: number[];
  solution: number[];
};

export type GeneratedQuestion = MatchQuestion | MathQuestion | LogicQuestion;

export type AnswerEntry = {
  questionId: string;
  answer: string;
};

export type WorksheetDefinition = {
  config: WorksheetConfig;
  title: string;
  instruction: string;
  questions: GeneratedQuestion[];
  answers: AnswerEntry[];
};

