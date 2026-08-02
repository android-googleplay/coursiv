import { describe, expect, it } from "vitest";
import { buildLessonStarter, nextLessonOrder } from "./admin-lesson-starter";

function idFactory() {
  let value = 0;
  return () => String(++value);
}

describe("CMS lesson starters", () => {
  it("creates a content lesson with stable unique IDs and an intentionally incomplete body", () => {
    const [screen] = buildLessonStarter("content", "Research basics", idFactory());
    expect(screen.presentation).toBe("content");
    expect(screen.interactionPolicy).toBe("read");
    expect(screen.blocks.map((block) => block.type)).toEqual(["heading", "paragraph"]);
    expect(screen.blocks[1]).toMatchObject({ type: "paragraph", text: "" });
    expect(new Set([screen.id, screen.sourcePageId, ...screen.blocks.map((block) => block.id)]).size).toBe(4);
  });

  it("creates guided media, quiz and practice starter screens", () => {
    expect(buildLessonStarter("image", "Image lesson", idFactory())[0]).toMatchObject({
      presentation: "media",
      interactionPolicy: "read",
    });
    expect(buildLessonStarter("quiz", "Quick check", idFactory())[0]).toMatchObject({
      presentation: "knowledge-check",
      interactionPolicy: "required-interaction",
    });
    expect(buildLessonStarter("practice", "Try it", idFactory())[0]).toMatchObject({
      presentation: "practice",
      interactionPolicy: "optional-practice",
    });
  });

  it("calculates ordering inside the selected section only", () => {
    expect(nextLessonOrder([
      { sourceUnitId: "unit-a", order: 0 },
      { sourceUnitId: "unit-a", order: 4 },
      { sourceUnitId: "unit-b", order: 12 },
    ], "unit-a")).toBe(5);
    expect(nextLessonOrder([], "unit-new")).toBe(0);
  });
});
