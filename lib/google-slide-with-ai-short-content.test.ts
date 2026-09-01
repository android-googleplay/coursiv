import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const course = JSON.parse(readFileSync(join(process.cwd(), "content/coursiv/courses/google-slide-with-ai-short.json"), "utf8"));

describe("Google Slide with AI Short video course", () => {
  type Block = { type: string; src?: string; text?: string; tone?: string };
  type Lesson = { title: string; screens: Array<{ presentation: string; blocks: Block[] }> };
  const lessons: Lesson[] = course.units.flatMap((unit: { lessons: Lesson[] }) => unit.lessons);

  it("contains the three supplied videos as separate lessons", () => {
    expect(course.id).toBe("google-slide-with-ai-short");
    expect(course.title).toBe("Google Slide with AI (Short)");
    expect(lessons.map((lesson) => lesson.title)).toEqual([
      "How to Use Gemini in Google Slides",
      "Create Stunning Presentations in Minutes",
      "Create Faster, Work Smarter, Visualize Everything",
    ]);
  });

  it("gives every lesson one local video and one copyable prompt", () => {
    for (const lesson of lessons) {
      expect(lesson.screens).toHaveLength(1);
      expect(lesson.screens[0].presentation).toBe("media");
      const video = lesson.screens[0].blocks.find((block) => block.type === "video");
      const prompt = lesson.screens[0].blocks.find((block) => block.type === "callout");
      expect(video?.src).toMatch(/^\/shorts\/google-slide-with-ai\/[a-z0-9-]+\.mp4$/);
      expect(existsSync(join(process.cwd(), "public", video!.src!))).toBe(true);
      expect(prompt).toMatchObject({ type: "callout", tone: "copy-prompt" });
      expect(prompt?.text?.length).toBeGreaterThan(80);
    }
  });
});
