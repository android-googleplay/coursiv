export const GUEST_ADMIN_SESSION_VALUE = "coursiv-public-guest-admin-v1";

export function guestAdminEnabled(value = process.env.COURSIV_GUEST_ADMIN_ENABLED) {
  return value === "true";
}

export function isGuestAdminSession(value: string | null) {
  return guestAdminEnabled() && value === GUEST_ADMIN_SESSION_VALUE;
}
