import type { AdminUserSummary, SubscriptionStatus } from "./types";

export type AdminUserFilters = {
  query: string;
  subscriptionStatus: SubscriptionStatus | "all";
  accountStatus: AdminUserSummary["accountStatus"] | "all";
  registeredFrom: string;
  registeredTo: string;
  tag: string;
};

export const emptyAdminUserFilters: AdminUserFilters = {
  query: "",
  subscriptionStatus: "all",
  accountStatus: "all",
  registeredFrom: "",
  registeredTo: "",
  tag: "",
};

export function normalizeAdminUserSearch(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildAdminUserSearchIndex(user: Pick<AdminUserSummary, "id" | "email" | "displayName" | "tags">) {
  const values = [user.id, user.email, user.displayName, ...user.tags]
    .flatMap((value) => {
      const normalized = normalizeAdminUserSearch(value);
      return [normalized, ...normalized.split(/[^\p{L}\p{N}]+/u)];
    })
    .filter(Boolean);
  const prefixes = new Set<string>();
  for (const value of values) {
    for (let length = 1; length <= Math.min(value.length, 80); length += 1) prefixes.add(value.slice(0, length));
  }
  return {
    searchPrefixes: [...prefixes],
    tagsLower: [...new Set(user.tags.map(normalizeAdminUserSearch).filter(Boolean))],
  };
}

function time(value: string, endOfDay = false) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function matchesAdminUserFilters(user: AdminUserSummary, filters: AdminUserFilters) {
  const query = normalizeAdminUserSearch(filters.query);
  const tag = normalizeAdminUserSearch(filters.tag);
  const registered = time(user.registeredAt);
  const from = time(filters.registeredFrom);
  const to = time(filters.registeredTo, true);
  if (query && !normalizeAdminUserSearch(`${user.displayName} ${user.email} ${user.id}`).includes(query)) return false;
  if (filters.subscriptionStatus !== "all" && user.subscriptionStatus !== filters.subscriptionStatus) return false;
  if (filters.accountStatus !== "all" && user.accountStatus !== filters.accountStatus) return false;
  if (tag && !user.tags.some((item) => normalizeAdminUserSearch(item) === tag)) return false;
  if (from !== null && (registered === null || registered < from)) return false;
  if (to !== null && (registered === null || registered > to)) return false;
  return true;
}
