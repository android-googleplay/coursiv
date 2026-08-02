import { describe, expect, it } from "vitest";
import type { ValidatableLesson } from "./admin-content-validation";
import { blockHasAnswerKey, lessonPreviewReadiness } from "./admin-lesson-readiness";

const lesson = (): ValidatableLesson => {
  const screens: ValidatableLesson["screens"] = [
    {
      id: "screen-1",
      sourcePageId: "page-1",
      order: 0,
      type: "chunk",
      presentation: "content",
      interactionPolicy: "read",
      blocks: [
        { id: "heading-1", type: "heading", text: "Welcome", level: 2 },
        { id: "image-1", type: "image", src: "/image.webp", alt: "Example" },
      ],
    },
    {
      id: "screen-2",
      sourcePageId: "page-2",
      order: 1,
      type: "quiz",
      presentation: "knowledge-check",
      interactionPolicy: "required-interaction",
      blocks: [{
        id: "quiz-1",
        type: "multi-choice",
        question: "Choose every correct answer",
        options: [
          { id: "answer-1", label: "A", isCorrect: true },
          { id: "answer-2", label: "B", isCorrect: false },
        ],
      }],
    },
    {
      id: "screen-3",
      sourcePageId: "page-3",
      order: 2,
      type: "practice",
      presentation: "practice",
      interactionPolicy: "optional-practice",
      blocks: [{ id: "practice-1", type: "practice", title: "Try it" }],
    },
  ];
  return {
    id: "lesson-1",
    courseId: "course-1",
    schemaVersion: 3,
    sourceId: "source-1",
    sourceUnitId: "unit-1",
    sourceGuideId: "guide-1",
    slug: "lesson-1",
    title: "Lesson one",
    order: 0,
    readUrl: "",
    hasAudio: false,
    screens,
    blocks: screens.flatMap((screen) => screen.blocks),
    raw: {},
  };
};

describe("CMS lesson preview readiness", () => {
  it("summarises content and interaction health", () => {
    expect(lessonPreviewReadiness(lesson())).toEqual({
      screens: 3,
      blocks: 4,
      interactions: 2,
      requiredInteractions: 1,
      optionalPractices: 1,
      images: 1,
      videos: 0,
      errors: [],
      ready: true,
    });
  });

  it("surfaces publish validation failures", () => {
    const value = lesson();
    value.screens[1].blocks = [{
      id: "quiz-1",
      type: "single-choice",
      question: "Broken question",
      options: [
        { id: "answer-1", label: "A", isCorrect: false },
        { id: "answer-2", label: "B", isCorrect: false },
      ],
    }];
    const result = lessonPreviewReadiness(value);
    expect(result.ready).toBe(false);
    expect(result.errors.join(" ")).toContain("has no correct answer");
  });

  it("only exposes answer mode for graded activities", () => {
    expect(blockHasAnswerKey({ id: "a", type: "paragraph", text: "Read me" })).toBe(false);
    expect(blockHasAnswerKey({
      id: "b",
      type: "ordering-task",
      title: "Order",
      items: ["Second", "First"],
      correctItems: ["First", "Second"],
    })).toBe(true);
  });
});
