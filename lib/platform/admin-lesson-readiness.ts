import type { CoursivContentBlock } from "../coursiv-content";
import { validateEditableLesson, type ValidatableLesson } from "./admin-content-validation";

const interactionTypes = new Set<CoursivContentBlock["type"]>([
  "single-choice",
  "multi-choice",
  "true-false",
  "fill-in-blank",
  "ordering-task",
  "matching-pairs",
  "prompt-fixer",
  "survey",
  "practice",
]);

export function lessonPreviewReadiness(lesson: ValidatableLesson) {
  const blocks = lesson.screens.flatMap((screen) => screen.blocks);
  const errors = validateEditableLesson(lesson);
  return {
    screens: lesson.screens.length,
    blocks: blocks.length,
    interactions: blocks.filter((block) => interactionTypes.has(block.type)).length,
    requiredInteractions: lesson.screens.filter((screen) => screen.interactionPolicy === "required-interaction").length,
    optionalPractices: lesson.screens.filter((screen) => screen.interactionPolicy === "optional-practice").length,
    images: blocks.filter((block) => block.type === "image").length,
    videos: blocks.filter((block) => block.type === "video").length,
    errors,
    ready: errors.length === 0,
  };
}

export function blockHasAnswerKey(block: CoursivContentBlock) {
  return [
    "single-choice",
    "multi-choice",
    "true-false",
    "fill-in-blank",
    "ordering-task",
    "matching-pairs",
    "prompt-fixer",
  ].includes(block.type);
}
