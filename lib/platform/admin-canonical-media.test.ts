import { describe, expect, it } from "vitest";
import type { CoursivCourse } from "../coursiv-content";
import { collectCanonicalMediaAssets, mergeMediaAssets } from "./admin-canonical-media";

const course = {
  id: "course-1",
  title: "Course One",
  units: [{
    lessons: [{
      slug: "lesson-one",
      title: "Lesson One",
      screens: [
        { id: "screen-1", blocks: [{ id: "image-1", type: "image", src: "https://example.com/a.webp", localSrc: "/coursiv-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp", alt: "" }] },
        { id: "screen-2", blocks: [{ id: "video-1", type: "video", src: "https://example.com/demo.mp4" }] },
        { id: "screen-3", blocks: [{ id: "image-2", type: "image", src: "https://example.com/a.webp", localSrc: "/coursiv-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp", alt: "" }] },
      ],
    }],
  }],
} as unknown as CoursivCourse;

describe("canonical media inventory", () => {
  it("turns existing lesson media into searchable reusable assets", () => {
    const assets = collectCanonicalMediaAssets([course], "2026-07-22T00:00:00.000Z");
    expect(assets).toHaveLength(2);
    expect(assets.map((asset) => asset.mimeType).sort()).toEqual(["image/webp", "video/mp4"]);
    expect(assets[0].name).toContain("Screen 1 — Lesson One · Course One");
    expect(assets.find((asset) => asset.mimeType === "image/webp")?.usagePaths).toHaveLength(2);
  });

  it("merges uploaded metadata without losing canonical usage", () => {
    const [canonical] = collectCanonicalMediaAssets([course]);
    const [merged] = mergeMediaAssets([canonical], [{ ...canonical, name: "Friendly name.webp", uploadedBy: "editor-1", usagePaths: [] }]);
    expect(merged.name).toBe("Friendly name.webp");
    expect(merged.usagePaths).toEqual(canonical.usagePaths);
  });
});
