import type { CoursivLesson } from "../coursiv-content";
import { richTextPlainText } from "../rich-text";

export type ValidatableLesson = CoursivLesson & { id: string; courseId: string };

export function repairLegacyNestedIds<T extends ValidatableLesson>(lesson: T): T {
  const used = new Set<string>();
  const uniqueId = (blockId: string, value: string) => {
    if (!used.has(value)) {
      used.add(value);
      return value;
    }
    const base = `${blockId}:${value}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}:${suffix++}`;
    used.add(candidate);
    return candidate;
  };
  const screens = lesson.screens.map((screen) => ({
    ...screen,
    blocks: screen.blocks.map((block) => {
      if ("options" in block && Array.isArray(block.options)) {
        return {
          ...block,
          options: block.options.map((option) => ({
            ...option,
            id: uniqueId(block.id, option.id),
          })),
        } as typeof block;
      }
      if (block.type === "matching-pairs") {
        return {
          ...block,
          pairs: block.pairs.map((pair) => ({
            ...pair,
            id: uniqueId(block.id, pair.id),
          })),
        };
      }
      return block;
    }),
  }));
  return {
    ...lesson,
    screens,
    blocks: screens.flatMap((screen) => screen.blocks),
  };
}

export function validateEditableLesson(lesson: ValidatableLesson) {
  const errors: string[] = [];
  if (!lesson.id || !lesson.courseId || !lesson.slug || !lesson.title) errors.push("Lesson identity, course, slug and title are required.");
  if (!Array.isArray(lesson.screens) || !lesson.screens.length) errors.push("A lesson must contain at least one screen.");
  const screenIds = new Set<string>();
  const blockIds = new Set<string>();
  const nestedIds = new Set<string>();
  for (const screen of lesson.screens ?? []) {
    if (!screen.id || screenIds.has(screen.id)) errors.push(`Duplicate or missing screen ID: ${screen.id || "(empty)"}`);
    screenIds.add(screen.id);
    if (!Array.isArray(screen.blocks) || !screen.blocks.length) errors.push(`Screen ${screen.id} has no blocks.`);
    for (const block of screen.blocks ?? []) {
      if (!block.id || blockIds.has(block.id)) errors.push(`Duplicate or missing block ID: ${block.id || "(empty)"}`);
      blockIds.add(block.id);
      if (block.type === "unknown") errors.push(`Unknown block ${block.id} must be resolved before publishing.`);
      if (block.type === "heading" && !richTextPlainText(block.text)) errors.push(`Heading ${block.id} is empty.`);
      if (block.type === "paragraph" && !richTextPlainText(block.text)) errors.push(`Paragraph ${block.id} is empty.`);
      if (block.type === "list" && (!block.items.length || block.items.some((item) => !item.trim()))) errors.push(`List ${block.id} needs at least one complete item.`);
      if (block.type === "callout" && !richTextPlainText(block.text)) errors.push(`Callout ${block.id} is empty.`);
      if (block.type === "image" && !(block.localSrc || block.src).trim()) errors.push(`Image ${block.id} has no source.`);
      if (block.type === "video" && !block.src.trim()) errors.push(`Video ${block.id} has no source.`);
      if (block.type === "feedback" && !richTextPlainText(block.text)) errors.push(`Feedback ${block.id} is empty.`);
      if (["single-choice", "multi-choice", "true-false"].includes(block.type)) {
        const quiz = block as Extract<typeof block, { type: "single-choice" | "multi-choice" | "true-false" }>;
        if (!richTextPlainText(quiz.question)) errors.push(`Question ${block.id} is empty.`);
        if (quiz.options.length < 2) errors.push(`Question ${block.id} needs at least two options.`);
        if (quiz.options.some((option) => !option.label.trim() && !option.image)) errors.push(`Question ${block.id} has an empty option.`);
        if (!quiz.options.some((option) => option.isCorrect)) errors.push(`Question ${block.id} has no correct answer.`);
        if (quiz.type !== "multi-choice" && quiz.options.filter((option) => option.isCorrect).length !== 1) errors.push(`Question ${block.id} must have exactly one correct answer.`);
        if (quiz.type === "true-false" && quiz.options.length !== 2) errors.push(`True/false question ${block.id} must have exactly two options.`);
      }
      if (block.type === "fill-in-blank") {
        if (!block.prompt.trim() || !richTextPlainText(block.template)) errors.push(`Fill-in-blank ${block.id} needs a prompt and template.`);
        if (!block.placeholders.length || !block.tokens.length || !block.correctTokens.length) errors.push(`Fill-in-blank ${block.id} needs placeholders, tokens and correct tokens.`);
        if (block.placeholders.length !== block.correctTokens.length) errors.push(`Fill-in-blank ${block.id} needs one correct answer for every blank.`);
        if (block.correctTokens.some((token) => !block.tokens.includes(token))) errors.push(`Fill-in-blank ${block.id} has a correct answer that is missing from its answer choices.`);
      }
      if (block.type === "ordering-task") {
        if (!block.title.trim() || block.items.length < 2 || block.correctItems.length !== block.items.length) errors.push(`Ordering task ${block.id} needs a title and a complete order.`);
        if (new Set(block.items).size !== block.items.length) errors.push(`Ordering task ${block.id} contains duplicate steps.`);
      }
      if (block.type === "matching-pairs") {
        if (!block.title.trim() || block.pairs.length < 2 || block.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) errors.push(`Matching task ${block.id} needs a title and at least two complete pairs.`);
      }
      if (block.type === "prompt-fixer") {
        if (!block.title.trim() || !block.template.trim() || block.options.length < 2) errors.push(`Prompt fixer ${block.id} needs a title, template and options.`);
        if (block.options.some((option) => !option.label.trim())) errors.push(`Prompt fixer ${block.id} has an empty option.`);
        if (block.options.filter((option) => option.isCorrect).length !== 1) errors.push(`Prompt fixer ${block.id} must have exactly one correct option.`);
      }
      if (block.type === "survey" && (!richTextPlainText(block.question) || block.options.length < 2 || block.options.some((option) => !option.label.trim()))) {
        errors.push(`Survey ${block.id} needs a question and at least two options.`);
      }
      if (block.type === "practice" && !block.title.trim()) {
        errors.push(`Practice ${block.id} needs a title.`);
      }
      const optionValues = "options" in block && Array.isArray(block.options) ? block.options : [];
      const pairValues = block.type === "matching-pairs" ? block.pairs : [];
      for (const nested of [...optionValues, ...pairValues]) {
        if (!nested.id || nestedIds.has(nested.id)) errors.push(`Duplicate or missing option/pair ID: ${nested.id || "(empty)"}`);
        nestedIds.add(nested.id);
      }
    }
  }
  return errors;
}
