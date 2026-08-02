import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyEditableFields,
  editableFields,
  validateOnboardingPage,
  type OnboardingFunnelManifest,
  type OnboardingFunnelPage,
} from "./onboarding-funnel";

const root = join(process.cwd(), "content", "coursiv", "onboarding");
const manifest = JSON.parse(
  readFileSync(join(root, "manifest.json"), "utf8"),
) as OnboardingFunnelManifest;
const pages = manifest.pages.map((entry) =>
  JSON.parse(readFileSync(join(root, entry.file), "utf8")) as OnboardingFunnelPage);

describe("onboarding funnel corpus", () => {
  it("keeps the complete deterministic 29-page flow", () => {
    expect(pages).toHaveLength(29);
    expect(pages.filter((page) => page.type === "question-page")).toHaveLength(16);
    expect(pages.map((page) => page.index)).toEqual(
      Array.from({ length: 29 }, (_, index) => index),
    );
    expect(pages[0].path).toBe("/dynamic");
    expect(pages.at(-1)?.type).toBe("selling-page");
  });

  it("has valid options and downloaded media", () => {
    for (const page of pages) {
      expect(validateOnboardingPage(page)).toEqual([]);
      for (const media of page.media) {
        expect(existsSync(join(process.cwd(), "public", media.localSrc))).toBe(true);
      }
    }
    expect(pages.reduce((count, page) => count + page.options.length, 0)).toBe(96);
  });

  it("updates editor copy while preserving stable IDs and raw payload", () => {
    const source = pages.find((page) => page.type === "question-page")!;
    const fields = editableFields(source);
    const changed = applyEditableFields(source, {
      ...fields,
      title: "A clearer question",
      options: fields.options.map((option, index) => index
        ? option
        : { ...option, label: "A clearer first choice" }),
    });
    expect(changed.id).toBe(source.id);
    expect(changed.options[0].id).toBe(source.options[0].id);
    expect(changed.options[0].label).toBe("A clearer first choice");
    expect(changed.raw).toEqual(source.raw);
  });

  it("blocks empty and duplicate answer choices", () => {
    const source = pages.find((page) => page.type === "question-page")!;
    const broken = {
      ...source,
      options: source.options.map((option, index) => ({
        ...option,
        id: index < 2 ? "duplicate" : option.id,
        label: index === 0 ? "" : option.label,
      })),
    };
    expect(validateOnboardingPage(broken).join(" ")).toContain("needs a label");
    expect(validateOnboardingPage(broken).join(" ")).toContain("duplicated");
  });
});
