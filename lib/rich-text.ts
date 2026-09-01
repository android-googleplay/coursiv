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
  "small",
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

type EmphasisRange = { start: number; end: number; priority: number };

const legalTextChunkPattern = /[^。！？；;\n]+[。！？；;\n]?/g;
const legalTextMetadataPattern = /^(?:基本法主頁|上一頁|下一頁|資料截至(?:[:：].*)?|https?:\/\/|註[:：]|第[一二三四五六](?:章|節)[^。！？；;]*)$/;
const legalTextEmbeddedMetadataPattern = /(?:[#*]\s*參閱|https?:\/\/|EASY\s*PASS|題解|由於附件條文隨時修訂或增刪)/iu;

const legalTextSemanticAnchorPatterns: Array<{ pattern: RegExp; priority: number }> = [
  { pattern: /在法律面前一律平等$/u, priority: 140 },
  { pattern: /(?:均)?不得/u, priority: 130 },
  { pattern: /不受/u, priority: 130 },
  { pattern: /不實行/u, priority: 130 },
  { pattern: /無管轄權/u, priority: 130 },
  { pattern: /不干預/u, priority: 130 },
  { pattern: /不予/u, priority: 130 },
  { pattern: /不屬於/u, priority: 130 },
  { pattern: /不符合/u, priority: 130 },
  { pattern: /不影響/u, priority: 130 },
  { pattern: /不低於/u, priority: 130 },
  { pattern: /不少於/u, priority: 130 },
  { pattern: /不超過/u, priority: 130 },
  { pattern: /不在/u, priority: 130 },
  { pattern: /不補/u, priority: 130 },
  { pattern: /無力/u, priority: 129 },
  { pattern: /不能/u, priority: 128 },
  { pattern: /毋須/u, priority: 127 },
  { pattern: /禁止/u, priority: 126 },
  { pattern: /必須/u, priority: 125 },
  { pattern: /只能/u, priority: 125 },
  { pattern: /應當/u, priority: 124 },
  { pattern: /應(?:由|以|依|予|向|在|按照|根據)/u, priority: 123 },
  { pattern: /(?<!無|毋)須/u, priority: 122 },
  { pattern: /(?<!所)需/u, priority: 122 },
  { pattern: /即屬/u, priority: 121 },
  { pattern: /享有(?!的)/u, priority: 120 },
  { pattern: /有權/u, priority: 120 },
  { pattern: /屬於/u, priority: 119 },
  { pattern: /直轄於/u, priority: 119 },
  { pattern: /負責(?!人|政府公務的人員)/u, priority: 118 },
  { pattern: /依法/u, priority: 116 },
  { pattern: /依照/u, priority: 115 },
  { pattern: /(?<!理)由[^，,:：]{2,}(?:組成|任命|擔任|選出|產生|規定|管理|負擔|主持|決定|批准|實施|發出|處理|支配|提出|委任|簽訂|行使|負責|代理|設立)/u, priority: 114 },
  { pattern: /全歸/u, priority: 114 },
  { pattern: /分別指/u, priority: 113 },
  { pattern: /參照適用/u, priority: 113 },
  { pattern: /”指/u, priority: 113 },
  { pattern: /以量入為出為原則/u, priority: 112 },
  { pattern: /保持/u, priority: 110 },
  { pattern: /維持/u, priority: 110 },
  { pattern: /保護/u, priority: 110 },
  { pattern: /保障/u, priority: 110 },
  { pattern: /適用(?!地區)/u, priority: 110 },
  { pattern: /生效(?!的)/u, priority: 110 },
  { pattern: /失效/u, priority: 110 },
  { pattern: /予以/u, priority: 110 },
  { pattern: /(?<!不|許)可(?:以)?/u, priority: 100 },
];

const legalTextActionAnchorPatterns: Array<{ pattern: RegExp; priority: number }> = [
  { pattern: /任命(?!的)/u, priority: 96 },
  { pattern: /設立(?!的)/u, priority: 96 },
  { pattern: /制定(?!的)/u, priority: 96 },
  { pattern: /修改(?!的|議案)/u, priority: 96 },
  { pattern: /廢除/u, priority: 96 },
  { pattern: /^(?:並)?宣誓/u, priority: 96 },
  { pattern: /批准/u, priority: 96 },
  { pattern: /選舉產生/u, priority: 96 },
  { pattern: /繼續/u, priority: 94 },
  { pattern: /保留/u, priority: 94 },
  { pattern: /維持/u, priority: 94 },
  { pattern: /避免/u, priority: 94 },
  { pattern: /力求/u, priority: 94 },
  { pattern: /鼓勵/u, priority: 94 },
  { pattern: /^(?:並)?代表/u, priority: 92 },
  { pattern: /^(?:並)?參加/u, priority: 92 },
  { pattern: /^(?:並)?簽訂/u, priority: 92 },
  { pattern: /^(?:並)?履行/u, priority: 92 },
  { pattern: /提供/u, priority: 92 },
  { pattern: /^(?:並)?施行/u, priority: 92 },
  { pattern: /^(?:並)?實施/u, priority: 92 },
  { pattern: /^(?:並)?執行(?!機制)/u, priority: 92 },
  { pattern: /最終達至/u, priority: 92 },
];

const feedbackEmphasisPatterns: Array<{ pattern: RegExp; priority: number }> = [
  { pattern: /答案(?:係|是|為)\s*[A-D](?![A-Z])/gi, priority: 1 },
  { pattern: /(?:correct\s+answer|answer)\s*(?:is|:)\s*[A-D](?![A-Z])/gi, priority: 1 },
  { pattern: /《[^》]{1,40}》(?:第\s*[0-9一二三四五六七八九十百零〇兩]+\s*條|附件[一二三四五六七八九十\d]*)?/g, priority: 2 },
  { pattern: /「[^「」]{1,40}」/g, priority: 3 },
  { pattern: /[^，。；：「」]{0,28}屬於[^，。；：「」]{1,24}所有/g, priority: 4 },
  { pattern: /由[^。；：「」]{1,80}?負責[^。；：「」]{0,80}?(?=，其|」。|。|$)/g, priority: 4 },
  { pattern: /其?收入全歸[^，。；：「」]{1,35}支配/g, priority: 4 },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimRange(value: string, start: number, end: number) {
  while (start < end && /[\s•#*]/u.test(value[start])) start += 1;
  while (end > start && /[\s。！？；;，,:：]/.test(value[end - 1])) end -= 1;
  return { start, end };
}

function legalTextEmphasisRanges(chunk: string, offset: number): EmphasisRange[] {
  const trimmed = trimRange(chunk, 0, chunk.length);
  let body = chunk.slice(trimmed.start, trimmed.end);
  const embeddedMetadataIndex = body.search(legalTextEmbeddedMetadataPattern);
  if (embeddedMetadataIndex === 0) return [];
  if (embeddedMetadataIndex > 0) body = body.slice(0, embeddedMetadataIndex).trimEnd();
  if (body.length < 3 || legalTextMetadataPattern.test(body)) return [];

  const candidates: EmphasisRange[] = [];
  for (const pattern of [
    /(?:必須|須)?由[^。！？；;]{3,}擔任$/u,
    /享有[^。！？；;]{3,}(?:權利和自由|權力|權利)$/u,
    /(?<!所|沒)有(?!效|關)[^。！？；;]{3,}(?:權利和自由|權利|自由)$/u,
    /保障[^。；]{3,}依法享有的[^。；]{2,}(?:權利和自由|權利|自由)$/u,
    /依法保護[^。；]{3,}規定享有的[^。；]{2,}(?:權利和自由|權利|自由)$/u,
    /除[^。！？；;]{2,}外，[^。！？；;]{2,}$/u,
    /除非[^。！？；;]{2,}，[^。！？；;]{2,}$/u,
    /為外國[^。；]{3,}(?:國家秘密或者情報的)$/u,
    /“吊銷執照或者營業許可證”指[^。；]+$/u,
  ]) {
    const match = body.match(pattern);
    if (match?.index !== undefined) {
      candidates.push({
        start: offset + trimmed.start + match.index,
        end: offset + trimmed.start + match.index + match[0].length,
        priority: 138,
      });
    }
  }
  for (const clauseMatch of body.matchAll(/[^，,:：]+/gu)) {
    if (clauseMatch.index === undefined) continue;
    const clauseTrimmed = trimRange(clauseMatch[0], 0, clauseMatch[0].length);
    const clause = clauseMatch[0].slice(clauseTrimmed.start, clauseTrimmed.end);
    if (clause.length < 3 || legalTextEmbeddedMetadataPattern.test(clause)) continue;
    const clauseOffset = offset + trimmed.start + clauseMatch.index + clauseTrimmed.start;

    const quotedEnding = /(?:分別指|參照適用|[”」"]指)/u.test(clause)
      ? null
      : clause.match(/[“「"][^”」"]{1,40}[”」"]$/u);
    if (quotedEnding?.index !== undefined) {
      candidates.push({
        start: clauseOffset + quotedEnding.index,
        end: clauseOffset + quotedEnding.index + quotedEnding[0].length,
        priority: 112,
      });
    }

    const status = clause.match(/(?:是|(?<!以|入|其)為(?!在))([^是為]{2,})$/u);
    if (
      status?.index !== undefined
      && status.index > 0
      && status.index <= 22
      && !clause.startsWith("除")
      && !clause.includes("量入為出")
      && !/以[^，]{0,20}$/u.test(clause.slice(0, status.index))
    ) {
      candidates.push({ start: clauseOffset, end: clauseOffset + clause.length, priority: 117 });
    }

    if (/^.+受法律保護$/u.test(clause)) {
      candidates.push({ start: clauseOffset, end: clauseOffset + clause.length, priority: 120 });
    }
    if (/^.+維持不變$/u.test(clause)) {
      candidates.push({ start: clauseOffset, end: clauseOffset + clause.length, priority: 120 });
    }

    let best: EmphasisRange | null = null;
    for (const { pattern, priority } of legalTextSemanticAnchorPatterns) {
      const match = clause.match(pattern);
      if (match?.index === undefined) continue;
      const conditionStart = clause.search(/(?:除|如)/u);
      let start = conditionStart >= 0 && conditionStart < match.index && (clause.endsWith("外") || clause.startsWith("如")) ? conditionStart : match.index;
      if (clause.length - start < 3) {
        if (match[0] === "可") continue;
        start = 0;
      }
      const candidate = { start: clauseOffset + start, end: clauseOffset + clause.length, priority };
      if (!best || candidate.start < best.start || (candidate.start === best.start && candidate.priority > best.priority)) best = candidate;
    }

    if (!best) {
      for (const { pattern, priority } of legalTextActionAnchorPatterns) {
        const match = clause.match(pattern);
        if (match?.index === undefined) continue;
        const conditionStart = clause.search(/(?:除|如)/u);
        let start = conditionStart >= 0 && conditionStart < match.index && (clause.endsWith("外") || clause.startsWith("如")) ? conditionStart : match.index;
        if (clause.length - start < 3) start = 0;
        const candidate = { start: clauseOffset + start, end: clauseOffset + clause.length, priority };
        if (!best || candidate.start < best.start || (candidate.start === best.start && candidate.priority > best.priority)) best = candidate;
      }
    }
    if (best) candidates.push(best);
  }

  if (!candidates.length) {
    const clauses = [...body.matchAll(/[^，,:：]+/gu)];
    const fallback = clauses.at(-1);
    if (!fallback || fallback.index === undefined) return [];
    const fallbackTrimmed = trimRange(fallback[0], 0, fallback[0].length);
    if (fallbackTrimmed.end - fallbackTrimmed.start < 3) return [];
    return [{
      start: offset + trimmed.start + fallback.index + fallbackTrimmed.start,
      end: offset + trimmed.start + fallback.index + fallbackTrimmed.end,
      priority: 80,
    }];
  }

  const selected: EmphasisRange[] = [];
  for (const range of candidates.sort((a, b) => b.priority - a.priority || a.start - b.start || b.end - a.end)) {
    if (!selected.some((item) => range.start < item.end && range.end > item.start)) selected.push(range);
  }
  return selected.sort((a, b) => a.start - b.start);
}

function escapePlainText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
}

/** Emphasizes complete legal predicates and conditions without slicing through phrases. */
export function richTextLegalReferenceHtml(value: string) {
  const plain = richTextPlainText(value);
  const ranges: EmphasisRange[] = [];
  for (const match of plain.matchAll(legalTextChunkPattern)) {
    if (match.index === undefined) continue;
    ranges.push(...legalTextEmphasisRanges(match[0], match.index));
  }
  if (!ranges.length) return escapePlainText(plain);

  let cursor = 0;
  return ranges.map((range) => {
    const before = escapePlainText(plain.slice(cursor, range.start));
    const emphasized = `<strong>${escapePlainText(plain.slice(range.start, range.end))}</strong>`;
    cursor = range.end;
    return `${before}${emphasized}`;
  }).join("") + escapePlainText(plain.slice(cursor));
}

function emphasizedText(value: string, highlights: string[]) {
  const ranges: EmphasisRange[] = [];
  const escapedHighlights = highlights
    .map((highlight) => sanitizeHtml(highlight.trim(), { allowedTags: [], allowedAttributes: {} }))
    .filter((highlight) => highlight.length >= 2)
    .sort((a, b) => b.length - a.length);

  for (const highlight of escapedHighlights) {
    const pattern = new RegExp(escapeRegExp(highlight), "gi");
    for (const match of value.matchAll(pattern)) {
      if (match.index !== undefined) ranges.push({ start: match.index, end: match.index + match[0].length, priority: 0 });
    }
  }
  for (const { pattern, priority } of feedbackEmphasisPatterns) {
    for (const match of value.matchAll(pattern)) {
      if (match.index !== undefined) ranges.push({ start: match.index, end: match.index + match[0].length, priority });
    }
  }

  const selected: EmphasisRange[] = [];
  for (const range of ranges.sort((a, b) => a.priority - b.priority || a.start - b.start || b.end - a.end)) {
    if (!selected.some((item) => range.start < item.end && range.end > item.start)) selected.push(range);
  }
  if (!selected.length) return value;

  let cursor = 0;
  return selected
    .sort((a, b) => a.start - b.start)
    .map((range) => {
      const before = value.slice(cursor, range.start);
      const emphasized = `<strong>${value.slice(range.start, range.end)}</strong>`;
      cursor = range.end;
      return `${before}${emphasized}`;
    })
    .join("") + value.slice(cursor);
}

export function richTextFeedbackHtml(value: string, highlights: string[] = []) {
  const safe = richTextEditorHtml(value);
  let strongDepth = 0;
  return safe.split(/(<[^>]+>)/g).map((token) => {
    if (token.startsWith("<")) {
      if (/^<strong(?:\s|>)/i.test(token)) strongDepth += 1;
      if (/^<\/strong>/i.test(token)) strongDepth = Math.max(0, strongDepth - 1);
      return token;
    }
    return strongDepth ? token : emphasizedText(token, highlights);
  }).join("");
}

export function richTextInlineHtml(value: string) {
  const safe = sanitizeRichText(value);
  return sanitizeHtml(safe, {
    allowedTags: ["strong", "em", "u", "br", "small", "a"],
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
      options: block.options.map((option) => ({
        ...option,
        label: sanitizeRichText(option.label),
      })),
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
