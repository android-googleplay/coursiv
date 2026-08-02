import "server-only";

import { randomUUID } from "node:crypto";
import {
  applyEditableFields,
  editableFields,
  pageSummary,
  validateOnboardingPage,
  type OnboardingFunnelPage,
  type OnboardingPageEditableFields,
} from "@/lib/onboarding-funnel";
import { readJsonOnboardingFunnel } from "@/lib/onboarding-funnel.server";
import type { StaffActor } from "@/lib/platform/admin-auth";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";

type StoredOnboardingPage = OnboardingFunnelPage & {
  version: number;
  updatedAt: string;
  updatedBy: string;
};

let debugPages: Map<string, StoredOnboardingPage> | null = null;

async function baselinePages() {
  const funnel = await readJsonOnboardingFunnel();
  return funnel.pages.map((page) => ({
    ...page,
    version: page.version ?? 1,
    updatedAt: page.updatedAt ?? funnel.manifest.scrapedAt,
    updatedBy: page.updatedBy ?? "reference-v1 importer",
  }));
}

async function getDebugPages() {
  if (debugPages) return debugPages;
  debugPages = new Map((await baselinePages()).map((page) => [page.id, page]));
  return debugPages;
}

export async function listAdminOnboardingPages(actor: StaffActor) {
  if (actor.debug || !isFirebaseAdminConfigured()) {
    return [...(await getDebugPages()).values()]
      .sort((left, right) => left.index - right.index)
      .map(pageSummary);
  }
  const snapshot = await getAdminDb()
    .collection("onboardingFunnels")
    .doc("c-1185")
    .collection("pages")
    .orderBy("index")
    .get();
  if (snapshot.empty) return (await baselinePages()).map(pageSummary);
  return snapshot.docs.map((document) => pageSummary(document.data() as StoredOnboardingPage));
}

export async function getAdminOnboardingPage(actor: StaffActor, pageId: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) {
    return (await getDebugPages()).get(pageId) ?? null;
  }
  const document = await getAdminDb()
    .collection("onboardingFunnels")
    .doc("c-1185")
    .collection("pages")
    .doc(pageId)
    .get();
  if (document.exists) return document.data() as StoredOnboardingPage;
  return (await baselinePages()).find((page) => page.id === pageId) ?? null;
}

export async function publishAdminOnboardingPage(
  actor: StaffActor,
  input: {
    pageId: string;
    fields: OnboardingPageEditableFields;
    expectedVersion: number;
    changeSummary: string;
  },
) {
  const existing = await getAdminOnboardingPage(actor, input.pageId);
  if (!existing) return { ok: false as const, status: 404, error: "Onboarding page not found." };
  if ((existing.version ?? 1) !== input.expectedVersion) {
    return { ok: false as const, status: 409, error: "This page changed in another editor. Reload before publishing." };
  }
  const next = applyEditableFields(existing, input.fields);
  const errors = validateOnboardingPage(next);
  if (errors.length) return { ok: false as const, status: 400, error: errors.join(" "), errors };

  const now = new Date().toISOString();
  const stored: StoredOnboardingPage = {
    ...next,
    version: input.expectedVersion + 1,
    updatedAt: now,
    updatedBy: actor.email ?? actor.uid,
  };

  if (actor.debug || !isFirebaseAdminConfigured()) {
    (await getDebugPages()).set(stored.id, stored);
    return { ok: true as const, page: stored, debug: true };
  }

  const database = getAdminDb();
  const pageReference = database
    .collection("onboardingFunnels")
    .doc("c-1185")
    .collection("pages")
    .doc(stored.id);
  const revisionReference = database
    .collection("contentRevisions")
    .doc(`onboarding-${stored.id}`)
    .collection("versions")
    .doc(String(stored.version));
  const metadataReference = database.collection("contentMetadata").doc("onboarding");
  const auditReference = database.collection("adminAuditLogs").doc(randomUUID());

  await database.runTransaction(async (transaction) => {
    const currentDocument = await transaction.get(pageReference);
    const currentVersion = currentDocument.exists
      ? Number(currentDocument.data()?.version ?? 1)
      : 1;
    if (currentVersion !== input.expectedVersion) {
      throw Object.assign(new Error("VERSION_CONFLICT"), { status: 409 });
    }
    transaction.set(revisionReference, {
      entityType: "onboarding-page",
      entityId: stored.id,
      version: stored.version,
      snapshot: existing,
      changeSummary: input.changeSummary.trim() || "Updated onboarding copy",
      editorId: actor.uid,
      editorEmail: actor.email,
      createdAt: now,
    });
    transaction.set(pageReference, stored);
    transaction.set(metadataReference, {
      flowId: "c-1185",
      version: stored.version,
      updatedAt: now,
      updatedBy: actor.uid,
    }, { merge: true });
    transaction.set(auditReference, {
      actorId: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "content.onboarding.publish",
      targetType: "onboarding-page",
      targetId: stored.id,
      before: editableFields(existing),
      after: editableFields(stored),
      reason: input.changeSummary.trim() || null,
      createdAt: now,
      expiresAt: new Date(Date.now() + 730 * 86_400_000),
    });
  }).catch((error: Error & { status?: number }) => {
    if (error.message === "VERSION_CONFLICT") {
      throw Object.assign(new Error("This page changed in another editor. Reload before publishing."), { status: 409 });
    }
    throw error;
  });
  return { ok: true as const, page: stored, debug: false };
}
