import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";

export type AdminAuditInput = {
  action: string;
  targetType: string;
  targetId: string;
  request: Request;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

function compact(value: unknown) {
  if (value === undefined) return undefined;
  const json = JSON.stringify(value);
  return json.length > 12_000 ? { truncated: true, bytes: json.length, sha256: createHash("sha256").update(json).digest("hex") } : value;
}

export function createAdminAuditRecord(actor: StaffActor, input: AdminAuditInput) {
  const forwarded = input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return {
    id: randomUUID(),
    actorId: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason ?? null,
    before: compact(input.before) ?? null,
    after: compact(input.after) ?? null,
    requestId: input.request.headers.get("x-request-id") ?? randomUUID(),
    ipHash: forwarded ? createHash("sha256").update(`${process.env.AUDIT_IP_SALT ?? "coursiv"}:${forwarded}`).digest("hex") : null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 730 * 86_400_000),
  };
}

export async function writeAdminAudit(actor: StaffActor, input: AdminAuditInput) {
  if (actor.debug || !isFirebaseAdminConfigured()) return;
  const record = createAdminAuditRecord(actor, input);
  await getAdminDb().collection("adminAuditLogs").doc(record.id).create(record);
}
