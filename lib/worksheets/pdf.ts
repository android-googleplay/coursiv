import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateWorksheet } from "./generator";
import type { GeneratedQuestion, WorksheetConfig } from "./types";

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.12, 0.2, 0.18);
const GREEN = rgb(0.11, 0.44, 0.36);
const MUTED = rgb(0.38, 0.46, 0.43);
const LIGHT = rgb(0.88, 0.92, 0.89);

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, width: number) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + Math.max(0, (width - textWidth) / 2), y, size, font, color: INK });
}

function drawPageHeader(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, instruction: string, pageNumber: number, locale: string) {
  page.drawText(locale === "en" ? `WORKSHEET ${pageNumber}` : `練習頁 ${pageNumber}`, { x: 42, y: 790, size: 8, font: bold, color: GREEN });
  page.drawText(title, { x: 42, y: 759, size: 24, font: bold, color: INK });
  page.drawText(instruction, { x: 42, y: 735, size: 10, font, color: MUTED });
  page.drawLine({ start: { x: 42, y: 716 }, end: { x: 553, y: 716 }, thickness: 2.5, color: GREEN });
  const name = locale === "en" ? "Name" : "姓名";
  const date = locale === "en" ? "Date" : "日期";
  page.drawText(`${name}: ____________________`, { x: 42, y: 692, size: 10, font, color: MUTED });
  page.drawText(`${date}: ______________`, { x: 405, y: 692, size: 10, font, color: MUTED });
}

function drawLogic(page: PDFPage, question: Extract<GeneratedQuestion, { kind: "logic" }>, number: number, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, height: number) {
  const size = Math.min(width - 12, height - 12, 260);
  const gridX = x + (width - size) / 2 + 8;
  const gridY = y + (height - size) / 2;
  page.drawText(String(number).padStart(2, "0"), { x: x, y: y + height - 14, size: 8, font: bold, color: GREEN });
  page.drawRectangle({ x: gridX, y: gridY, width: size, height: size, borderColor: INK, borderWidth: 1.8 });
  for (let index = 1; index < 4; index += 1) {
    const thickness = index === 2 ? 1.8 : 0.65;
    page.drawLine({ start: { x: gridX + index * size / 4, y: gridY }, end: { x: gridX + index * size / 4, y: gridY + size }, thickness, color: INK });
    page.drawLine({ start: { x: gridX, y: gridY + index * size / 4 }, end: { x: gridX + size, y: gridY + index * size / 4 }, thickness, color: INK });
  }
  question.puzzle.forEach((value, index) => {
    if (!value) return;
    const row = Math.floor(index / 4);
    const column = index % 4;
    const cell = size / 4;
    drawCentered(page, String(value), bold, Math.max(11, cell * 0.42), gridX + column * cell, gridY + (3 - row) * cell + cell * 0.28, cell);
  });
}

function drawMatch(page: PDFPage, question: Extract<GeneratedQuestion, { kind: "match" }>, number: number, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x: x + 4, y: y + 4, width: width - 8, height: height - 8, borderColor: LIGHT, borderWidth: 1 });
  page.drawText(String(number).padStart(2, "0"), { x: x + 12, y: y + height - 23, size: 8, font: bold, color: GREEN });
  const rowHeight = Math.min(34, (height - 35) / 4);
  const startY = y + height - 43;
  question.left.forEach((item, index) => {
    const itemY = startY - index * rowHeight;
    page.drawCircle({ x: x + 31, y: itemY + 4, size: 7, color: GREEN });
    drawCentered(page, String(index + 1), bold, 6, x + 24, itemY + 2, 14);
    page.drawText(item, { x: x + 45, y: itemY, size: Math.min(13, rowHeight * 0.42), font: bold, color: INK });
    page.drawCircle({ x: x + width * 0.45, y: itemY + 4, size: 2.4, borderColor: MUTED, borderWidth: 0.7 });
  });
  question.right.forEach((item, index) => {
    const itemY = startY - index * rowHeight;
    page.drawCircle({ x: x + width * 0.57, y: itemY + 4, size: 2.4, borderColor: MUTED, borderWidth: 0.7 });
    page.drawCircle({ x: x + width * 0.65, y: itemY + 4, size: 7, color: rgb(0.42, 0.6, 0.53) });
    drawCentered(page, String.fromCharCode(65 + index), bold, 6, x + width * 0.65 - 7, itemY + 2, 14);
    page.drawText(item, { x: x + width * 0.71, y: itemY, size: Math.min(11, rowHeight * 0.38), font, color: INK });
  });
}

function drawMath(page: PDFPage, question: Extract<GeneratedQuestion, { kind: "math" }>, number: number, font: PDFFont, bold: PDFFont, x: number, y: number, width: number, height: number) {
  page.drawText(`${number}.`, { x: x + 6, y: y + height / 2, size: 11, font: bold, color: GREEN });
  page.drawText(question.expression, { x: x + 32, y: y + height / 2 - 2, size: Math.min(20, height * 0.3), font: bold, color: INK });
  page.drawLine({ start: { x: x + width - 76, y: y + height / 2 - 4 }, end: { x: x + width - 15, y: y + height / 2 - 4 }, thickness: 0.8, color: INK });
  page.drawLine({ start: { x: x + 6, y: y + 9 }, end: { x: x + width - 6, y: y + 9 }, thickness: 0.5, color: LIGHT });
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number, total: number, locale: string) {
  page.drawLine({ start: { x: 42, y: 33 }, end: { x: 553, y: 33 }, thickness: 0.6, color: LIGHT });
  page.drawText(locale === "en" ? "Little Learning Lab" : "小小教材室", { x: 42, y: 18, size: 7, font, color: MUTED });
  const generatedDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  drawCentered(page, `Generated on ${generatedDate}`, font, 7, 205, 18, 185);
  page.drawText(`${pageNumber} / ${total}`, { x: 525, y: 18, size: 7, font, color: MUTED });
}

function drawQuestionGrid(page: PDFPage, questions: GeneratedQuestion[], startNumber: number, font: PDFFont, bold: PDFFont) {
  const columns = questions.length === 1 ? 1 : 2;
  const rows = Math.ceil(questions.length / columns);
  const area = { x: 42, y: 54, width: 511, height: 615 };
  const gap = 12;
  const cellWidth = (area.width - gap * (columns - 1)) / columns;
  const cellHeight = (area.height - gap * (rows - 1)) / rows;
  questions.forEach((question, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = area.x + column * (cellWidth + gap);
    const y = area.y + area.height - (row + 1) * cellHeight - row * gap;
    if (question.kind === "logic") drawLogic(page, question, startNumber + index, font, bold, x, y, cellWidth, cellHeight);
    if (question.kind === "match") drawMatch(page, question, startNumber + index, font, bold, x, y, cellWidth, cellHeight);
    if (question.kind === "math") drawMath(page, question, startNumber + index, font, bold, x, y, cellWidth, cellHeight);
  });
}

export async function buildWorksheetPdf(config: WorksheetConfig) {
  const worksheet = generateWorksheet(config);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regularPath = path.join(process.cwd(), "node_modules/@expo-google-fonts/noto-sans-tc/400Regular/NotoSansTC_400Regular.ttf");
  const boldPath = path.join(process.cwd(), "node_modules/@expo-google-fonts/noto-sans-tc/700Bold/NotoSansTC_700Bold.ttf");
  const [regularBytes, boldBytes] = await Promise.all([readFile(regularPath), readFile(boldPath)]);
  const [font, bold] = await Promise.all([
    document.embedFont(regularBytes, { subset: false }),
    document.embedFont(boldBytes, { subset: false }),
  ]);
  const worksheetPageCount = Math.ceil(worksheet.questions.length / config.questionsPerPage);
  const total = worksheetPageCount + (config.includeAnswers ? 1 : 0);
  for (let pageIndex = 0; pageIndex < worksheetPageCount; pageIndex += 1) {
    const page = document.addPage(A4);
    const start = pageIndex * config.questionsPerPage;
    drawPageHeader(page, font, bold, worksheet.title, worksheet.instruction, pageIndex + 1, config.locale);
    drawQuestionGrid(page, worksheet.questions.slice(start, start + config.questionsPerPage), start + 1, font, bold);
    drawFooter(page, font, pageIndex + 1, total, config.locale);
  }
  if (config.includeAnswers) {
    const page = document.addPage(A4);
    const title = config.locale === "en" ? "Answer key" : "答案";
    const note = config.locale === "en" ? "For parents and teachers" : "供家長及老師參考";
    page.drawText(note, { x: 42, y: 790, size: 8, font: bold, color: GREEN });
    page.drawText(title, { x: 42, y: 754, size: 26, font: bold, color: INK });
    page.drawLine({ start: { x: 42, y: 735 }, end: { x: 553, y: 735 }, thickness: 2.5, color: GREEN });
    const columns = 2;
    const rowHeight = Math.min(31, 650 / Math.ceil(worksheet.answers.length / columns));
    worksheet.answers.forEach((answer, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 42 + column * 260;
      const y = 705 - row * rowHeight;
      const value = answer.answer.length > 31 ? `${answer.answer.slice(0, 31)}...` : answer.answer;
      page.drawText(`${index + 1}. ${value}`, { x, y, size: 9, font, color: INK });
      page.drawLine({ start: { x, y: y - 7 }, end: { x: x + 240, y: y - 7 }, thickness: 0.4, color: LIGHT });
    });
    drawFooter(page, font, total, total, config.locale);
  }
  document.setTitle(worksheet.title);
  document.setCreator("Little Learning Lab");
  return document.save();
}
