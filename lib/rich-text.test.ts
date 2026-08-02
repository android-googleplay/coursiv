import { describe, expect, it } from "vitest";
import type { CoursivLesson } from "./coursiv-content";
import {
  richTextEditorHtml,
  richTextInlineHtml,
  richTextPlainText,
  sanitizeLessonRichText,
  sanitizeRichText,
} from "./rich-text";

describe("CMS rich text contract", () => {
  it("keeps supported formatting and makes links safe", () => {
    const result = sanitizeRichText(
      '<p><b>Bold</b> <i>italic</i> <u>underlined</u> <a href="https://example.com">source</a></p><ul><li>One</li></ul>',
    );
    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<u>underlined</u>");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('rel="noreferrer noopener"');
    expect(result).toContain("<ul><li>One</li></ul>");
  });

  it("removes scripts, event handlers, inline styles and unsafe links", () => {
    const result = sanitizeRichText(
      '<p style="color:red" onclick="steal()">Safe<script>alert(1)</script><a href="javascript:alert(2)">link</a></p>',
    );
    expect(result).toBe('<p>Safe<a target="_blank" rel="noreferrer noopener">link</a></p>');
  });

  it("turns plain and legacy inline content into editor-ready HTML without exposing tags", () => {
    expect(richTextEditorHtml("First line\n\nSecond & final")).toBe(
      "<p>First line</p><p>Second &amp; final</p>",
    );
    expect(richTextEditorHtml("<b>Title\n\nDetails</b>")).toBe(
      "<strong>Title<br><br>Details</strong>",
    );
    expect(richTextPlainText("<ul><li>First</li><li>Second</li></ul>")).toBe(
      "First Second",
    );
    expect(richTextInlineHtml("<p>Prompting <b>Fundamentals</b></p>")).toBe(
      "Prompting <strong>Fundamentals</strong>",
    );
  });

  it("sanitizes all rich fields and rebuilds the compatibility block list", () => {
    const lesson: CoursivLesson = {
      schemaVersion: 3,
      sourceId: "lesson",
      sourceUnitId: "unit",
      sourceGuideId: "guide",
      slug: "safe-content",
      title: "Safe content",
      order: 0,
      readUrl: "",
      hasAudio: false,
      raw: {},
      blocks: [],
      screens: [
        {
          id: "screen",
          sourcePageId: "page",
          order: 0,
          type: "content",
          presentation: "content",
          interactionPolicy: "read",
          blocks: [
            {
              id: "heading",
              type: "heading",
              text: 'Visible <b>heading</b><script>hidden()</script>',
              level: 2,
            },
            {
              id: "paragraph",
              type: "paragraph",
              text: '<p onclick="bad()">Visible</p><script>hidden()</script>',
            },
            {
              id: "question",
              type: "single-choice",
              question: '<p onclick="bad()">Choose <i>one</i></p>',
              options: [
                { id: "yes", label: "Yes", isCorrect: true },
                { id: "no", label: "No", isCorrect: false },
              ],
              feedbackCorrect: { text: "<b>Correct</b><iframe src=x></iframe>" },
            },
          ],
        },
      ],
    };
    const result = sanitizeLessonRichText(lesson);
    expect(result.screens[0].blocks[0]).toMatchObject({
      text: "Visible <strong>heading</strong>",
    });
    expect(result.screens[0].blocks[1]).toMatchObject({
      text: "<p>Visible</p>",
    });
    expect(result.screens[0].blocks[2]).toMatchObject({
      question: "<p>Choose <em>one</em></p>",
      feedbackCorrect: { text: "<strong>Correct</strong>" },
    });
    expect(result.blocks).toEqual(result.screens[0].blocks);
  });
});
