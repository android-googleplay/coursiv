import type {
  AnswerEntry,
  GeneratedQuestion,
  LogicQuestion,
  MatchQuestion,
  WorksheetConfig,
  WorksheetDefinition,
  WorksheetLevel,
  WorksheetSubject,
} from "./types";

const ENGLISH_PAIRS = [
  ["A", "apple"], ["B", "ball"], ["C", "cat"], ["D", "dog"],
  ["E", "egg"], ["F", "fish"], ["G", "grape"], ["H", "hat"],
  ["I", "ice"], ["J", "jam"], ["K", "kite"], ["L", "lion"],
] as const;

const CHINESE_PAIRS = [
  ["日", "太陽"], ["月", "月亮"], ["山", "高山"], ["水", "河水"],
  ["火", "火焰"], ["木", "樹木"], ["人", "人物"], ["口", "嘴巴"],
  ["手", "雙手"], ["目", "眼睛"], ["雨", "下雨"], ["田", "農田"],
] as const;

const SUBJECT_COPY: Record<WorksheetSubject, { zh: [string, string]; en: [string, string] }> = {
  english: { zh: ["English 字詞配對", "把英文字母和正確的單字連起來。"], en: ["English Word Match", "Draw a line from each letter to the correct word."] },
  chinese: { zh: ["中文識字配對", "把中文字和正確的詞語連起來。"], en: ["Chinese Word Match", "Connect each character to the correct word."] },
  logic: { zh: ["數獨四宮格", "每行、每列和每個 2×2 方格都要填入 1 至 4。"], en: ["4 × 4 Mini Sudoku", "Use 1 to 4 once in every row, column and 2 × 2 box."] },
  math: { zh: ["數學加減練習", "計算下列算式，並把答案寫在橫線上。"], en: ["Maths Practice", "Solve each question and write the answer on the line."] },
};

export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  integer(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = this.integer(0, index);
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }
}

export function normalizeWorksheetConfig(input: Partial<WorksheetConfig>): WorksheetConfig {
  const subjects: WorksheetSubject[] = ["english", "chinese", "logic", "math"];
  const levels: WorksheetLevel[] = ["k1", "k2", "p1", "p2"];
  const subject = subjects.includes(input.subject as WorksheetSubject) ? input.subject as WorksheetSubject : "logic";
  const level = levels.includes(input.level as WorksheetLevel) ? input.level as WorksheetLevel : "k2";
  const questionCount = Math.max(1, Math.min(40, Math.floor(Number(input.questionCount) || 8)));
  const requestedPerPage = Math.max(1, Math.min(12, Math.floor(Number(input.questionsPerPage) || 2)));
  const questionsPerPage = subject === "logic" ? Math.min(4, requestedPerPage) : requestedPerPage;
  const seedNumber = Math.floor(Number(input.seed));
  return {
    subject,
    level,
    questionCount,
    questionsPerPage,
    includeAnswers: input.includeAnswers !== false,
    locale: input.locale === "en" ? "en" : "zh-HK",
    seed: Number.isFinite(seedNumber) ? seedNumber >>> 0 : 1,
  };
}

function createMatchQuestion(
  id: string,
  source: readonly (readonly [string, string])[],
  random: SeededRandom,
): MatchQuestion {
  const selected = random.shuffle(source).slice(0, 4);
  const right = random.shuffle(selected.map((pair) => pair[1]));
  return {
    kind: "match",
    id,
    left: selected.map((pair) => pair[0]),
    right,
    answers: selected.map((pair) => right.indexOf(pair[1])),
  };
}

function createMathQuestion(id: string, level: WorksheetLevel, random: SeededRandom): GeneratedQuestion {
  const maximum = level === "k1" ? 5 : level === "k2" ? 10 : level === "p1" ? 20 : 100;
  const addition = random.next() >= (level === "k1" ? 1 : 0.42);
  if (addition) {
    const left = random.integer(0, maximum);
    const right = random.integer(0, maximum - left);
    return { kind: "math", id, expression: `${left} + ${right} =`, answer: left + right };
  }
  const left = random.integer(1, maximum);
  const right = random.integer(0, left);
  return { kind: "math", id, expression: `${left} - ${right} =`, answer: left - right };
}

function validCandidates(board: number[], position: number) {
  const row = Math.floor(position / 4);
  const column = position % 4;
  const boxRow = Math.floor(row / 2) * 2;
  const boxColumn = Math.floor(column / 2) * 2;
  const used = new Set<number>();
  for (let index = 0; index < 4; index += 1) {
    used.add(board[row * 4 + index]);
    used.add(board[index * 4 + column]);
  }
  for (let y = boxRow; y < boxRow + 2; y += 1) {
    for (let x = boxColumn; x < boxColumn + 2; x += 1) used.add(board[y * 4 + x]);
  }
  return [1, 2, 3, 4].filter((value) => !used.has(value));
}

export function countLogicSolutions(input: number[], limit = 2): number {
  const board = [...input];
  let solutions = 0;
  function solve() {
    if (solutions >= limit) return;
    const empty = board.indexOf(0);
    if (empty === -1) {
      solutions += 1;
      return;
    }
    for (const candidate of validCandidates(board, empty)) {
      board[empty] = candidate;
      solve();
      board[empty] = 0;
    }
  }
  solve();
  return solutions;
}

const K1_BLANK_PATTERN = [3, 5, 8, 11, 12, 14];

function rotateCell(position: number, quarterTurns: number) {
  let row = Math.floor(position / 4);
  let column = position % 4;
  for (let turn = 0; turn < quarterTurns; turn += 1) {
    [row, column] = [column, 3 - row];
  }
  return row * 4 + column;
}

function createLogicQuestion(id: string, level: WorksheetLevel, random: SeededRandom, rotation = 0): LogicQuestion {
  const symbols = random.shuffle([1, 2, 3, 4]);
  const rowOrder = random.shuffle([0, 1]).flatMap((band) => random.shuffle([band * 2, band * 2 + 1]));
  const columnOrder = random.shuffle([0, 1]).flatMap((stack) => random.shuffle([stack * 2, stack * 2 + 1]));
  const base = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
  const solution = rowOrder.flatMap((row) => columnOrder.map((column) => symbols[base[row * 4 + column] - 1]));
  const puzzle = [...solution];
  if (level === "k1") {
    for (const position of K1_BLANK_PATTERN.map((cell) => rotateCell(cell, rotation % 4))) puzzle[position] = 0;
    return { kind: "logic", id, puzzle, solution };
  }
  const targetGiven = level === "k2" ? 8 : level === "p1" ? 7 : 6;
  for (const position of random.shuffle([...Array(16).keys()])) {
    if (puzzle.filter(Boolean).length <= targetGiven) break;
    const previous = puzzle[position];
    puzzle[position] = 0;
    if (countLogicSolutions(puzzle) !== 1) puzzle[position] = previous;
  }
  return { kind: "logic", id, puzzle, solution };
}

function answerFor(question: GeneratedQuestion): AnswerEntry {
  if (question.kind === "math") return { questionId: question.id, answer: String(question.answer) };
  if (question.kind === "match") {
    return { questionId: question.id, answer: question.answers.map((right, left) => `${left + 1}-${String.fromCharCode(65 + right)}`).join(", ") };
  }
  return { questionId: question.id, answer: question.solution.join(" ") };
}

export function generateWorksheet(input: Partial<WorksheetConfig>): WorksheetDefinition {
  const config = normalizeWorksheetConfig(input);
  const random = new SeededRandom(config.seed);
  const questions = Array.from({ length: config.questionCount }, (_, index) => {
    const id = `q${index + 1}`;
    if (config.subject === "english") return createMatchQuestion(id, ENGLISH_PAIRS, random);
    if (config.subject === "chinese") return createMatchQuestion(id, CHINESE_PAIRS, random);
    if (config.subject === "math") return createMathQuestion(id, config.level, random);
    return createLogicQuestion(id, config.level, random, (config.seed + index) % 4);
  });
  const copy = SUBJECT_COPY[config.subject][config.locale === "en" ? "en" : "zh"];
  return { config, title: copy[0], instruction: copy[1], questions, answers: questions.map(answerFor) };
}
