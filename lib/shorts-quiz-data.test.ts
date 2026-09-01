import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shortsQuizData } from "./shorts-quiz-data";

const courseFiles = [
  "google-sheet-with-ai-shorts.json",
  "google-slide-with-ai-short.json",
];

describe("Shorts lesson quizzes", () => {
  it.each(courseFiles)("gives every lesson in %s a valid 3 to 4 question quiz", (fileName) => {
    const course = JSON.parse(readFileSync(join(process.cwd(), "content/coursiv/courses", fileName), "utf8"));
    const lessons: Array<{ slug: string }> = course.units.flatMap((unit: { lessons: Array<{ slug: string }> }) => unit.lessons);
    const quizzes = shortsQuizData[course.id];

    expect(quizzes).toBeDefined();
    for (const lesson of lessons) {
      const questions = quizzes[lesson.slug];
      expect(questions).toHaveLength(3);
      for (const question of questions) {
        expect(question.question.length).toBeGreaterThan(15);
        expect(question.options.length).toBeGreaterThanOrEqual(3);
        expect(question.options.length).toBeLessThanOrEqual(4);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(question.options.length);
        expect(question.explanation.length).toBeGreaterThan(20);
      }
    }
  });
});
