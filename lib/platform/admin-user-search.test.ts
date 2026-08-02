import { describe, expect, it } from "vitest";
import type { AdminUserSummary } from "./types";
import { buildAdminUserSearchIndex, emptyAdminUserFilters, matchesAdminUserFilters } from "./admin-user-search";

const user: AdminUserSummary = {
  id: "user-amy-01",
  email: "Amy.Chen@example.com",
  displayName: "Amy Chén",
  registeredAt: "2026-07-18T12:00:00.000Z",
  lastActiveAt: "2026-07-21T12:00:00.000Z",
  onboardingCompleted: true,
  subscriptionStatus: "active",
  currentPeriodEnd: null,
  certificateCount: 2,
  completedLessonCount: 18,
  openTicketCount: 1,
  accountStatus: "active",
  tags: ["VIP", "Billing follow-up"],
};

describe("admin user search", () => {
  it("builds case and accent-insensitive prefixes without duplicates", () => {
    const index = buildAdminUserSearchIndex(user);
    expect(index.searchPrefixes).toContain("amy ch");
    expect(index.searchPrefixes).toContain("amy.chen@");
    expect(index.searchPrefixes).toContain("example");
    expect(index.searchPrefixes).toContain("user-amy");
    expect(index.tagsLower).toEqual(["vip", "billing follow-up"]);
    expect(new Set(index.searchPrefixes).size).toBe(index.searchPrefixes.length);
  });

  it("matches combined status, tag and registration filters", () => {
    expect(matchesAdminUserFilters(user, {
      ...emptyAdminUserFilters,
      query: "chén@example",
      subscriptionStatus: "active",
      accountStatus: "active",
      registeredFrom: "2026-07-01",
      registeredTo: "2026-07-31",
      tag: "vip",
    })).toBe(true);
    expect(matchesAdminUserFilters(user, { ...emptyAdminUserFilters, subscriptionStatus: "past_due" })).toBe(false);
    expect(matchesAdminUserFilters(user, { ...emptyAdminUserFilters, registeredFrom: "2026-07-19" })).toBe(false);
  });
});
