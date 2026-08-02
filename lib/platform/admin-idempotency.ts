import "server-only";

import { createHash } from "node:crypto";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";
import { assertContentMutationsAvailable, createContentCheckpoint } from "./admin-time-machine-content";

const debugKeys = new Set<string>();

export async function reserveAdminMutation(actor: StaffActor, request: Request, scope: string) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 200) return { ok: false as const, status: 400, error: "A valid Idempotency-Key is required" };
  const fingerprint = createHash("sha256").update(`${actor.uid}:${scope}:${key}`).digest("hex");
  if (actor.debug || !isFirebaseAdminConfigured()) {
    if (debugKeys.has(fingerprint)) return { ok: false as const, status: 409, error: "This mutation was already submitted" };
    debugKeys.add(fingerprint);
    if (scope.startsWith("content.") && !scope.startsWith("content.time_machine.")) {
      const available = await assertContentMutationsAvailable(actor);
      if (!available.ok) return available;
      await createContentCheckpoint(actor, { kind: "automatic", label: `Before ${scope}`, reason: `Automatic checkpoint before ${scope}` });
    }
    return { ok: true as const };
  }
  try {
    await getAdminDb().collection("adminIdempotency").doc(fingerprint).create({
      actorId: actor.uid,
      scope,
      keyHash: createHash("sha256").update(key).digest("hex"),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });
    if (scope.startsWith("content.") && !scope.startsWith("content.time_machine.")) {
      const available = await assertContentMutationsAvailable(actor);
      if (!available.ok) return available;
      await createContentCheckpoint(actor, { kind: "automatic", label: `Before ${scope}`, reason: `Automatic checkpoint before ${scope}` });
    }
    return { ok: true as const };
  } catch (error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (code === "6" || code.toLowerCase().includes("already")) return { ok: false as const, status: 409, error: "This mutation was already submitted" };
    throw error;
  }
}
