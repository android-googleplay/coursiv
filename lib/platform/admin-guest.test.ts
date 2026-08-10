import { describe, expect, it } from "vitest";
import { GUEST_ADMIN_SESSION_VALUE, guestAdminEnabled } from "./admin-guest";

describe("guest admin session", () => {
  it("is enabled only by an explicit true value", () => {
    expect(guestAdminEnabled("true")).toBe(true);
    expect(guestAdminEnabled("false")).toBe(false);
    expect(guestAdminEnabled(undefined)).toBe(false);
  });

  it("uses a stable cookie sentinel", () => {
    expect(GUEST_ADMIN_SESSION_VALUE).toBe("coursiv-public-guest-admin-v1");
  });
});
