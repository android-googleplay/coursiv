import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const course = JSON.parse(
  readFileSync(join(process.cwd(), "content/coursiv/courses/google-slide-with-ai.json"), "utf8"),
);

describe("Google Slide with AI course", () => {
  type Block = { type: string; text?: string; title?: string; localSrc?: string; tone?: string };
  type Lesson = { title: string; screens: Array<{ blocks: Block[] }> };
  const lessons: Lesson[] = course.units.flatMap((unit: { lessons: Lesson[] }) => unit.lessons);

  it("is a standalone course with one lesson per supplied section", () => {
    expect(course.id).toBe("google-slide-with-ai");
    expect(course.title).toBe("Google Slide with AI");
    expect(lessons.map((lesson) => lesson.title)).toEqual([
      "Why Do Slide Presentations Need AI?",
      "Introduction to Gemini in Google Slides",
      "How to Navigate the Rest of This Course",
      "Creating: Generating Presentations and Slides",
      "Enhancing: Refining Text and Visuals in Your Slides",
      "Consuming: Summarizing and Taking Action",
      "Conclusion",
      "Build Slides Fast with Gemini",
      "Gemini Slide Summaries",
      "Presentation Scripts with Gemini",
      "Presentations in Seconds with Nano Banana Pro",
    ]);
  });

  it("keeps every lesson to three illustrated steps plus a takeaway", () => {
    for (const lesson of lessons) {
      expect(lesson.screens).toHaveLength(4);
      for (const [index, screen] of lesson.screens.slice(0, 3).entries()) {
        expect(screen.blocks[0]).toMatchObject({ type: "heading" });
        expect(screen.blocks[0].text).toMatch(new RegExp(`^Step ${index + 1}: `));
        expect(screen.blocks[1].type).toBe("paragraph");
        expect(screen.blocks[1].text!.length).toBeLessThanOrEqual(150);
        const images = screen.blocks.filter((block) => block.type === "image");
        expect(images).toHaveLength(1);
        expect(images[0].localSrc).toMatch(/^\/images\/courses\/google-slide-with-ai\/lesson-\d{2}-step-\d{2}\.avif$/);
        expect(existsSync(join(process.cwd(), "public", images[0].localSrc!))).toBe(true);
      }
      const takeaway = lesson.screens.at(-1)!.blocks;
      expect(takeaway[0]).toMatchObject({ type: "heading", text: "Step 4: Takeaway" });
      expect(takeaway.some((block) => block.type === "image")).toBe(false);
      expect(takeaway.at(-1)).toMatchObject({ type: "callout", tone: "copy-prompt" });
      expect(["Ready-to-use prompt", "Decision rule"]).toContain(takeaway.at(-1)?.title);
    }
  });
});
