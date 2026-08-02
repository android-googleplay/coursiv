import type { CoursivLessonScreen } from "@/lib/coursiv-content";

export type LessonStarterTemplate = "content" | "image" | "quiz" | "practice";

export function buildLessonStarter(
  template: LessonStarterTemplate,
  lessonTitle: string,
  createId: () => string,
): CoursivLessonScreen[] {
  const id = (prefix: string) => `${prefix}-${createId()}`;
  const screenBase = {
    id: id("screen"),
    sourcePageId: id("cms-page"),
    order: 0,
    type: "content",
    title: lessonTitle,
  };

  if (template === "image") {
    return [{
      ...screenBase,
      presentation: "media",
      interactionPolicy: "read",
      blocks: [
        { id: id("block"), type: "heading", text: lessonTitle, level: 1 },
        { id: id("block"), type: "image", src: "", alt: "" },
        { id: id("block"), type: "paragraph", text: "" },
      ],
    }];
  }

  if (template === "quiz") {
    const blockId = id("block");
    return [{
      ...screenBase,
      type: "knowledge-check",
      presentation: "knowledge-check",
      interactionPolicy: "required-interaction",
      blocks: [{
        id: blockId,
        type: "single-choice",
        question: "",
        options: [
          { id: id("option"), label: "Correct answer", isCorrect: true },
          { id: id("option"), label: "Another answer", isCorrect: false },
        ],
      }],
    }];
  }

  if (template === "practice") {
    return [{
      ...screenBase,
      type: "practice",
      presentation: "practice",
      interactionPolicy: "optional-practice",
      blocks: [{
        id: id("block"),
        type: "practice",
        title: lessonTitle,
        prompt: "",
      }],
    }];
  }

  return [{
    ...screenBase,
    presentation: "content",
    interactionPolicy: "read",
    blocks: [
      { id: id("block"), type: "heading", text: lessonTitle, level: 1 },
      { id: id("block"), type: "paragraph", text: "" },
    ],
  }];
}

export function nextLessonOrder(
  lessons: { sourceUnitId: string; order: number }[],
  sourceUnitId: string,
) {
  return Math.max(-1, ...lessons.filter((lesson) => lesson.sourceUnitId === sourceUnitId).map((lesson) => lesson.order)) + 1;
}
