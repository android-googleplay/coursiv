import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gradeCoursivScreenResponse, type CoursivCourse } from "./coursiv-content";
import { validateEditableLesson } from "./platform/admin-content-validation";
import { defaultLearnerState, coursePercent } from "./learner-state";
import { isCourseComplete } from "./certificate-eligibility";

const course = JSON.parse(readFileSync(join(process.cwd(), "content/coursiv/courses/notion.json"), "utf8")) as CoursivCourse;
const lessons = course.units.flatMap((unit) => unit.lessons);
const coreLessons = course.units.slice(0, 2).flatMap((unit) => unit.lessons);
const plain = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const words = (value: string) => plain(value).split(" ").filter(Boolean).length;

describe("Notion: Build Your Life Hub content", () => {
  it("publishes eight core lessons and one optional AI bonus", () => {
    expect(course.id).toBe("notion");
    expect(course.duration).toBe("3 hours");
    expect(course.units.map((unit) => unit.lessons.length)).toEqual([4, 4, 1]);
    expect(lessons).toHaveLength(9);
    expect(coreLessons.every((lesson) => !lesson.optional)).toBe(true);
    expect(course.units[2].lessons[0].optional).toBe(true);
  });

  it("keeps every lesson bite-sized and action-oriented", () => {
    for (const lesson of lessons) {
      expect(lesson.screens.length, lesson.slug).toBeGreaterThanOrEqual(18);
      expect(lesson.screens.length, lesson.slug).toBeLessThanOrEqual(24);
      expect(lesson.screens.some((screen) => screen.presentation === "knowledge-check"), lesson.slug).toBe(true);
      expect(lesson.screens.some((screen) => screen.interactionPolicy === "optional-practice"), lesson.slug).toBe(true);
      expect(lesson.screens.at(-1)?.presentation, lesson.slug).toBe("callout");
      const interactionIndexes = lesson.screens.map((screen, index) => screen.interactionPolicy !== "read" ? index : -1).filter((index) => index >= 0);
      const checkpoints = [-1, ...interactionIndexes, lesson.screens.length - 1];
      expect(Math.max(...checkpoints.slice(1).map((index, position) => index - checkpoints[position])), `${lesson.slug} interaction cadence`).toBeLessThanOrEqual(4);
      for (const screen of lesson.screens) {
        const prose = screen.blocks.flatMap((block) => {
          if (block.type === "heading" || block.type === "paragraph") return [block.text];
          if (block.type === "callout") return [block.title ?? "", block.text];
          if (block.type === "single-choice" || block.type === "multi-choice" || block.type === "true-false") return [block.question, block.instruction ?? ""];
          if (block.type === "ordering-task" || block.type === "matching-pairs" || block.type === "practice") return [block.title, block.prompt ?? ""];
          return [];
        }).join(" ");
        expect(words(prose), `${lesson.slug}/${screen.id}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it("keeps the free core independent from Notion AI and advanced scope", () => {
    const coreText = JSON.stringify(coreLessons.flatMap((lesson) => lesson.screens)).toLowerCase();
    expect(coreText).not.toContain("notion ai");
    expect(coreText).not.toContain("notion mail");
    for (const excluded of ["relation", "rollup", "chart", "form", "automation"]) {
      expect(coreText, excluded).not.toMatch(new RegExp(`\\b${excluded}s?\\b`));
    }
    expect(coreText.match(/\bformulas?\b/g) ?? []).toHaveLength(1);
  });

  it("uses only Tasks and Notes as the learner's permanent databases", () => {
    const raw = JSON.stringify(coreLessons);
    expect(raw).toContain("Tasks");
    expect(raw).toContain("Notes");
    expect(raw).not.toMatch(/database named <b>(?!Tasks|Notes)/);
  });

  it("passes canonical authoring validation and grades every required interaction", () => {
    for (const lesson of lessons) {
      expect(validateEditableLesson({ ...lesson, id: `notion__${lesson.slug}`, courseId: "notion" }), lesson.slug).toEqual([]);
      for (const screen of lesson.screens.filter((item) => item.interactionPolicy === "required-interaction")) {
        const block = screen.blocks[0];
        let values: string[] = [];
        if (block.type === "single-choice" || block.type === "multi-choice" || block.type === "true-false") values = block.options.filter((option) => option.isCorrect).map((option) => option.id);
        if (block.type === "ordering-task") values = block.correctItems;
        if (block.type === "matching-pairs") values = block.pairs.map((pair) => pair.right);
        expect(gradeCoursivScreenResponse(screen, { blockId: block.id, values }), `${lesson.slug}/${screen.id}`).toBe(true);
      }
    }
  });

  it("reaches 100% and certificate completion without the optional AI lesson", () => {
    const state = defaultLearnerState();
    state.courses.notion = {
      completedLessonIds: coreLessons.map((lesson) => lesson.slug),
      lastLessonId: coreLessons.at(-1)?.slug ?? null,
      lastScreenId: null,
      updatedAt: "2026-08-04T00:00:00.000Z",
    };
    expect(coursePercent(state, "notion")).toBe(100);
    expect(isCourseComplete(state, "notion")).toBe(true);
  });
});
