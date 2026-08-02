import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";
import { writeAdminAudit } from "./admin-audit";
import { assertContentSnapshotCollection, CONTENT_SNAPSHOT_COLLECTIONS, type ContentSnapshotCollection } from "./time-machine-boundary";
export { assertContentSnapshotCollection, CONTENT_SNAPSHOT_COLLECTIONS } from "./time-machine-boundary";

export type ContentCheckpointKind = "automatic" | "manual" | "daily" | "pre-restore";
export type ContentCheckpointStatus = "creating" | "ready" | "failed";

export type ContentCheckpoint = {
  id: string;
  kind: ContentCheckpointKind;
  status: ContentCheckpointStatus;
  label: string;
  reason: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  contentVersion: string | null;
  counts: Record<ContentSnapshotCollection, number>;
  checksum: string;
  error?: string;
};

export type ContentRestoreJob = {
  id: string;
  checkpointId: string;
  preRestoreCheckpointId: string;
  status: "running" | "ready" | "failed";
  phase: "snapshot" | "restore" | "verify" | "complete";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  reason: string;
  error?: string;
};

type SnapshotDocument = { collection: ContentSnapshotCollection; documentId: string; data: Record<string, unknown> };
const debugCheckpoints = new Map<string, { checkpoint: ContentCheckpoint; documents: SnapshotDocument[] }>();
const debugJobs = new Map<string, ContentRestoreJob>();
let debugLock: { jobId: string; actorId: string; createdAt: string } | null = null;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function snapshotChecksum(documents: SnapshotDocument[]) {
  const canonical = [...documents].sort((a, b) => a.collection.localeCompare(b.collection) || a.documentId.localeCompare(b.documentId));
  return createHash("sha256").update(stable(canonical)).digest("hex");
}

function checkpointMetadata(value: ContentCheckpoint) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

async function readLiveDocuments(): Promise<SnapshotDocument[]> {
  const database = getAdminDb();
  const output: SnapshotDocument[] = [];
  for (const collection of CONTENT_SNAPSHOT_COLLECTIONS) {
    const snapshot = await database.collection(collection).get();
    for (const document of snapshot.docs) output.push({ collection, documentId: document.id, data: document.data() });
  }
  return output;
}

async function readConsistentLiveDocuments(): Promise<SnapshotDocument[]> {
  const database = getAdminDb();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await database.collection("contentMetadata").doc("learner-app").get();
    const documents = await readLiveDocuments();
    const after = await database.collection("contentMetadata").doc("learner-app").get();
    if ((before.updateTime && after.updateTime && before.updateTime.isEqual(after.updateTime)) || (!before.exists && !after.exists)) return documents;
  }
  throw new Error("Content changed while the checkpoint was being created; retry the operation");
}

function validateSnapshotDocuments(documents: SnapshotDocument[]) {
  for (const document of documents) assertContentSnapshotCollection(document.collection);
  const lessons = new Map(documents.filter((item) => item.collection === "lessons").map((item) => [item.documentId, item.data]));
  const courses = documents.filter((item) => item.collection === "courses");
  for (const course of courses) {
    const summaries = Array.isArray(course.data.lessonSummaries) ? course.data.lessonSummaries as Array<Record<string, unknown>> : [];
    for (const summary of summaries) {
      if (typeof summary.id !== "string") throw new Error(`Course ${course.documentId} contains a lesson summary without an ID`);
      const lesson = lessons.get(summary.id);
      if (!lesson) throw new Error(`Course ${course.documentId} references missing lesson ${summary.id}`);
      if (lesson.courseId !== course.documentId) throw new Error(`Lesson ${summary.id} belongs to the wrong course`);
      if (!Array.isArray(lesson.screens)) throw new Error(`Lesson ${summary.id} has invalid screens`);
    }
  }
}

export async function assertContentMutationsAvailable(actor: StaffActor) {
  if (actor.debug || !isFirebaseAdminConfigured()) {
    if (debugLock) return { ok: false as const, status: 423, error: "Content restore is in progress. Publishing is temporarily locked." };
    return { ok: true as const };
  }
  const lock = await getAdminDb().collection("contentOperations").doc("maintenance-lock").get();
  return lock.exists
    ? { ok: false as const, status: 423, error: "Content restore is in progress. Publishing is temporarily locked." }
    : { ok: true as const };
}

export async function createContentCheckpoint(actor: StaffActor, input: { kind: ContentCheckpointKind; label: string; reason: string }) {
  const id = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID()}`;
  const now = new Date();
  const base: ContentCheckpoint = {
    id,
    kind: input.kind,
    status: "creating",
    label: input.label,
    reason: input.reason,
    createdAt: now.toISOString(),
    createdBy: actor.uid,
    expiresAt: new Date(now.getTime() + 90 * 86_400_000).toISOString(),
    contentVersion: null,
    counts: { courses: 0, lessons: 0, contentMetadata: 0 },
    checksum: "",
  };
  if (actor.debug || !isFirebaseAdminConfigured()) {
    const documents: SnapshotDocument[] = [];
    const checkpoint = { ...base, status: "ready" as const, checksum: snapshotChecksum(documents) };
    debugCheckpoints.set(id, { checkpoint, documents });
    return checkpoint;
  }
  const database = getAdminDb();
  const reference = database.collection("contentCheckpoints").doc(id);
  await reference.create(checkpointMetadata(base));
  try {
    const documents = await readConsistentLiveDocuments();
    validateSnapshotDocuments(documents);
    const counts = { courses: 0, lessons: 0, contentMetadata: 0 };
    for (let offset = 0; offset < documents.length; offset += 400) {
      const batch = database.batch();
      for (const document of documents.slice(offset, offset + 400)) {
        counts[document.collection] += 1;
        batch.create(reference.collection("documents").doc(`${document.collection}__${createHash("sha1").update(document.documentId).digest("hex")}`), document);
      }
      await batch.commit();
    }
    const contentMetadata = documents.find((item) => item.collection === "contentMetadata" && item.documentId === "learner-app");
    const checkpoint: ContentCheckpoint = {
      ...base,
      status: "ready",
      contentVersion: typeof contentMetadata?.data.contentVersion === "string" ? contentMetadata.data.contentVersion : null,
      counts,
      checksum: snapshotChecksum(documents),
    };
    await reference.set(checkpointMetadata(checkpoint));
    return checkpoint;
  } catch (error) {
    await reference.set({ status: "failed", error: error instanceof Error ? error.message : "Snapshot failed" }, { merge: true });
    throw error;
  }
}

export async function listContentCheckpoints(actor: StaffActor, limit = 50) {
  if (actor.debug || !isFirebaseAdminConfigured()) return [...debugCheckpoints.values()].map((item) => item.checkpoint).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  const snapshot = await getAdminDb().collection("contentCheckpoints").orderBy("createdAt", "desc").limit(Math.min(100, Math.max(1, limit))).get();
  return snapshot.docs.map((document) => document.data() as ContentCheckpoint);
}

async function readCheckpointDocuments(actor: StaffActor, checkpointId: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) return debugCheckpoints.get(checkpointId)?.documents ?? null;
  const database = getAdminDb();
  const checkpoint = await database.collection("contentCheckpoints").doc(checkpointId).get();
  if (!checkpoint.exists || checkpoint.data()?.status !== "ready") return null;
  const documents = await checkpoint.ref.collection("documents").get();
  return documents.docs.map((document) => document.data() as SnapshotDocument);
}

export async function previewContentRestore(actor: StaffActor, checkpointId: string) {
  const target = await readCheckpointDocuments(actor, checkpointId);
  if (!target) return { ok: false as const, status: 404, error: "Ready checkpoint not found" };
  const live = actor.debug || !isFirebaseAdminConfigured() ? [] : await readLiveDocuments();
  const key = (item: SnapshotDocument) => `${item.collection}/${item.documentId}`;
  const targetMap = new Map(target.map((item) => [key(item), item]));
  const liveMap = new Map(live.map((item) => [key(item), item]));
  const added = target.filter((item) => !liveMap.has(key(item))).map(key);
  const deleted = live.filter((item) => !targetMap.has(key(item))).map(key);
  const modified = target.filter((item) => {
    const current = liveMap.get(key(item));
    return current && stable(current.data) !== stable(item.data);
  }).map(key);
  return { ok: true as const, checkpointId, counts: { added: added.length, modified: modified.length, deleted: deleted.length }, changes: { added, modified, deleted } };
}

async function setRestoreJob(actor: StaffActor, job: ContentRestoreJob) {
  if (actor.debug || !isFirebaseAdminConfigured()) debugJobs.set(job.id, job);
  else await getAdminDb().collection("contentRestoreJobs").doc(job.id).set(job);
}

export async function getContentRestoreJob(actor: StaffActor, id: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) return debugJobs.get(id) ?? null;
  const snapshot = await getAdminDb().collection("contentRestoreJobs").doc(id).get();
  return snapshot.exists ? snapshot.data() as ContentRestoreJob : null;
}

export async function restoreContentCheckpoint(actor: StaffActor, request: Request, input: { checkpointId: string; reason: string }) {
  const target = await readCheckpointDocuments(actor, input.checkpointId);
  if (!target) return { ok: false as const, status: 404, error: "Ready checkpoint not found" };
  try { validateSnapshotDocuments(target); }
  catch (error) { return { ok: false as const, status: 422, error: error instanceof Error ? error.message : "Checkpoint validation failed" }; }
  const jobId = randomUUID();
  const now = new Date().toISOString();
  let preRestoreCheckpoint: ContentCheckpoint;
  try {
    preRestoreCheckpoint = await createContentCheckpoint(actor, { kind: "pre-restore", label: `Before restore ${input.checkpointId}`, reason: input.reason });
  } catch {
    return { ok: false as const, status: 500, error: "Could not create the mandatory pre-restore checkpoint" };
  }
  let job: ContentRestoreJob = { id: jobId, checkpointId: input.checkpointId, preRestoreCheckpointId: preRestoreCheckpoint.id, status: "running", phase: "restore", createdAt: now, updatedAt: now, createdBy: actor.uid, reason: input.reason };
  await setRestoreJob(actor, job);
  if (actor.debug || !isFirebaseAdminConfigured()) {
    debugLock = { jobId, actorId: actor.uid, createdAt: now };
    job = { ...job, status: "ready", phase: "complete", updatedAt: new Date().toISOString() };
    debugLock = null;
    await setRestoreJob(actor, job);
    return { ok: true as const, job };
  }
  const database = getAdminDb();
  const lockReference = database.collection("contentOperations").doc("maintenance-lock");
  try {
    await database.runTransaction(async (transaction) => {
      const existing = await transaction.get(lockReference);
      if (existing.exists) {
        const existingJobId = String(existing.data()?.jobId ?? "");
        const existingJob = existingJobId ? await transaction.get(database.collection("contentRestoreJobs").doc(existingJobId)) : null;
        if (existingJob?.data()?.status !== "failed") throw new Error("Another content restore is already running");
      }
      transaction.set(lockReference, { jobId, actorId: actor.uid, createdAt: now });
    });
    const targetMap = new Map(target.map((item) => [`${item.collection}/${item.documentId}`, item]));
    const live = await readLiveDocuments();
    const operations: Array<{ type: "set" | "delete"; document: SnapshotDocument }> = [
      ...target.map((document) => ({ type: "set" as const, document })),
      ...live.filter((document) => !targetMap.has(`${document.collection}/${document.documentId}`)).map((document) => ({ type: "delete" as const, document })),
    ];
    for (let offset = 0; offset < operations.length; offset += 400) {
      const batch = database.batch();
      for (const operation of operations.slice(offset, offset + 400)) {
        assertContentSnapshotCollection(operation.document.collection);
        const reference = database.collection(operation.document.collection).doc(operation.document.documentId);
        if (operation.type === "set") batch.set(reference, operation.document.data);
        else batch.delete(reference);
      }
      await batch.commit();
    }
    job = { ...job, phase: "verify", updatedAt: new Date().toISOString() };
    await setRestoreJob(actor, job);
    const restored = await readLiveDocuments();
    validateSnapshotDocuments(restored);
    if (snapshotChecksum(restored) !== snapshotChecksum(target)) throw new Error("Restored content checksum does not match checkpoint");
    await database.collection("contentMetadata").doc("learner-app").set({ contentVersion: new Date().toISOString(), restoredFromCheckpoint: input.checkpointId, updatedAt: new Date().toISOString() }, { merge: true });
    job = { ...job, status: "ready", phase: "complete", updatedAt: new Date().toISOString() };
    await setRestoreJob(actor, job);
    await lockReference.delete();
    await writeAdminAudit(actor, { action: "content.time_machine.restore", targetType: "contentCheckpoint", targetId: input.checkpointId, request, reason: input.reason, after: { jobId, preRestoreCheckpointId: preRestoreCheckpoint.id } });
    return { ok: true as const, job };
  } catch (error) {
    job = { ...job, status: "failed", updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Restore failed" };
    await setRestoreJob(actor, job);
    return { ok: false as const, status: 500, error: job.error, job };
  }
}

export async function deleteExpiredContentCheckpoints(actor: StaffActor) {
  if (actor.debug || !isFirebaseAdminConfigured()) {
    const now = new Date().toISOString();
    for (const [id, value] of debugCheckpoints) if (value.checkpoint.expiresAt < now) debugCheckpoints.delete(id);
    return;
  }
  const database = getAdminDb();
  const expired = await database.collection("contentCheckpoints").where("expiresAt", "<", new Date().toISOString()).limit(20).get();
  for (const checkpoint of expired.docs) {
    while (true) {
      const documents = await checkpoint.ref.collection("documents").limit(400).get();
      if (documents.empty) break;
      const batch = database.batch();
      documents.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
    await checkpoint.ref.delete();
  }
}
