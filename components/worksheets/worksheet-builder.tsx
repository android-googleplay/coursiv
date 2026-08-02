"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Languages, Printer, RefreshCw, Sparkles } from "lucide-react";
import { generateWorksheet } from "@/lib/worksheets/generator";
import type { GeneratedQuestion, UiLocale, WorksheetConfig, WorksheetSubject } from "@/lib/worksheets/types";
import styles from "./worksheet-builder.module.css";

const DEFAULT_CONFIG: WorksheetConfig = {
  subject: "logic",
  level: "k1",
  questionCount: 4,
  questionsPerPage: 4,
  includeAnswers: false,
  locale: "zh-HK",
  seed: 260730,
};

const COPY = {
  "zh-HK": {
    brand: "小小教材室",
    kicker: "WORKSHEET STUDIO",
    heading: "幾分鐘製作好教材",
    intro: "選擇科目和程度，即時預覽並下載清晰的 A4 練習紙。",
    settings: "教材設定",
    subject: "科目",
    level: "程度",
    count: "題目數量",
    perPage: "每頁題數",
    answers: "在最後附上答案頁",
    regenerate: "重新生成",
    print: "列印",
    download: "下載 PDF",
    preview: "列印預覽",
    page: "練習頁",
    name: "姓名",
    date: "日期",
    answerTitle: "答案",
    answerNote: "供家長及老師參考",
    subjects: { english: "English", chinese: "中文", logic: "邏輯", math: "數學" },
    levels: { k1: "K1 入門", k2: "K2 基礎", p1: "小一", p2: "小二" },
  },
  en: {
    brand: "Little Learning Lab",
    kicker: "WORKSHEET STUDIO",
    heading: "Make a worksheet in minutes",
    intro: "Choose a subject and level, preview it instantly, then download a print-ready A4 PDF.",
    settings: "Worksheet settings",
    subject: "Subject",
    level: "Level",
    count: "Questions",
    perPage: "Questions per page",
    answers: "Include answer pages at the end",
    regenerate: "New questions",
    print: "Print",
    download: "Download PDF",
    preview: "Print preview",
    page: "Worksheet",
    name: "Name",
    date: "Date",
    answerTitle: "Answer key",
    answerNote: "For parents and teachers",
    subjects: { english: "English", chinese: "Chinese", logic: "Logic", math: "Maths" },
    levels: { k1: "K1 Starter", k2: "K2 Foundation", p1: "Primary 1", p2: "Primary 2" },
  },
} as const;

function QuestionPreview({ question, number }: { question: GeneratedQuestion; number: number }) {
  if (question.kind === "math") {
    return <div className={styles.mathQuestion}><b>{number}.</b><span>{question.expression}</span><i /></div>;
  }
  if (question.kind === "match") {
    return (
      <section className={styles.matchQuestion}>
        <b className={styles.questionNumber}>{String(number).padStart(2, "0")}</b>
        <div className={styles.matchColumn}>
          {question.left.map((item, index) => <span key={item}><i>{index + 1}</i>{item}<em /></span>)}
        </div>
        <div className={styles.matchColumn}>
          {question.right.map((item, index) => <span key={item}><em /><i>{String.fromCharCode(65 + index)}</i>{item}</span>)}
        </div>
      </section>
    );
  }
  return (
    <section className={styles.logicQuestion}>
      <b className={styles.questionNumber}>{String(number).padStart(2, "0")}</b>
      <div className={styles.sudokuGrid}>
        {question.puzzle.map((value, index) => <span key={index}>{value || ""}</span>)}
      </div>
    </section>
  );
}

export function WorksheetBuilder() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const worksheet = useMemo(() => generateWorksheet(config), [config]);
  const text = COPY[config.locale];
  const pages = useMemo(() => {
    const result: GeneratedQuestion[][] = [];
    for (let index = 0; index < worksheet.questions.length; index += config.questionsPerPage) {
      result.push(worksheet.questions.slice(index, index + config.questionsPerPage));
    }
    return result;
  }, [config.questionsPerPage, worksheet.questions]);

  function update<K extends keyof WorksheetConfig>(key: K, value: WorksheetConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function selectSubject(subject: WorksheetSubject) {
    setConfig((current) => ({
      ...current,
      subject,
      questionsPerPage: subject === "logic" ? Math.min(current.questionsPerPage, 4) : current.questionsPerPage,
    }));
  }

  function regenerate() {
    setConfig((current) => ({ ...current, seed: Math.floor(Math.random() * 4294967295) }));
  }

  async function downloadPdf() {
    const response = await fetch("/api/worksheets/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `worksheet-${config.subject}-${config.seed}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function printPdf() {
    const preview = window.open("", "_blank");
    if (preview) {
      preview.document.title = text.print;
      preview.document.body.innerHTML = `<p style="font:16px sans-serif;padding:24px">${config.locale === "en" ? "Preparing print preview..." : "正在準備列印預覽…"}</p>`;
    }
    const response = await fetch("/api/worksheets/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      preview?.close();
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    if (preview) preview.location.href = url;
    else window.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <main className={styles.stage}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/worksheet-builder"><span><FileText /></span>{text.brand}</a>
        <button className={styles.localeButton} onClick={() => update("locale", config.locale === "en" ? "zh-HK" : "en")}>
          <Languages /> {config.locale === "en" ? "繁中" : "EN"}
        </button>
      </header>

      <div className={styles.hero}>
        <div><span>{text.kicker}</span><h1>{text.heading}</h1><p>{text.intro}</p></div>
        <div className={styles.heroArt}><Sparkles /><b>ABC</b><i>1 2 3 4</i></div>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.controls}>
          <h2>{text.settings}</h2>
          <fieldset>
            <legend>{text.subject}</legend>
            <div className={styles.subjectGrid}>
              {(Object.keys(text.subjects) as WorksheetSubject[]).map((subject) => (
                <button key={subject} className={config.subject === subject ? styles.active : ""} onClick={() => selectSubject(subject)}>
                  {text.subjects[subject]}
                </button>
              ))}
            </div>
          </fieldset>
          <label>{text.level}
            <select value={config.level} onChange={(event) => update("level", event.target.value as WorksheetConfig["level"])}>
              {Object.entries(text.levels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className={styles.inlineFields}>
            <label>{text.count}
              <input type="number" min="1" max="40" value={config.questionCount} onChange={(event) => update("questionCount", Math.max(1, Math.min(40, Number(event.target.value))))} />
            </label>
            <label>{text.perPage}
              <select value={config.questionsPerPage} onChange={(event) => update("questionsPerPage", Number(event.target.value))}>
                {(config.subject === "logic" ? [1, 2, 4] : [2, 4, 6, 8, 10, 12]).map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={config.includeAnswers} onChange={(event) => update("includeAnswers", event.target.checked)} />
            <span>{text.answers}</span>
          </label>
          <div className={styles.actionRow}>
            <button className={styles.secondary} onClick={regenerate}><RefreshCw />{text.regenerate}</button>
            <button className={styles.secondary} onClick={printPdf}><Printer />{text.print}</button>
            <button className={styles.primary} onClick={downloadPdf}><Download />{text.download}</button>
          </div>
          <small>Seed {config.seed}</small>
        </aside>

        <section className={styles.preview}>
          <div className={styles.previewHeading}><span>{text.preview}</span><b>{pages.length + (config.includeAnswers ? 1 : 0)} pages · A4</b></div>
          <div className={styles.pageStack}>
            {pages.map((pageQuestions, pageIndex) => (
              <article className={styles.paper} key={pageIndex} data-testid="worksheet-page">
                <header><div><small>{text.page} {pageIndex + 1}</small><h2>{worksheet.title}</h2><p>{worksheet.instruction}</p></div><span>{config.subject === "logic" ? "◇" : config.subject === "math" ? "＋" : config.subject === "chinese" ? "字" : "Aa"}</span></header>
                <div className={styles.studentLine}><span>{text.name}: ____________________</span><span>{text.date}: ____________</span></div>
                <div
                  className={`${styles.questionList} ${styles[config.subject]}`}
                  style={config.subject === "logic" ? { gridTemplateRows: `repeat(${Math.ceil(pageQuestions.length / 2)}, 1fr)` } : undefined}
                >
                  {pageQuestions.map((question, index) => <QuestionPreview key={question.id} question={question} number={pageIndex * config.questionsPerPage + index + 1} />)}
                </div>
                <footer>{text.brand}<span>{pageIndex + 1} / {pages.length}</span></footer>
              </article>
            ))}
            {config.includeAnswers && (
              <article className={`${styles.paper} ${styles.answerPaper}`} data-testid="answer-page">
                <header><div><small>{text.answerNote}</small><h2>{text.answerTitle}</h2></div><span>✓</span></header>
                <ol>{worksheet.answers.map((answer, index) => <li key={answer.questionId}><b>{index + 1}.</b> {answer.answer}</li>)}</ol>
                <footer>{text.brand}<span>✓</span></footer>
              </article>
            )}
          </div>
        </section>
      </div>

      <div className={styles.mobileActions}>
        <button className={styles.secondary} onClick={regenerate}><RefreshCw />{text.regenerate}</button>
        <button className={styles.secondary} onClick={printPdf}><Printer />{text.print}</button>
        <button className={styles.primary} onClick={downloadPdf}><Download />{text.download}</button>
      </div>
    </main>
  );
}
