import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getStaffActor, isDebugStaffRequest, sessionCookie } from "@/lib/platform/admin-auth";
import { getAdminAuth, verifyBearerToken } from "@/lib/platform/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  return actor ? NextResponse.json({ actor }) : NextResponse.json({ error: "Staff access required" }, { status: 401 });
}

export async function POST(request: Request) {
  if (isDebugStaffRequest(request)) return NextResponse.json({ actor: await getStaffActor(request) });
  const decoded = await verifyBearerToken(request);
  const role = decoded?.admin === true ? "admin" : decoded?.staffRole;
  if (!decoded || !["admin", "editor", "support", "analyst"].includes(String(role))) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  const token = request.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
  const cookie = await getAdminAuth().createSessionCookie(token, { expiresIn: 8 * 60 * 60 * 1000 });
  return NextResponse.json({ actor: { uid: decoded.uid, email: decoded.email ?? null, role } }, { headers: { "Set-Cookie": sessionCookie(cookie) } });
}

export async function DELETE() {
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
}
