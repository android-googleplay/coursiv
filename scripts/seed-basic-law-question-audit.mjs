import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const bankPath = join(root, "content/basic-law/question-bank.json");
const outputPath = join(root, "content/basic-law/question-audit.json");
const force = process.argv.includes("--force");

const BASIC_LAW_BASE = "https://www.basiclaw.gov.hk/tc/basiclaw";
const NSL_SOURCE = "https://www.elegislation.gov.hk/hk/A302!zh-Hant-HK.assist.pdf";

const corrections = {
  "bl-05-09": {
    article: 53,
    correctOptionId: "C",
    questionZh: "根據《基本法》第五十三條，行政長官缺位時，應在幾多個月內依照第四十五條產生新任行政長官？",
    questionEn: "Under Basic Law Article 53, within how many months must a new Chief Executive be selected in accordance with Article 45 when the office becomes vacant?",
  },
  "bl-03-08": { article: 15 },
  "bl-04-09": { article: 60 },
  "bl-06-09": { correctOptionId: "C" },
  "nsl-08-10": { correctOptionId: "D" },
};

const retired = new Map([
  ["bl-02-15", "題目採用已被修改的舊版《基本法》附件二分組點票安排，唔適合作為現行法例題目。"],
  ["bl-11-07", "題目將立法會的同意權寫成任免權，並有多於一個選項唔屬立法會職權，冇唯一正確答案。"],
]);

function clean(value) {
  let result = String(value ?? "")
    .replace(/\s*(?:(?:[\p{Script=Han}A-Z]{0,2}解\s*)?EASY|[A-Z]{1,3})\s+PAS\S*.*$/giu, "")
    .replace(/題解\s*EASY\s*PASS[！!]?/gi, "")
    .replace(/自解\s*EASY\s*PAS[！!]?/gi, "")
    .replace(/領解\s*EASY\s*PASS/gi, "")
    .replace(/基本法[測测]試/g, "")
    .replace(/\s+/g, " ")
    .trim();
  let previous;
  do {
    previous = result;
    result = result.replace(/([\p{Script=Han}）》」〉])\s+([\p{Script=Han}《「〈])/gu, "$1$2");
  } while (result !== previous);
  return result.replace(/\s+([，。？！：；、）》」〉])/g, "$1").replace(/([（《「〈])\s+/g, "$1");
}

const matchText = (value) => clean(value).replace(/[\s，。；：、（）()「」『』《》〈〉_—•·\-]/g, "");

function overlapScore(part, questionText) {
  const ignored = new Set(["根據","基本","本法","香港","特別","行政","區的","下列","哪一","以下","規定"]);
  const compactQuestion = matchText(questionText);
  const grams = new Set();
  for (let index = 0; index < compactQuestion.length - 1; index++) {
    const gram = compactQuestion.slice(index, index + 2);
    if (!ignored.has(gram)) grams.add(gram);
  }
  return [...grams].filter((gram) => matchText(part).includes(gram)).length;
}

function officialClause(text, answerLabel, questionText) {
  const target = matchText(answerLabel);
  if (target.length < 2) return null;
  const candidates = clean(text).split(/[。；]/).map((part) => part.trim()).filter((part) => matchText(part).includes(target))
    .map((part) => ({part,score:overlapScore(part,questionText)}));
  if (!candidates.length) return null;
  let clause = candidates.sort((a, b) => b.score - a.score || a.part.length - b.part.length)[0].part
    .replace(/^[*•]?(?:[（(]?[一二三四五六七八九十百\d]+[）)、.]?)?\s*/, "")
    .trim();
  if (clause.length > 115) {
    const compactLabel = clean(answerLabel);
    const index = clause.indexOf(compactLabel);
    if (index >= 0) {
      const start = Math.max(0, index - 35);
      const end = Math.min(clause.length, index + compactLabel.length + 50);
      clause = `${start ? "…" : ""}${clause.slice(start, end)}${end < clause.length ? "…" : ""}`;
    } else {
      clause = `${clause.slice(0, 112)}…`;
    }
  }
  return clause.replace(/[。；]+$/g, "");
}

function relatedOfficialClause(text, questionText) {
  const candidates = clean(text).split(/[。；]/).map((part) => part.trim()).filter(Boolean)
    .map((part) => ({ part, score: overlapScore(part, questionText) }))
    .sort((a, b) => b.score - a.score || a.part.length - b.part.length);
  if (!candidates[0] || candidates[0].score < 4) return null;
  let clause = candidates[0].part.replace(/^[*•]?(?:[（(]?[一二三四五六七八九十百\d]+[）)、.]?)?\s*/, "").trim();
  if (clause.length > 115) clause = `${clause.slice(0, 112)}…`;
  return clause.replace(/[。；]+$/g, "");
}

function isNumberAnswer(label) {
  return /\d|[一二三四五六七八九十百千]+(?:年|月|日|名|屆|次|期)|周歲|過半|三分|四分|每年|有期徒刑/.test(label);
}

function isAuthorityQuestion(text) {
  return /由誰|誰人|哪位|誰負責|哪個機構/.test(text);
}

function isNegativeQuestion(text) {
  const choice = "(?:下列|以下|哪(?:一)?[項條位個]|哪些)";
  const negative = "(?:不是|並不|不可以|並不會|沒有|除外|不需要|無需|不屬|不須|不正確|不包括)";
  return new RegExp(`${choice}.{0,35}${negative}|${negative}.{0,15}${choice}`).test(text);
}

function chapterFor(article) {
  if (article <= 11) return 1;
  if (article === 12) return 2;
  if (article <= 23) return 3;
  if (article <= 42) return 4;
  if (article <= 104) return 5;
  if (article <= 135) return 6;
  if (article <= 149) return 7;
  if (article <= 157) return 8;
  return 9;
}

function referenceFor(question) {
  const text = question.questionZh;
  if (/附件三/.test(text)) return { id: "basic-law-annex-3", label: "《基本法》附件三", url: `${BASIC_LAW_BASE}/national-laws.html` };
  if (/附件二/.test(text)) return { id: "basic-law-annex-2", label: "《基本法》附件二", url: `${BASIC_LAW_BASE}/annex2.html` };
  if (/附件一/.test(text)) return { id: "basic-law-annex-1", label: "《基本法》附件一", url: `${BASIC_LAW_BASE}/annex1.html` };
  if (/序言/.test(text)) return { id: "basic-law-preamble", label: "《基本法》序言", url: `${BASIC_LAW_BASE}/preamble.html` };
  if (question.domain === "nsl" && question.article) return { id: `nsl-article-${question.article}`, label: `《香港國安法》第 ${question.article} 條`, url: NSL_SOURCE };
  if (question.domain === "basic-law" && question.article) return { id: `basic-law-article-${question.article}`, label: `《基本法》第 ${question.article} 條`, url: `${BASIC_LAW_BASE}/chapter${chapterFor(question.article)}.html` };
  if (question.domain === "nsl") return { id: "nsl-promulgation-2020", label: "《香港國安法》公布安排", url: NSL_SOURCE };
  return { id: "basic-law-related-documents", label: "《基本法》相關文件", url: `${BASIC_LAW_BASE}/index.html` };
}

function focusFor(question) {
  const text = question.questionZh;
  if (/多久|多少|幾多|年滿|周歲|個月|年期|比例|過半數|三分|人數|任期|有期徒刑/.test(text)) return "法定數字或期限";
  if (/由誰|誰人|哪位|負責|任命|批准|徵詢|主管|首長|主席|機構|部門/.test(text)) return "指定嘅權力主體";
  if (/職權|職責/.test(text)) return "法定職權範圍";
  if (/權利|自由/.test(text)) return "受保障嘅權利或自由";
  if (/法律|附件三/.test(text)) return "法定法律名單";
  if (/罪|犯罪|行為/.test(text)) return "法定構成或適用範圍";
  return "條文採用嘅準確用字";
}

function negativeTarget(question) {
  const text = question.questionZh;
  if (/附件三|全國性法律/.test(text)) return "附件三現行全國性法律名單";
  if (/管轄權/.test(text)) return "香港法院依法享有管轄權嘅案件範圍";
  if (/成員|包括/.test(text)) return "條文列明嘅成員名單";
  if (/外國無居留權|永久性居民中的中國公民/.test(text)) return "必須符合有關國籍及居留資格限制嘅職位";
  if (/陳述|正確/.test(text)) return "符合條文原意嘅陳述";
  if (/職權/.test(text)) return "條文列明嘅職權";
  if (/職責/.test(text)) return "條文列明嘅職責";
  if (/權利|自由/.test(text)) return "條文保障嘅權利或自由";
  if (/罪|犯罪|行為/.test(text)) return "條文列明嘅犯罪或禁止行為";
  if (/職務|官員/.test(text)) return "條文指定嘅職位或資格範圍";
  return "題目所問嘅法定範圍";
}

function explanationFor(question, answer, reference, referenceText) {
  const label = clean(answer.labelZh);
  const negative = isNegativeQuestion(question.questionZh);
  if (question.id === "bl-01-03") {
    return "答案係 B。《全國人民代表大會議事規則》唔喺《基本法》附件三嘅全國性法律名單內；A、C、D 都屬名單內法律，所以 B 先係題目問嘅「並不是」嗰項。";
  }
  if (question.id === "bl-05-09") {
    return "答案係 C。《基本法》第 53 條訂明，行政長官缺位時要喺六個月內依照第 45 條產生新任行政長官。原答案「七個月」同現行條文不符，所以改正為 C。";
  }
  if (question.id === "bl-06-09") {
    return "答案係 C。《基本法》第 89 條只容許喺終審法院首席法官無力履行職責或行為不檢時啟動免職程序。行政長官唔可以單靠一般行政程序將首席法官免職。";
  }
  if (question.id === "nsl-08-10") {
    return "答案係 D。《香港國安法》第 29 條採用嘅原文係「憎恨」，並要求有關非法方式可能造成嚴重後果。原答案「仇恨」唔係條文用字，所以改正為 D。";
  }
  if (negative) {
    return `答案係 ${question.correctOptionId}。依據${reference.label}，「${label}」唔屬於${negativeTarget(question)}；其餘選項先係條文涵蓋嘅內容。題目問嘅係排除項，所以要揀 ${question.correctOptionId}。`;
  }
  if (/以上皆是|以上全部|上述皆是/.test(label)) {
    return `答案係 ${question.correctOptionId}。${reference.label}列出嘅對象或情況包括題目 A、B、C 三項，所以「${label}」先完整涵蓋條文要求。只揀其中一項會漏咗其餘同樣受規管嘅內容。`;
  }
  const clause = officialClause(referenceText, label, question.questionZh);
  if (clause) {
    return `答案係 ${question.correctOptionId}。${reference.label}明確訂明：「${clause}」。所以正確選項係「${label}」；其他選項會改變條文原意。`;
  }
  const relatedClause = relatedOfficialClause(referenceText, question.questionZh);
  if (relatedClause) {
    return `答案係 ${question.correctOptionId}。${reference.label}嘅相關規定係：「${relatedClause}」。由此可見，題目所問嘅正確結論係「${label}」。`;
  }
  if (isAuthorityQuestion(question.questionZh)) {
    return `答案係 ${question.correctOptionId}。${reference.label}將有關權力或責任交畀「${label}」，唔係交畀其他機關。呢題要分清依法作決定嘅主體。`;
  }
  if (isNumberAnswer(label)) {
    return `答案係 ${question.correctOptionId}。${reference.label}訂明嘅數字、期限或門檻係「${label}」。法定數字改動少少已經會令整個選項唔成立，所以要按原文揀 ${question.correctOptionId}。`;
  }
  if (/_[ _]*|＿＿|填|是：|為：|為以下|為何|是由以下/.test(question.questionZh) || /[：？?]$/.test(question.questionZh)) {
    return `答案係 ${question.correctOptionId}。${reference.label}喺呢個位置採用嘅內容係「${label}」；放返入題幹後，法律關係先完整同準確。其他選項會改變${focusFor(question)}。`;
  }
  return `答案係 ${question.correctOptionId}。${reference.label}訂明嘅內容係「${label}」，呢個先符合題目所問嘅${focusFor(question)}。判斷時要以條文實際規定為準。`;
}

function trapFor(question, answer) {
  const label = clean(answer.labelZh);
  if (isNegativeQuestion(question.questionZh)) {
    return `題目問排除項；要揀出唔屬於${negativeTarget(question)}嘅「${label}」。`;
  }
  if (isNumberAnswer(label)) {
    return `呢題考法定數字：準確答案係「${label}」。`;
  }
  if (isAuthorityQuestion(question.questionZh)) {
    return `唔好交換權力主體；條文指定嘅係「${label}」。`;
  }
  return null;
}

function trapTypeFor(question, answer) {
  if (isNegativeQuestion(question.questionZh)) return "negative-wording";
  if (isNumberAnswer(clean(answer.labelZh))) return "numbers";
  if (isAuthorityQuestion(question.questionZh)) return "authority";
  return "wording";
}

async function main() {
  if (!force) {
    try {
      await readFile(outputPath, "utf8");
      throw new Error("question-audit.json already exists; pass --force only when intentionally reseeding all reviewed content");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const bank = JSON.parse(await readFile(bankPath, "utf8"));
  const legalReferences = JSON.parse(await readFile(join(root, "content/basic-law/legal-references.json"), "utf8"));
  const referencesById = new Map(legalReferences.references.map((reference) => [reference.id ?? `${reference.domain}-article-${reference.article}`, reference]));
  const entries = {};
  for (const source of bank.questions) {
    const question = { ...source, ...(corrections[source.id] ?? {}) };
    question.questionZh = clean(question.questionZh);
    const answer = question.options.find((option) => option.id === question.correctOptionId);
    if (!answer) throw new Error(`${question.id} has no answer option ${question.correctOptionId}`);
    const reference = referenceFor(question);
    const retiredReason = retired.get(question.id);
    entries[question.id] = {
      ...(corrections[question.id] ?? {}),
      explanationZh: retiredReason
        ? `呢題已停用。${retiredReason}為免學生背咗過時或含糊答案，課堂、題庫同模擬試都唔會再抽取呢題。`
        : explanationFor(question, answer, reference, referencesById.get(reference.id)?.textZh ?? ""),
      trapZh: retiredReason ? null : trapFor(question, answer),
      trapType: trapTypeFor(question, answer),
      referenceIds: [reference.id],
      officialSource: reference.url,
      verificationStatus: retiredReason ? "retired" : "verified-current",
    };
  }
  if (Object.keys(entries).length !== 310) throw new Error(`Expected 310 audit entries, found ${Object.keys(entries).length}`);
  await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, verifiedAt: "2026-08-11", sourcePolicy: "Current official law prevails over OCR and printed answer keys.", questions: entries }, null, 2)}\n`);
  console.log(`wrote ${outputPath} (${Object.keys(entries).length} reviewed records)`);
}

await main();
