import { describe, expect, it } from "vitest";
import { courseEntryHref, courseLessonHref } from "./course-navigation";

describe("course lesson navigation", () => {
  it("routes each course type to its intended entry experience", () => {
    expect(courseEntryHref("use-case-2")).toBe("/course/use-case-2");
    expect(courseEntryHref("basic-law-mocks")).toBe("/use-cases/basic-law-mocks");
    expect(courseEntryHref("basic-law-practice")).toBe("/course/basic-law-practice/practice");
  });

  it("opens regular lessons directly in the requested mode", () => {
    expect(courseLessonHref("use-case-2", "build-a-plan")).toBe(
      "/course/use-case-2/lesson/build-a-plan?mode=read",
    );
    expect(courseLessonHref("use-case-2", "build-a-plan", "listen")).toBe(
      "/course/use-case-2/lesson/build-a-plan?mode=listen",
    );
  });

  it("opens the practice bank without an intermediate course map", () => {
    expect(courseLessonHref("basic-law-practice", "practice-bank")).toBe(
      "/course/basic-law-practice/practice",
    );
  });

  it("opens every mock directly in its player", () => {
    for (const mockNumber of [1, 2, 3, 4]) {
      expect(courseLessonHref("basic-law-mocks", `mock-${mockNumber}`)).toBe(
        `/course/basic-law-mocks/mock/mock-${mockNumber}`,
      );
    }
  });
});
