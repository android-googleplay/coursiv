import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  OnboardingFunnel,
  OnboardingFunnelManifest,
  OnboardingFunnelPage,
} from "@/lib/onboarding-funnel";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/platform/firebase-admin";

const onboardingRoot = join(process.cwd(), "content", "coursiv", "onboarding");

export async function readJsonOnboardingFunnel(): Promise<OnboardingFunnel> {
  const manifest = JSON.parse(
    await readFile(join(onboardingRoot, "manifest.json"), "utf8"),
  ) as OnboardingFunnelManifest;
  const pages = await Promise.all(
    manifest.pages.map(async (entry) => {
      const page = JSON.parse(
        await readFile(join(onboardingRoot, entry.file), "utf8"),
      ) as OnboardingFunnelPage;
      return { ...page, version: page.version ?? 1 };
    }),
  );
  return { manifest, pages: pages.sort((left, right) => left.index - right.index) };
}

function configuredOnboardingSource() {
  const explicit = process.env.ONBOARDING_SOURCE?.toLowerCase();
  if (explicit === "firestore" || explicit === "json") return explicit;
  return process.env.CONTENT_SOURCE?.toLowerCase() === "firestore" ? "firestore" : "json";
}

export async function readRuntimeOnboardingFunnel(): Promise<OnboardingFunnel> {
  const baseline = await readJsonOnboardingFunnel();
  if (configuredOnboardingSource() !== "firestore") return baseline;
  if (!isFirebaseAdminConfigured()) {
    throw new Error("ONBOARDING_SOURCE=firestore requires Firebase Admin credentials");
  }
  const snapshot = await getAdminDb()
    .collection("onboardingFunnels")
    .doc("c-1185")
    .collection("pages")
    .get();
  if (snapshot.empty) return baseline;
  const overrides = new Map(
    snapshot.docs.map((document) => [
      document.id,
      document.data() as OnboardingFunnelPage,
    ]),
  );
  return {
    manifest: baseline.manifest,
    pages: baseline.pages
      .map((page) => overrides.get(page.id) ?? page)
      .sort((left, right) => left.index - right.index),
  };
}

export async function readOnboardingFunnelPage(routeParts: string[] = []) {
  const funnel = await readRuntimeOnboardingFunnel();
  const path = routeParts.length ? `/dynamic/${routeParts.join("/")}` : "/dynamic";
  return {
    ...funnel,
    initialIndex: Math.max(0, funnel.pages.findIndex((page) => page.path === path)),
  };
}
