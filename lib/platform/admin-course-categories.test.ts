import { describe, expect, it } from "vitest";
import {
  addCourseCategory,
  buildCourseCategoryOptions,
  categoryKey,
  closestCourseCategory,
} from "./admin-course-categories";

describe("CMS course categories", () => {
  const options = buildCourseCategoryOptions([
    { categories: ["Artificial Intelligence", "Writing"] },
    { categories: ["artificial intelligence", "Research & Analysis"] },
    { categories: ["Writing"] },
  ]);

  it("builds a canonical cloud with course usage counts", () => {
    expect(options).toEqual([
      { name: "Artificial Intelligence", count: 2 },
      { name: "Writing", count: 2 },
      { name: "Research & Analysis", count: 1 },
    ]);
  });

  it("normalises spacing and casing for duplicate protection", () => {
    expect(categoryKey("  ARTIFICIAL   Intelligence ")).toBe("artificial intelligence");
    expect(addCourseCategory([], " artificial intelligence ", options)).toEqual({
      categories: ["Artificial Intelligence"],
      error: "",
    });
    expect(addCourseCategory(["Writing"], "writing", options).error).toContain("already selected");
  });

  it("detects a likely typo before creating a split category", () => {
    expect(closestCourseCategory("Artificial Inteligence", options)?.name).toBe("Artificial Intelligence");
    expect(closestCourseCategory("Accounting", options)).toBeNull();
  });

  it("enforces category length and course limits", () => {
    expect(addCourseCategory([], "x".repeat(41), options).error).toContain("40");
    expect(addCourseCategory(Array.from({ length: 10 }, (_, index) => `Tag ${index}`), "Another", options).error).toContain("10");
  });
});
