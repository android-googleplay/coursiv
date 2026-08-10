import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, verifyBearerToken } from "./firebase-admin";
import { isGuestAdminSession } from "./admin-guest";

export const ADMIN_SESSION_COOKIE = "coursiv_admin_session";
export type StaffRole = "admin" | "editor" | "support" | "analyst";
export type StaffActor = { uid: string; email: string | null; role: StaffRole; debug: boolean; authenticatedAt?: number };

const roleOrder: Record<StaffRole, number> = { analyst: 1, support: 2, editor: 2, admin: 3 };

function localHost(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0];
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

export function isDebugStaffRequest(request: Request) {
  return process.env.NEXT_PUBLIC_COURSIV_DEBUG_ADMIN === "true" && localHost(request);
}

function debugStaffUsesLiveData() {
  return process.env.COURSIV_DEBUG_ADMIN_LIVE === "true";
}

function tokenRole(token: DecodedIdToken): StaffRole | null {
  if (token.admin === true) return "admin";
  if (["admin", "editor", "support", "analyst"].includes(String(token.staffRole))) return token.staffRole as StaffRole;
  if (token.editor === true) return "editor";
  if (token.support === true) return "support";
  if (token.analyst === true) return "analyst";
  return null;
}

function cookieValue(request: Request, name: string) {
  const part = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

export async function getStaffActor(request: Request): Promise<StaffActor | null> {
  if (isDebugStaffRequest(request)) return { uid: "debug-admin", email: "admin@coursiv.local", role: "admin", debug: !debugStaffUsesLiveData(), authenticatedAt: Math.floor(Date.now()/1000) };
  let decoded = await verifyBearerToken(request);
  if (!decoded) {
    const session = cookieValue(request, ADMIN_SESSION_COOKIE);
    if (isGuestAdminSession(session)) return { uid: "guest-admin", email: null, role: "admin", debug: false, authenticatedAt: Math.floor(Date.now()/1000) };
    if (session) {
      try { decoded = await getAdminAuth().verifySessionCookie(session, true); } catch { decoded = null; }
    }
  }
  if (!decoded) return null;
  const role = tokenRole(decoded);
  return role ? { uid: decoded.uid, email: decoded.email ?? null, role, debug: false, authenticatedAt: decoded.auth_time } : null;
}

export async function requireStaff(request: Request, allowed: StaffRole[] = ["admin", "editor", "support", "analyst"]) {
  const actor = await getStaffActor(request);
  return actor && allowed.includes(actor.role) ? actor : null;
}

export function roleAtLeast(role: StaffRole, minimum: StaffRole) {
  return roleOrder[role] >= roleOrder[minimum];
}

export function sessionCookie(value: string, maxAgeSeconds = 60 * 60 * 8) {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}`;
}
