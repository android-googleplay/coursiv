export const COURSIV_SCHEMA_VERSION = 3 as const;

export type CoursivInteractionPolicy = "read" | "required-interaction" | "optional-practice";
export type CoursivScreenPresentation = "content" | "media" | "callout" | "knowledge-check" | "practice";

export type CoursivQuizOption = {
  id: string;
  label: string;
  isCorrect: boolean;
  image?: string;
};

export type CoursivFeedback = { title?: string; text: string; image?: string };

export type CoursivContentBlock =
  | { id: string; type: "heading"; text: string; level: number }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "list"; items: string[]; ordered: boolean }
  | { id: string; type: "callout"; title?: string; text: string; tone?: string }
  | { id: string; type: "image"; src: string; localSrc?: string; alt: string }
  | { id: string; type: "video"; src: string; poster?: string }
  | { id: string; type: "single-choice" | "multi-choice" | "true-false"; question: string; instruction?: string; options: CoursivQuizOption[]; hint?: string; feedbackCorrect?: CoursivFeedback; feedbackIncorrect?: CoursivFeedback }
  | { id: string; type: "fill-in-blank"; prompt: string; template: string; placeholders: string[]; tokens: string[]; correctTokens: string[]; exampleResponse?: string; feedback?: CoursivFeedback }
  | { id: string; type: "ordering-task"; title: string; prompt?: string; items: string[]; correctItems: string[]; hint?: string; feedbackCorrect?: CoursivFeedback; feedbackIncorrect?: CoursivFeedback }
  | { id: string; type: "matching-pairs"; title: string; prompt?: string; pairs: { id: string; left: string; right: string }[] }
  | { id: string; type: "prompt-fixer"; title: string; prompt?: string; template: string; options: { id: string; label: string; isCorrect: boolean; outputText?: string; outputImage?: string; outputLocalImage?: string }[]; hint?: string; feedbackCorrect?: CoursivFeedback; feedbackIncorrect?: CoursivFeedback }
  | { id: string; type: "survey"; question: string; options: { id: string; label: string }[] }
  | { id: string; type: "practice"; title: string; prompt?: string; practiceId?: string; practiceType?: string; rawContent?: unknown }
  | { id: string; type: "feedback"; title?: string; text: string; correct?: boolean }
  | { id: string; type: "legal-reference"; title: string; items: { citationZh: string; citationEn: string; textZh: string; textEn: string; sourceUrl: string; verifiedAt: string }[] }
  | { id: string; type: "unknown"; sourceType: string; text?: string; raw: unknown };

export type CoursivLessonScreen = {
  id: string;
  sourcePageId: string;
  order: number;
  type: string;
  title?: string;
  presentation: CoursivScreenPresentation;
  interactionPolicy: CoursivInteractionPolicy;
  practiceTool?: { name: string; icon?: string; reference?: string };
  audioSource?: string;
  blocks: CoursivContentBlock[];
};

export type CoursivLesson = {
  schemaVersion: 1 | 2 | typeof COURSIV_SCHEMA_VERSION;
  sourceId: string;
  sourceUnitId: string;
  sourceGuideId: string;
  slug: string;
  title: string;
  order: number;
  readUrl: string;
  hasAudio: boolean;
  experience?: "lesson" | "practice" | "mock";
  optional?: boolean;
  audioSource?: string;
  screens: CoursivLessonScreen[];
  /** Schema v1 compatibility. New code must use screens. */
  blocks: CoursivContentBlock[];
  raw: unknown;
};

export type CoursivUnit = { sourceId: string; title?: string; order: number; lessons: CoursivLesson[] };
export type CoursivCourse = {
  schemaVersion: 1 | 2 | typeof COURSIV_SCHEMA_VERSION;
  id: string;
  sourceId: string;
  kind: "tool" | "use-case";
  title: string;
  image?: string;
  localImage?: string;
  duration: string;
  categories: string[];
  sourceUpdatedAt?: string;
  units: CoursivUnit[];
};

export type CoursivCatalogEntry = {
  id: string;
  sourceId: string;
  kind: "tool" | "use-case";
  title: string;
  image?: string;
  duration: string;
  categories: string[];
  sourceUpdatedAt?: string;
  sections: { title?: string; sourceId: string; lessons: { id: string; sourceId: string; title: string; screenIds: string[]; hasAudio: boolean; optional?: boolean }[] }[];
};

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
const firstString = (...values: unknown[]) => values.map(string).find(Boolean) ?? "";
const idFor = (value: unknown, fallback: string) => firstString(record(value).id, record(value).uuid, fallback);

export function slugifyCoursiv(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lesson";
}

function objectText(value: unknown, depth = 0): string {
  if (depth > 5 || value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map((item) => objectText(item, depth + 1)).filter(Boolean).join(" ");
  const source = record(value);
  const direct = firstString(source.text, source.body, source.title, source.label, source.value, source.name, source.description);
  if (direct) return direct;
  return objectText(source.content, depth + 1);
}

function feedback(value: unknown): CoursivFeedback | undefined {
  const source = record(value);
  const text = objectText(source.text ?? source.body ?? source.content ?? value);
  if (!text) return undefined;
  return { title: firstString(source.title) || undefined, text, image: firstString(source.image, source.image_url) || undefined };
}

function quizOptions(value: unknown): CoursivQuizOption[] {
  return array(value).map((item, index) => {
    const source = record(item);
    return {
      id: idFor(item, `option-${index + 1}`),
      label: objectText(source.text ?? source.label ?? source.content ?? source.value),
      isCorrect: source.is_correct === true || source.isCorrect === true || source.correct === true,
      image: firstString(source.image, source.image_url) || undefined,
    };
  }).filter((item) => item.label || item.image);
}

function normalizeQuiz(source: JsonRecord, chunkId: string, type: "single-choice" | "multi-choice" | "true-false", index = 0): CoursivContentBlock {
  const question = record(source.question);
  const options = quizOptions(source.options ?? source.answers ?? source.choices);
  return {
    id: idFor(source, `${chunkId}-quiz-${index + 1}`),
    type,
    question: objectText(question.text ?? question.content ?? source.question ?? source.prompt),
    instruction: firstString(source.instruction, source.subtitle) || (type === "multi-choice" ? "Select all possible answers" : undefined),
    options,
    hint: objectText(source.hint) || undefined,
    feedbackCorrect: feedback(source.feedback_correct ?? source.feedbackCorrect),
    feedbackIncorrect: feedback(source.feedback_incorrect ?? source.feedbackIncorrect),
  };
}

function normalizeFill(source: JsonRecord, chunkId: string, index = 0): CoursivContentBlock {
  const answers = array(source.answers ?? source.options ?? source.tokens ?? source.gaps);
  const tokens = answers.map(objectText).filter(Boolean);
  const correctTokens = answers.filter((item) => {
    const answer = record(item);
    return answer.is_correct === true || answer.correct === true || answer.isCorrect === true;
  }).map(objectText).filter(Boolean);
  const template = objectText(source.template ?? source.sentence ?? source.text ?? source.content);
  return {
    id: idFor(source, `${chunkId}-fill-${index + 1}`),
    type: "fill-in-blank",
    prompt: objectText(source.prompt ?? source.question ?? source.title),
    template,
    placeholders: [...template.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim()).filter(Boolean),
    tokens,
    correctTokens: correctTokens.length ? correctTokens : array(source.correct_answers ?? source.correctTokens ?? source.gaps).map(objectText).filter(Boolean),
    exampleResponse: objectText(source.example_response ?? source.exampleResponse ?? source.response) || undefined,
    feedback: feedback(source.feedback_correct ?? source.feedback),
  };
}

function mediaBlock(source: JsonRecord, chunkId: string, type: "image" | "video"): CoursivContentBlock | null {
  const src = firstString(source.url, source.src, source.file_url, source.image_url, source.video_url, source.value, source.content);
  if (!src) return null;
  return type === "image"
    ? { id: idFor(source, `${chunkId}-image`), type, src, localSrc: firstString(source.localSrc, source.local_src) || undefined, alt: firstString(source.alt, source.title, source.caption) }
    : { id: idFor(source, `${chunkId}-video`), type, src, poster: firstString(source.poster, source.thumbnail) || undefined };
}

function normalizeContentItem(item: unknown, chunkId: string, index: number): CoursivContentBlock[] {
  if (typeof item === "string") return item.trim() ? [{ id: `${chunkId}-paragraph-${index + 1}`, type: "paragraph", text: item.trim() }] : [];
  const source = record(item);
  const rawType = firstString(source.type, source.kind, source.component_type).toLowerCase().replaceAll("_", "-");
  if (["single-choice", "singlechoice", "radio", "quiz"].includes(rawType)) return [normalizeQuiz(source, chunkId, "single-choice", index)];
  if (["multi-choice", "multiple-choice", "multichoice", "checkbox"].includes(rawType)) return [normalizeQuiz(source, chunkId, "multi-choice", index)];
  if (rawType === "true-false") return [normalizeQuiz(source, chunkId, "true-false", index)];
  if (["fill-in-the-blank", "fill-in-blank", "fill-blank", "prompt-builder"].includes(rawType)) return [normalizeFill(source, chunkId, index)];
  if (rawType.includes("image")) { const block = mediaBlock(source, chunkId, "image"); return block ? [block] : []; }
  if (rawType.includes("video")) { const block = mediaBlock(source, chunkId, "video"); return block ? [block] : []; }
  if (["heading", "title", "h1", "h2", "h3", "h4"].includes(rawType)) {
    const text = objectText(source); return text ? [{ id: idFor(source, `${chunkId}-heading-${index + 1}`), type: "heading", text, level: Number(rawType.slice(1)) || Number(source.level) || 2 }] : [];
  }
  if (["paragraph", "text", "rich-text", "markdown"].includes(rawType)) {
    const text = objectText(source); return text ? [{ id: idFor(source, `${chunkId}-paragraph-${index + 1}`), type: "paragraph", text }] : [];
  }
  if (["list", "ordered-list", "unordered-list"].includes(rawType)) {
    const items = array(source.items ?? source.content).map(objectText).filter(Boolean);
    return items.length ? [{ id: idFor(source, `${chunkId}-list-${index + 1}`), type: "list", items, ordered: rawType === "ordered-list" || source.ordered === true }] : [];
  }
  if (rawType.includes("callout") || rawType === "tip" || rawType === "warning") {
    return [{ id: idFor(source, `${chunkId}-callout-${index + 1}`), type: "callout", title: firstString(source.title) || undefined, text: objectText(source.text ?? source.body ?? source.content), tone: rawType }];
  }
  const text = objectText(source);
  if (!rawType && text) return [{ id: idFor(source, `${chunkId}-paragraph-${index + 1}`), type: "paragraph", text }];
  return [{ id: idFor(source, `${chunkId}-unknown-${index + 1}`), type: "unknown", sourceType: rawType || "untyped", text: text || undefined, raw: item }];
}

export function normalizeCoursivBlocks(rawContent: unknown): CoursivContentBlock[] {
  const blocks: CoursivContentBlock[] = [];
  for (const [index, rawChunk] of array(rawContent).entries()) {
    const chunk = record(rawChunk);
    const chunkId = idFor(chunk, `chunk-${index + 1}`);
    const rawType = firstString(chunk.type, chunk.kind).toLowerCase().replaceAll("_", "-");
    const content = array(chunk.content);
    if (rawType === "page" || rawType === "screen" || rawType === "section") {
      blocks.push(...normalizeCoursivBlocks(content));
      continue;
    }
    if (rawType === "single-choice" || rawType === "multi-choice" || rawType === "true-false") {
      const type = rawType as "single-choice" | "multi-choice" | "true-false";
      blocks.push(...(content.length ? content : [chunk]).map((item, itemIndex) => normalizeQuiz(record(item), chunkId, type, itemIndex)));
      continue;
    }
    if (rawType === "practice-preview" || rawType === "practice") {
      for (const [practiceIndex, practiceValue] of (content.length ? content : [chunk]).entries()) {
        const practice = record(practiceValue);
        const practiceType = firstString(practice.type, practice.practice_type).toLowerCase();
        const practiceEnvelope = record(practice.practice_payload);
        const practicePayload = record(practiceEnvelope.data ?? practiceEnvelope.result ?? practice.practice_payload);
        const payloadItem = record(array(practicePayload.items)[0]);
        const combined = Object.keys(practicePayload).length ? { ...practice, ...practicePayload, ...payloadItem } : practice;
        const title = firstString(practice.title, chunk.title, "Practice");
        const prompt = objectText(practice.prompt ?? chunk.prompt ?? practice.question) || undefined;
        if (practiceType.includes("fill")) blocks.push(normalizeFill(combined, chunkId, practiceIndex));
        else if (practiceType === "true_false") {
          const quiz = normalizeQuiz(combined, chunkId, "true-false", practiceIndex) as Extract<CoursivContentBlock,{type:"single-choice"|"multi-choice"|"true-false"}>;
          blocks.push({ ...quiz, type: "true-false", instruction: prompt });
        }
        else if (practiceType === "ordering_task") {
          const items = array(combined.sequences).map(objectText).filter(Boolean);
          blocks.push({ id:idFor(combined,`${chunkId}-ordering-${practiceIndex+1}`),type:"ordering-task",title,prompt,items,correctItems:items,hint:objectText(combined.hint)||undefined,feedbackCorrect:feedback(combined.feedback_correct),feedbackIncorrect:feedback(combined.feedback_incorrect) });
        } else if (practiceType === "matching_pairs") {
          const left = array(combined.left_pairs).map(record).sort((a,b)=>Number(a.ordering)-Number(b.ordering));
          const right = array(combined.right_pairs).map(record).sort((a,b)=>Number(a.ordering)-Number(b.ordering));
          blocks.push({ id:idFor(combined,`${chunkId}-matching-${practiceIndex+1}`),type:"matching-pairs",title,prompt,pairs:left.map((item,pairIndex)=>({id:`${idFor(item,`left-${pairIndex+1}`)}:${idFor(right[pairIndex],`right-${pairIndex+1}`)}`,left:objectText(item.content),right:objectText(right[pairIndex]?.content)})).filter((pair)=>pair.left&&pair.right) });
        } else if (practiceType === "prompt_fixer") {
          blocks.push({ id:idFor(combined,`${chunkId}-prompt-fixer-${practiceIndex+1}`),type:"prompt-fixer",title,prompt,template:objectText(combined.template),options:array(combined.gaps).map((value,optionIndex)=>{const option=record(value);const output=record(option.output);return{id:idFor(option,`option-${optionIndex+1}`),label:objectText(option.input),isCorrect:option.is_correct===true,outputText:objectText(output.text)||undefined,outputImage:firstString(output.image)||undefined}}).filter((option)=>option.label),hint:objectText(combined.hint)||undefined,feedbackCorrect:feedback(combined.feedback_correct),feedbackIncorrect:feedback(combined.feedback_incorrect) });
        } else blocks.push({ id: idFor(practice, `${chunkId}-practice-${practiceIndex + 1}`), type: "practice", title, prompt, practiceId: firstString(practice.practice_id, practice.id) || undefined, practiceType: practiceType || undefined, rawContent: combined });
      }
      continue;
    }
    if (rawType === "callout") {
      if (content.length) blocks.push(...content.map((item,itemIndex)=>{const callout=record(item);return { id:idFor(callout,`${chunkId}-callout-${itemIndex+1}`),type:"callout" as const,title:firstString(callout.title)||undefined,text:objectText(callout.text??callout.body??callout.content),tone:firstString(callout.tone,chunk.tone,chunk.variant)||undefined }}));
      else blocks.push({ id: chunkId, type: "callout", title: firstString(chunk.title) || undefined, text: objectText(chunk.text), tone: firstString(chunk.tone, chunk.variant) || undefined });
      continue;
    }
    if (rawType === "survey-multichoice") {
      blocks.push(...content.map((item,itemIndex)=>{const survey=record(item);return {id:idFor(survey,`${chunkId}-survey-${itemIndex+1}`),type:"survey" as const,question:objectText(record(survey.question).text??survey.question),options:quizOptions(survey.options).map(({id,label})=>({id,label}))}}));
      continue;
    }
    if (rawType === "ai-data-collector") {
      blocks.push({id:chunkId,type:"practice",title:firstString(chunk.title,"Guided practice"),prompt:objectText(chunk.prompt??chunk.content)||undefined,practiceType:"ai_data_collector",rawContent:chunk});
      continue;
    }
    if (content.length) blocks.push(...content.flatMap((item, itemIndex) => normalizeContentItem(item, chunkId, itemIndex)));
    else blocks.push(...normalizeContentItem(chunk, chunkId, index));
  }
  const seen = new Set<string>();
  return blocks.map((block, index) => {
    let id = block.id || `block-${index + 1}`;
    while (seen.has(id)) id = `${block.id}-${index + 1}`;
    seen.add(id);
    return { ...block, id };
  });
}

export function normalizeCoursivScreens(rawContent: unknown): CoursivLessonScreen[] {
  const screens: CoursivLessonScreen[] = [];
  const pages = array(rawContent);
  for (const [pageIndex, rawPage] of pages.entries()) {
    const page = record(rawPage);
    const pageId = idFor(page, `page-${pageIndex + 1}`);
    const chunks = array(page.content);
    const sourceChunks = chunks.length ? chunks : [rawPage];
    for (const [chunkIndex, rawChunk] of sourceChunks.entries()) {
      const chunk = record(rawChunk);
      const id = idFor(chunk, `${pageId}-screen-${chunkIndex + 1}`);
      const blocks = normalizeCoursivBlocks([rawChunk]);
      if (!blocks.length) blocks.push({ id:`${id}-unknown`,type:"unknown",sourceType:firstString(chunk.type,"empty"),raw:rawChunk });
      const type = firstString(chunk.type, "chunk").toLowerCase().replaceAll("_", "-");
      const practice = record(array(chunk.content)[0]);
      const practiceEnvelope = record(practice.practice_payload);
      const practicePayload = record(practiceEnvelope.data ?? practiceEnvelope.result ?? practice.practice_payload);
      const practiceItem = record(array(practicePayload.items)[0]);
      const tool = record(record(practiceItem.metadata).tool);
      const hasInteraction = blocks.some((block)=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type));
      const presentation: CoursivScreenPresentation = type === "practice-preview" ? "practice" : ["single-choice","multi-choice","true-false","survey-multichoice"].includes(type) ? "knowledge-check" : type === "callout" ? "callout" : blocks.some((block)=>block.type === "video") ? "media" : "content";
      screens.push({
        id,
        sourcePageId: pageId,
        order: screens.length,
        type,
        title: firstString(chunk.title, record(array(chunk.content)[0]).title) || undefined,
        presentation,
        interactionPolicy: type === "practice-preview" ? "optional-practice" : hasInteraction ? "required-interaction" : "read",
        practiceTool: firstString(tool.name) ? { name:firstString(tool.name),icon:firstString(tool.icon)||undefined,reference:firstString(tool.reference)||undefined } : undefined,
        audioSource: firstString(chunk.audio, record(chunk.audio).url, record(chunk.audio).src) || undefined,
        blocks,
      });
    }
  }
  const seen = new Set<string>();
  return screens.map((screen,index)=>{let id=screen.id;while(seen.has(id))id=`${screen.id}-${index+1}`;seen.add(id);return{...screen,id,order:index}});
}

export function normalizeCoursivLesson(rawValue: unknown, context: { guideId: string; unitId: string; order: number; title?: string; sourceId?: string; slug?: string }): CoursivLesson {
  const envelope = record(rawValue);
  const raw = record(envelope.data ?? rawValue);
  const sourceId = firstString(context.sourceId, raw.id);
  if (!sourceId) throw new Error("Coursiv lesson is missing an id");
  const title = firstString(context.title, raw.name, raw.title, raw.slug, sourceId);
  const audio = record(raw.audio ?? raw.audio_content);
  const screens = normalizeCoursivScreens(raw.content);
  return {
    schemaVersion: COURSIV_SCHEMA_VERSION,
    sourceId,
    sourceUnitId: context.unitId,
    sourceGuideId: context.guideId,
    slug: context.slug || slugifyCoursiv(title),
    title,
    order: context.order,
    readUrl: `https://app.coursiv.io/guides/${context.guideId}/${context.unitId}/${sourceId}?isAudio=false`,
    hasAudio: Boolean(raw.has_audio ?? raw.hasAudio ?? raw.audio),
    audioSource: firstString(audio.url, audio.src, raw.audio_url) || undefined,
    screens,
    blocks: screens.flatMap((screen)=>screen.blocks),
    raw: rawValue,
  };
}

export function lessonScreenIds(lesson: Pick<CoursivLesson, "screens" | "blocks">) {
  return lesson.screens?.map((screen) => screen.id) ?? lesson.blocks?.map((block) => block.id) ?? [];
}

export function requiredInteractionBlockIds(screen: CoursivLessonScreen) {
  return screen.blocks.filter((block)=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type)).map((block)=>block.id);
}

export function screenRequiresResolution(screen: CoursivLessonScreen) {
  return screen.interactionPolicy === "required-interaction";
}

export function screenAllowsSkip(screen: CoursivLessonScreen) {
  return screen.interactionPolicy === "optional-practice";
}

export function gradeCoursivScreenResponse(screen:CoursivLessonScreen,response:{blockId:string;values:string[]}) {
  const block=screen.blocks.find((item)=>item.id===response.blockId);if(!block)return false;
  const values=response.values.map(String);
  if(block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false")return values.slice().sort().join("|")===block.options.filter((option)=>option.isCorrect).map((option)=>option.id).sort().join("|");
  if(block.type==="fill-in-blank")return values.join("|")===block.correctTokens.join("|");
  if(block.type==="ordering-task")return values.join("|")===block.correctItems.join("|");
  if(block.type==="matching-pairs")return values.join("|")===block.pairs.map((pair)=>pair.right).join("|");
  if(block.type==="prompt-fixer")return values.length===1&&block.options.some((option)=>option.id===values[0]&&option.isCorrect);
  if(block.type==="survey")return values.length===1&&block.options.some((option)=>option.id===values[0]);
  if(block.type==="practice")return values.length===1&&values[0]==="submitted";
  return false;
}

export function collectUnknownBlocks(course: CoursivCourse) {
  return course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => (lesson.screens?.flatMap((screen)=>screen.blocks) ?? lesson.blocks ?? []).filter((block) => block.type === "unknown").map((block) => ({ courseId: course.id, lessonId: lesson.slug, blockId: block.id, sourceType: block.sourceType }))));
}
