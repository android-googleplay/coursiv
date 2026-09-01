export type BasicLawDomain = "basic-law" | "nsl";
export type BasicLawDifficulty = "easy" | "medium" | "hard";
export type BasicLawTrapType = "negative-wording" | "numbers" | "authority" | "wording";

export type BasicLawQuestion = {
  id: string;
  domain: BasicLawDomain;
  sourcePage: number;
  sourceSet: number;
  sourceQuestion: number;
  article: number | null;
  questionZh: string;
  questionEn: string;
  options: Array<{ id: string; labelZh: string; labelEn: string }>;
  correctOptionId: string;
  explanationZh: string;
  trapZh: string | null;
  trapType: BasicLawTrapType;
  difficulty: BasicLawDifficulty;
  referenceIds: string[];
  officialSource: string;
  verificationStatus: "verified-current" | "retired";
};

export type BasicLawQuestionBank = {
  schemaVersion: 2;
  internalOnly: true;
  source: string;
  generatedAt: string;
  questions: BasicLawQuestion[];
};

export type BasicLawMock = {
  id: string;
  title: string;
  durationMinutes: number;
  passScore: number;
  targetScore: number;
  questionIds: string[];
};

export type BasicLawMockCollection = {
  schemaVersion: 1;
  internalOnly: true;
  mocks: BasicLawMock[];
};
