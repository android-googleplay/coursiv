import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const course = JSON.parse(
  readFileSync(join(process.cwd(), "content/coursiv/courses/google-sheet-with-ai.json"), "utf8"),
);

describe("Google Sheet with AI course", () => {
  type Block = { type: string; text?: string; title?: string; localSrc?: string; tone?: string };
  type Lesson = { title: string; screens: Array<{ blocks: Block[] }> };
  const lessons: Lesson[] = course.units.flatMap((unit: { lessons: Lesson[] }) => unit.lessons);

  it("is a standalone course with one lesson per supplied section", () => {
    expect(course.id).toBe("google-sheet-with-ai");
    expect(course.title).toBe("Google Sheet with AI");
    expect(lessons.map((lesson: { title: string }) => lesson.title)).toEqual([
      "Create Tables",
      "Auto Populate",
      "Generate Formulas",
      "Insights and Visualizations",
      "No-Code Sheets & Scripts",
      "Gemini Image-to-Sheets Hack",
      "Automate Tasks with Gemini and Apps Script",
      "Advanced Analysis in Sheets",
      "Talk to Your Data in Sheets",
      "AI Magic in a Sheets Cell",
      "Notes to Sheets with Gemini",
    ]);
  });

  it("keeps every lesson to three concise instructions plus a takeaway", () => {
    for (const lesson of lessons) {
      expect(lesson.screens).toHaveLength(4);
      for (const [index, screen] of lesson.screens.slice(0, 3).entries()) {
        expect(screen.blocks[0]).toMatchObject({ type: "heading" });
        expect(screen.blocks[0].text).toMatch(new RegExp(`^Step ${index + 1}: `));
        expect(screen.blocks[1].type).toBe("paragraph");
        expect(screen.blocks[1].text?.length).toBeLessThanOrEqual(130);
      }
      expect(lesson.screens[3].blocks[0]).toMatchObject({ type: "heading", text: "Step 4: Takeaway" });
    }
  });

  it("places one matching image under each of the first three steps", () => {
    const instructionScreens = lessons.flatMap((lesson) => lesson.screens.slice(0, 3));
    const images = instructionScreens.map((screen) => screen.blocks.find((block) => block.type === "image"));
    expect(images).toHaveLength(33);
    for (const image of images) {
      expect(image?.localSrc).toMatch(/^\/images\/courses\/google-sheet-with-ai\/lesson-\d{2}-step-\d{2}\.avif$/);
      expect(existsSync(join(process.cwd(), "public", image!.localSrc!))).toBe(true);
    }
  });

  it("ends every lesson with a copyable prompt", () => {
    for (const lesson of lessons) {
      const finalBlocks = lesson.screens.at(-1)!.blocks;
      expect(finalBlocks.some((block) => block.type === "image")).toBe(false);
      const prompt = finalBlocks.at(-1);
      expect(prompt).toMatchObject({ type: "callout", tone: "copy-prompt" });
      expect(["Ready-to-use prompt", "Formula idea"]).toContain(prompt?.title);
      expect(prompt?.text?.length).toBeGreaterThan(40);
    }
  });
});
