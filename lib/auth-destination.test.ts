import { describe, expect, it } from "vitest";
import { isAdminDestination, safeAuthDestination } from "./auth-destination";

describe("auth destination", () => {
  it("preserves an internal CMS destination", () => {
    expect(safeAuthDestination("/admin/content")).toBe("/admin/content");
    expect(isAdminDestination("/admin/content")).toBe(true);
  });

  it("rejects external and malformed destinations", () => {
    expect(safeAuthDestination("https://example.com/admin")).toBe("/dashboard");
    expect(safeAuthDestination("//example.com/admin")).toBe("/dashboard");
    expect(safeAuthDestination("/\\example.com/admin")).toBe("/dashboard");
  });

  it("does not mistake a similarly named learner route for admin", () => {
    expect(isAdminDestination("/administrator-course")).toBe(false);
  });
});
