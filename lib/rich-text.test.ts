import { describe, expect, it } from "vitest";
import type { CoursivLesson } from "./coursiv-content";
import {
  richTextEditorHtml,
  richTextFeedbackHtml,
  richTextInlineHtml,
  richTextLegalReferenceHtml,
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
    expect(richTextInlineHtml("中文<br><small>English</small>")).toBe(
      "中文<br /><small>English</small>",
    );
    expect(richTextPlainText("中文<br><small>English</small>")).toBe("中文 English");
  });

  it("adds sparse, scan-friendly emphasis to correct and incorrect feedback", () => {
    const explanation = "未中。答案係 D。《基本法》第 7 條嘅相關規定係：「香港特別行政區境內的土地和自然資源屬於國家所有，由香港特別行政區政府負責管理、使用、開發、出租或批給個人、法人或團體使用或開發，其收入全歸香港特別行政區政府支配」。由此可見，題目所問嘅正確結論係「不需上繳中央」。";
    const result = richTextFeedbackHtml(explanation, ["不需上繳中央"]);
    expect(result).toContain("<strong>答案係 D</strong>");
    expect(result).toContain("<strong>《基本法》第 7 條</strong>");
    expect(result).toContain("<strong>香港特別行政區境內的土地和自然資源屬於國家所有</strong>");
    expect(result).toContain("<strong>由香港特別行政區政府負責管理、使用、開發、出租或批給個人、法人或團體使用或開發</strong>");
    expect(result).toContain("<strong>其收入全歸香港特別行政區政府支配</strong>");
    expect(result).toContain("「<strong>不需上繳中央</strong>」");
  });

  it("preserves authored strong text without nesting emphasis", () => {
    expect(richTextFeedbackHtml("<p><strong>已加粗答案係 A</strong>，依據《基本法》第 1 條。</p>")).toBe(
      "<p><strong>已加粗答案係 A</strong>，依據<strong>《基本法》第 1 條</strong>。</p>",
    );
  });

  it("adds sparse emphasis to the approved Basic Law examples", () => {
    const article8 = richTextLegalReferenceHtml("香港原有法律，即普通法、衡平法、條例、附屬立法和習慣法，除同本法相抵觸或經香港特別行政區的立法機關作出修改者外，予以保留。");
    const article9 = richTextLegalReferenceHtml("香港特別行政區的行政機關、立法機關和司法機關，除使用中文外，還可使用英文，英文也是正式語文。");
    const article10 = richTextLegalReferenceHtml("香港特別行政區除懸掛中華人民共和國國旗和國徽外，還可使用香港特別行政區區旗和區徽。 香港特別行政區的區旗是五星花蕊的紫荊花紅旗。 香港特別行政區的區徽，中間是五星花蕊的紫荊花，周圍寫有“中華人民共和國香港特別行政區”和英文“香港”。");

    expect(article8).toContain("<strong>除同本法相抵觸或經香港特別行政區的立法機關作出修改者外，予以保留</strong>");
    expect(article9).toContain("<strong>除使用中文外，還可使用英文，英文也是正式語文</strong>");
    expect(article10).toContain("<strong>除懸掛中華人民共和國國旗和國徽外，還可使用香港特別行政區區旗和區徽</strong>");
    expect(article10).toContain("<strong>香港特別行政區的區旗是五星花蕊的紫荊花紅旗</strong>");
    expect(article10).toContain("英文<strong>“香港”</strong>");
  });

  it("never cuts through a legal subject, negation, or operative predicate", () => {
    expect(richTextLegalReferenceHtml("香港特別行政區是中華人民共和國不可分離的部分。")).toBe(
      "<strong>香港特別行政區是中華人民共和國不可分離的部分</strong>。",
    );
    expect(richTextLegalReferenceHtml("香港特別行政區的行政機關和立法機關由香港永久性居民依照本法有關規定組成。")).toBe(
      "香港特別行政區的行政機關和立法機關<strong>由香港永久性居民依照本法有關規定組成</strong>。",
    );
    expect(richTextLegalReferenceHtml("中央人民政府負責管理與香港特別行政區有關的外交事務。")).toBe(
      "中央人民政府<strong>負責管理與香港特別行政區有關的外交事務</strong>。",
    );
    expect(richTextLegalReferenceHtml("香港居民在法律面前一律平等。")).toBe(
      "香港居民<strong>在法律面前一律平等</strong>。",
    );
  });

  it("keeps the complete equality predicate together in Basic Law Article 25", () => {
    expect(richTextLegalReferenceHtml("香港居民在法律面前一律平等。")).toBe(
      "香港居民<strong>在法律面前一律平等</strong>。",
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
                { id: "yes", label: 'Yes<br><small onclick="bad()">English</small>', isCorrect: true },
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
      options: [
        { id: "yes", label: "Yes<br /><small>English</small>", isCorrect: true },
        { id: "no", label: "No", isCorrect: false },
      ],
      feedbackCorrect: { text: "<strong>Correct</strong>" },
    });
    expect(result.blocks).toEqual(result.screens[0].blocks);
  });
});
