import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { richTextLegalReferenceHtml, richTextPlainText } from "../lib/rich-text.ts";

const root = process.cwd();
const buildScriptPath = `${root}/scripts/build-basic-law-course.mjs`;
const referencesPath = `${root}/content/basic-law/legal-references.json`;
const outputPath = `${root}/course-laws-original-text-and-bolded.md`;

const [buildSource, referencesSource] = await Promise.all([
  readFile(buildScriptPath, "utf8"),
  readFile(referencesPath, "utf8"),
]);

function readExpression(startMarker, endMarker) {
  const start = buildSource.indexOf(startMarker);
  const end = buildSource.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate source expression between ${startMarker} and ${endMarker}`);
  }
  const expression = buildSource.slice(start + startMarker.length, end);
  return vm.runInNewContext(`(${expression})`);
}

const lessonDefs = readExpression(
  "const lessonDefs = ",
  ";\n\nconst spotErrorBySlug",
);
const lessonIntroBySlug = readExpression(
  "const lessonIntroBySlug = ",
  ";\n\nconst plainMeaningByKey",
);
const { verifiedAt, references } = JSON.parse(referencesSource);

const referencesByDomainAndArticle = new Map(
  references
    .filter((reference) => Number.isInteger(reference.article))
    .map((reference) => [`${reference.domain}:${reference.article}`, reference]),
);
const referencesById = new Map(references.map((reference) => [reference.id, reference]));

function boldPhrases(slug) {
  return (lessonIntroBySlug[slug] ?? []).flatMap((paragraph) =>
    [...paragraph.matchAll(/<b>(.*?)<\/b>/g)]
      .map((match) => match[1].trim())
      .filter(Boolean),
  );
}

function quote(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function legalFocusPhrases(value) {
  return [...richTextLegalReferenceHtml(value).matchAll(/<strong>([\s\S]*?)<\/strong>/g)]
    .map((match) => richTextPlainText(match[1]).trim())
    .filter(Boolean);
}

function renderReference(reference, { supplemental = false } = {}) {
  const lines = [`### ${reference.citationZh}`];
  if (supplemental) {
    lines.push("", "> **注意：** 以下係課程法源資料所保存嘅摘要／摘錄，唔係完整附件或相關文件全文。");
  }
  lines.push(
    "",
    "**中文法源文字**",
    "",
    quote(reference.textZh),
    "",
    "**課堂法律卡粗體重點**",
    "",
    ...legalFocusPhrases(reference.textZh).map((phrase) => `- **${phrase}**`),
    "",
    "**English legal text stored in the course**",
    "",
    quote(reference.textEn),
    "",
    `來源：[官方頁面](${reference.sourceUrl})`,
  );
  return lines.join("\n");
}

const legalLessons = lessonDefs.filter((lesson) => lesson.slug !== "exam-map");
const strategyLesson = lessonDefs.find((lesson) => lesson.slug === "exam-map");
const sections = [];

sections.push(
  "# 課程法例原文及課堂粗體重點",
  "",
  `> 法源資料核對日期：${verifiedAt}`,
  ">",
  "> 本文件由課程現有資料自動整理。第 1–160 條《基本法》及第 1–66 條《香港國安法》按 `legal-references.json` 逐條收錄；附件、序言及相關文件只會如實呈現課程資料內保存嘅文字。凡屬摘要／摘錄，均另行標示，避免誤當完整官方全文。",
  "",
  "## 覆蓋範圍",
  "",
  "- 《基本法》序言、第 1–160 條、附件一至三及相關文件",
  "- 《香港國安法》第 1–66 條及公布安排",
  "- 每課 lesson intro 內所有 `<b>…</b>` 粗體文字",
  "- 每條法律卡按完整法律命題、條件、權利或責任顯示嘅粗體重點",
);

if (strategyLesson) {
  sections.push(
    "",
    "## 考試玩法與高頻陷阱（非法律條文課）",
    "",
    "**課堂粗體文字**",
    "",
    ...boldPhrases(strategyLesson.slug).map((phrase) => `- **${phrase}**`),
  );
}

for (const lesson of legalLessons) {
  sections.push(
    "",
    `## ${lesson.order}. ${lesson.title}`,
    "",
    `**法律範圍：** ${lesson.scope}`,
    "",
    "**課堂粗體文字**",
    "",
    ...boldPhrases(lesson.slug).map((phrase) => `- **${phrase}**`),
    "",
    "**法律原文／課程法源文字**",
    "",
  );

  const lessonReferences = [];
  if (lesson.slug === "preamble-articles-1-5") {
    lessonReferences.push({ reference: referencesById.get("basic-law-preamble"), supplemental: true });
  }
  if (lesson.slug === "annexes") {
    for (const id of [
      "basic-law-annex-1",
      "basic-law-annex-2",
      "basic-law-annex-3",
      "basic-law-related-documents",
    ]) {
      lessonReferences.push({ reference: referencesById.get(id), supplemental: true });
    }
  } else {
    for (const article of lesson.articles) {
      lessonReferences.push({
        reference: referencesByDomainAndArticle.get(`${lesson.domain}:${article}`),
        supplemental: false,
      });
    }
  }
  if (lesson.slug === "nsl-articles-1-6") {
    lessonReferences.unshift({
      reference: referencesById.get("nsl-promulgation-2020"),
      supplemental: true,
    });
  }

  for (const item of lessonReferences) {
    if (!item.reference) {
      throw new Error(`Missing reference in lesson ${lesson.slug}`);
    }
    sections.push(renderReference(item.reference, item), "");
  }
}

await writeFile(outputPath, `${sections.join("\n").trim()}\n`, "utf8");
console.log(outputPath);
