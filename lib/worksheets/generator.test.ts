import { describe, expect, it } from "vitest";
import { countLogicSolutions, generateWorksheet, normalizeWorksheetConfig } from "./generator";

describe("worksheet generators", () => {
  it("reproduces the same worksheet from the same seed", () => {
    const config = { subject: "logic" as const, seed: 8102, questionCount: 4 };
    expect(generateWorksheet(config)).toEqual(generateWorksheet(config));
    expect(generateWorksheet({ ...config, seed: 8103 })).not.toEqual(generateWorksheet(config));
  });

  it.each(["english", "chinese"] as const)("uses reviewed pairs for %s matching", (subject) => {
    const worksheet = generateWorksheet({ subject, seed: 9, questionCount: 3 });
    for (const question of worksheet.questions) {
      expect(question.kind).toBe("match");
      if (question.kind === "match") {
        expect(question.left).toHaveLength(4);
        expect([...question.answers].sort()).toEqual([0, 1, 2, 3]);
      }
    }
  });

  it("keeps maths answers non-negative and inside the selected range", () => {
    const worksheet = generateWorksheet({ subject: "math", level: "k2", seed: 12, questionCount: 40 });
    for (const question of worksheet.questions) {
      expect(question.kind).toBe("math");
      if (question.kind === "math") {
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThanOrEqual(10);
      }
    }
  });

  it("creates uniquely solvable 4 by 4 puzzles", () => {
    const worksheet = generateWorksheet({ subject: "logic", level: "p2", seed: 77, questionCount: 10 });
    for (const question of worksheet.questions) {
      expect(question.kind).toBe("logic");
      if (question.kind === "logic") expect(countLogicSolutions(question.puzzle)).toBe(1);
    }
  });

  it("uses the fixed easy pattern at four rotated angles for K1", () => {
    const worksheet = generateWorksheet({ subject: "logic", level: "k1", seed: 100, questionCount: 4 });
    const blankPatterns = worksheet.questions.map((question) => {
      expect(question.kind).toBe("logic");
      if (question.kind !== "logic") return "";
      expect(countLogicSolutions(question.puzzle)).toBe(1);
      expect(question.puzzle.filter((value) => value === 0)).toHaveLength(6);
      return question.puzzle.map((value, index) => value === 0 ? index : -1).filter((index) => index >= 0).join(",");
    });
    expect(new Set(blankPatterns).size).toBe(4);
  });

  it("bounds unsafe input", () => {
    expect(normalizeWorksheetConfig({ questionCount: 500, questionsPerPage: 99 }).questionCount).toBe(40);
    expect(normalizeWorksheetConfig({ questionCount: -1, questionsPerPage: 0 }).questionsPerPage).toBe(2);
    expect(normalizeWorksheetConfig({ subject: "logic", questionsPerPage: 12 }).questionsPerPage).toBe(4);
  });
});
