import { describe, expect, it } from "vitest";
import { validateCourseMetadata } from "./admin-course-validation";
import type { EditableCourse } from "./admin-content-repository";

function course(overrides: Partial<EditableCourse> = {}): EditableCourse {
  return {
    id: "course-id",
    sourceId: "source-id",
    title: "Course title",
    kind: "tool",
    duration: "3 hours",
    lessonCount: 2,
    categories: ["New"],
    displayOrder: 0,
    unitSummaries: [{ sourceId: "unit-id", title: "Lessons", order: 0 }],
    lessonSummaries: [],
    status: "published",
    publishedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "editor",
    version: 1,
    ...overrides,
  };
}

describe("course metadata validation", () => {
  it("accepts a valid published course", () => {
    expect(validateCourseMetadata(course())).toEqual([]);
  });

  it("rejects duplicate categories and unsafe covers", () => {
    const errors = validateCourseMetadata(course({ categories: ["New", "new"], image: "http://unsafe.test/cover.png" }));
    expect(errors).toContain("Course categories must be unique.");
    expect(errors).toContain("Course cover must use HTTPS or a local asset path.");
  });

  it("requires a lesson before publishing while allowing empty drafts", () => {
    expect(validateCourseMetadata(course({ lessonCount: 0 }))).toContain("A published course must contain at least one lesson.");
    expect(validateCourseMetadata(course({ lessonCount: 0, status: "draft", publishedAt: null }))).toEqual([]);
  });

  it("validates editable course sections and lesson assignments", () => {
    const invalid=course({
      unitSummaries:[
        {sourceId:"unit-a",title:"Lessons",order:0},
        {sourceId:"unit-b",title:"lessons",order:0},
      ],
      lessonSummaries:[{id:"lesson",slug:"lesson",sourceId:"source",sourceUnitId:"missing",title:"Lesson",order:0,screenIds:["screen"],hasAudio:false,version:1}],
    });
    const errors=validateCourseMetadata(invalid);
    expect(errors).toContain("Course section order must use unique non-negative whole numbers.");
    expect(errors).toContain("Course section titles must be unique.");
    expect(errors).toContain("Every lesson must belong to an existing course section.");
  });
});
