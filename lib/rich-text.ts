import sanitizeHtml from "sanitize-html";
import type { CoursivContentBlock, CoursivLesson } from "@/lib/coursiv-content";

export const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "br",
  "a",
] as const;

const anyMarkupPattern = /<\/?[a-z][^>]*>/i;

export function sanitizeRichText(value: string) {
  if (!anyMarkupPattern.test(value)) return value.replaceAll("\u0000", "");
  return sanitizeHtml(value, {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: {
      b: "strong",
      i: "em",
      a: (_tag, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          target: "_blank",
          rel: "noreferrer noopener",
        },
      }),
    },
  });
}

export function richTextEditorHtml(value: string) {
  const safe = sanitizeRichText(value);
  if (!safe) return "";
  if (anyMarkupPattern.test(safe)) return safe.replaceAll("\n", "<br>");
  const escaped = sanitizeHtml(safe, { allowedTags: [], allowedAttributes: {} });
  return escaped
    .split(/\n\n+/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function richTextInlineHtml(value: string) {
  const safe = sanitizeRichText(value);
  return sanitizeHtml(safe, {
    allowedTags: ["strong", "em", "u", "br", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  }).replaceAll("\n", "<br>");
}

export function richTextPlainText(value: string) {
  const separated = sanitizeRichText(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|li|ul|ol)>/gi, "$& ");
  return sanitizeHtml(separated, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeBlockRichText(block: CoursivContentBlock): CoursivContentBlock {
  if (block.type === "heading") {
    return { ...block, text: richTextInlineHtml(block.text) };
  }
  if (block.type === "paragraph" || block.type === "callout" || block.type === "feedback") {
    return { ...block, text: sanitizeRichText(block.text) };
  }
  if (block.type === "single-choice" || block.type === "multi-choice" || block.type === "true-false") {
    return {
      ...block,
      question: sanitizeRichText(block.question),
      feedbackCorrect: block.feedbackCorrect
        ? { ...block.feedbackCorrect, text: sanitizeRichText(block.feedbackCorrect.text) }
        : undefined,
      feedbackIncorrect: block.feedbackIncorrect
        ? { ...block.feedbackIncorrect, text: sanitizeRichText(block.feedbackIncorrect.text) }
        : undefined,
    };
  }
  if (block.type === "fill-in-blank") {
    return {
      ...block,
      template: sanitizeRichText(block.template),
      exampleResponse: block.exampleResponse ? sanitizeRichText(block.exampleResponse) : undefined,
      feedback: block.feedback
        ? { ...block.feedback, text: sanitizeRichText(block.feedback.text) }
        : undefined,
    };
  }
  if (block.type === "ordering-task" || block.type === "prompt-fixer") {
    return {
      ...block,
      feedbackCorrect: block.feedbackCorrect
        ? { ...block.feedbackCorrect, text: sanitizeRichText(block.feedbackCorrect.text) }
        : undefined,
      feedbackIncorrect: block.feedbackIncorrect
        ? { ...block.feedbackIncorrect, text: sanitizeRichText(block.feedbackIncorrect.text) }
        : undefined,
    };
  }
  if (block.type === "survey") {
    return { ...block, question: sanitizeRichText(block.question) };
  }
  return block;
}

export function sanitizeLessonRichText<T extends CoursivLesson>(lesson: T): T {
  const screens = lesson.screens.map((screen) => ({
    ...screen,
    blocks: screen.blocks.map(sanitizeBlockRichText),
  }));
  return {
    ...lesson,
    screens,
    blocks: screens.flatMap((screen) => screen.blocks),
  };
}
