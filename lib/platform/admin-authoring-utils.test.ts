import { describe, expect, it } from "vitest";
import { cmsAuthorSlug } from "./admin-authoring-utils";

describe("CMS authoring slugs", () => {
  it("keeps readable Latin slugs", () => {
    expect(cmsAuthorSlug("Tax Research & Review", "lesson", () => "unused")).toBe("tax-research-review");
  });

  it("creates distinct safe fallbacks for non-Latin titles", () => {
    expect(cmsAuthorSlug("人工智能入門", "course", () => "ABCDEF12-3456")).toBe("course-abcdef12");
    expect(cmsAuthorSlug("第二課", "lesson", () => "87654321-abcd")).toBe("lesson-87654321");
  });

  it("does not rewrite an intentional Lesson title", () => {
    expect(cmsAuthorSlug("Lesson", "lesson", () => "unused")).toBe("lesson");
  });
});
