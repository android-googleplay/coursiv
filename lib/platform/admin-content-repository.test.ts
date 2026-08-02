import { describe, expect, it } from "vitest";
import { hydrateDocumentId } from "./admin-document-hydration";

describe("hydrateDocumentId", () => {
  it("uses the Firestore document ID when legacy lesson data has no embedded ID", () => {
    const lesson = hydrateDocumentId("course__lesson", {
      courseId: "course",
      schemaVersion: 3,
      sourceId: "source",
      sourceUnitId: "unit",
      sourceGuideId: "guide",
      slug: "lesson",
      title: "Lesson",
      order: 0,
      readUrl: "",
      hasAudio: false,
      screens: [{
        id: "screen",
        sourcePageId: "screen",
        order: 0,
        type: "content",
        presentation: "content",
        interactionPolicy: "read",
        blocks: [{ id: "heading", type: "heading", text: "Lesson", level: 2 }],
      }],
      blocks: [{ id: "heading", type: "heading", text: "Lesson", level: 2 }],
      raw: {},
      status: "published",
      version: 1,
      updatedAt: "2026-07-27T00:00:00.000Z",
      updatedBy: "migration",
    });

    expect(lesson.id).toBe("course__lesson");
    expect(lesson.courseId).toBe("course");
    expect(lesson.slug).toBe("lesson");
  });
});
