import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const course = JSON.parse(readFileSync(join(process.cwd(), "content/coursiv/courses/google-sheet-with-ai-shorts.json"), "utf8"));

describe("Google Sheet with AI Shorts course", () => {
  type Block = { type: string; src?: string; text?: string; tone?: string };
  type Lesson = { title: string; screens: Array<{ presentation: string; blocks: Block[] }> };
  const lessons: Lesson[] = course.units.flatMap((unit: { lessons: Lesson[] }) => unit.lessons);

  it("contains the four supplied Shorts as separate lessons", () => {
    expect(course.id).toBe("google-sheet-with-ai-shorts");
    expect(course.title).toBe("Google Sheet with AI (Shorts)");
    expect(lessons.map((lesson) => lesson.title)).toEqual([
      "Use Gemini in Google Sheets",
      "Work Smarter in Google Sheets",
      "Create a Table with One Prompt",
      "Build a Google Sheets Agent with WhatsApp, ChatGPT and n8n",
    ]);
  });

  it("gives every lesson one local video and one copyable prompt", () => {
    for (const lesson of lessons) {
      expect(lesson.screens).toHaveLength(1);
      expect(lesson.screens[0].presentation).toBe("media");
      const video = lesson.screens[0].blocks.find((block) => block.type === "video");
      const prompt = lesson.screens[0].blocks.find((block) => block.type === "callout");
      expect(video?.src).toMatch(/^\/shorts\/google-sheet-with-ai\/[a-z0-9-]+\.mp4$/);
      expect(existsSync(join(process.cwd(), "public", video!.src!))).toBe(true);
      expect(prompt).toMatchObject({ type: "callout", tone: "copy-prompt" });
      expect(prompt?.text?.length).toBeGreaterThan(80);
    }
  });
});
