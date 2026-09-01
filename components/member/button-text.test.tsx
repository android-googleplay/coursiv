import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ButtonLanguageProvider, ButtonText, translateButtonText } from "./button-text";

describe("button text language", () => {
  it("keeps English button labels unchanged", () => {
    expect(translateButtonText("Continue learning", "English")).toBe("Continue learning");
    expect(translateButtonText("Read the full law", "English")).toBe("Read the full law");
    expect(translateButtonText("Skip reading and start the quiz", "English")).toBe("Skip reading and start the quiz");
  });

  it("translates exact and dynamic action labels into Traditional Chinese", () => {
    expect(translateButtonText("Continue learning", "繁體中文")).toBe("繼續學習");
    expect(translateButtonText("Read the full law", "繁體中文")).toBe("閱讀完整法例");
    expect(translateButtonText("Skip reading and start the quiz", "繁體中文")).toBe("跳過閱讀，直接開始測驗");
    expect(translateButtonText("Mark day 3 complete", "繁體中文")).toBe("完成第 3 天");
    expect(translateButtonText("Start Notion", "繁體中文")).toBe("開始Notion");
    expect(translateButtonText("3/11 lessons completed · 27%", "繁體中文")).toBe("3/11 課堂已完成 · 27%");
    expect(translateButtonText("Search 40 prompts", "繁體中文")).toBe("搜尋 40 個提示詞");
    expect(translateButtonText("Correct answer", "繁體中文")).toBe("答啱咗");
  });

  it("only changes labels wrapped as button text", () => {
    const html = renderToStaticMarkup(
      <ButtonLanguageProvider language="繁體中文">
        <p>Continue learning</p>
        <button><ButtonText>Continue learning</ButtonText></button>
      </ButtonLanguageProvider>,
    );

    expect(html).toContain("<p>Continue learning</p>");
    expect(html).toContain("<button>繼續學習</button>");
  });
});
