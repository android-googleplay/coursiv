import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { POST } from "./route";

describe("worksheet PDF API", () => {
  it("rejects malformed and oversized requests", async () => {
    const malformed = await POST(new Request("http://local/api/worksheets/pdf", { method: "POST", body: "{" }));
    expect(malformed.status).toBe(400);
    const oversized = await POST(new Request("http://local/api/worksheets/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: "logic", questionCount: 41, questionsPerPage: 4 }),
    }));
    expect(oversized.status).toBe(400);
  });

  it("returns an A4 PDF with optional answer page", async () => {
    const response = await POST(new Request("http://local/api/worksheets/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: "chinese",
        level: "k2",
        questionCount: 2,
        questionsPerPage: 2,
        includeAnswers: true,
        locale: "zh-HK",
        seed: 88,
      }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const document = await PDFDocument.load(await response.arrayBuffer());
    expect(document.getPageCount()).toBe(2);
    const size = document.getPage(0).getSize();
    expect(size.width).toBeCloseTo(595.28, 1);
    expect(size.height).toBeCloseTo(841.89, 1);
  }, 20_000);
});

