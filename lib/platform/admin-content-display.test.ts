import { describe, expect, it } from "vitest";
import { formatCmsUpdatedAt } from "./admin-content-display";

describe("formatCmsUpdatedAt", () => {
  it("describes canonical imports instead of showing 1970", () => {
    expect(formatCmsUpdatedAt("1970-01-01T00:00:00.000Z", "canonical-import")).toBe("Imported baseline");
    expect(formatCmsUpdatedAt("1970-01-01T00:00:00.000Z")).toBe("Imported baseline");
  });

  it("handles missing or invalid dates without leaking Invalid Date", () => {
    expect(formatCmsUpdatedAt()).toBe("No CMS changes yet");
    expect(formatCmsUpdatedAt("not-a-date")).toBe("No CMS changes yet");
  });

  it("formats a real CMS update", () => {
    expect(formatCmsUpdatedAt("2026-07-24T12:30:00.000Z")).toMatch(/24 Jul 2026/);
  });
});
