export const META_EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "Lead",
  "CompleteRegistration",
  "InitiateCheckout",
  "Purchase",
] as const;

export type MetaEventName = (typeof META_EVENT_NAMES)[number];

export type MetaAttribution = {
  anonymousId: string;
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmMedium?: string;
  utmTerm?: string;
  landingUrl?: string;
  firstSeenAt?: string;
};

const SAFE_TEXT = /[^a-zA-Z0-9 _.:/@+\-=]/g;

function limited(value: unknown, maximum: number, allowUrl = false) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maximum);
  if (!trimmed) return undefined;
  if (allowUrl) {
    try {
      const url = new URL(trimmed);
      if (!['http:', 'https:'].includes(url.protocol)) return undefined;
      url.username = "";
      url.password = "";
      return url.toString().slice(0, maximum);
    } catch {
      return undefined;
    }
  }
  return trimmed.replace(SAFE_TEXT, "").slice(0, maximum) || undefined;
}

export function sanitizeEventId(value: unknown) {
  return limited(value, 100)?.replace(/[^a-zA-Z0-9_-]/g, "") || undefined;
}

export function sanitizeMetaAttribution(value: unknown): MetaAttribution {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    anonymousId: limited(source.anonymousId, 100) ?? "",
    fbclid: limited(source.fbclid, 250),
    fbp: limited(source.fbp, 250),
    fbc: limited(source.fbc, 250),
    utmSource: limited(source.utmSource, 100),
    utmCampaign: limited(source.utmCampaign, 150),
    utmContent: limited(source.utmContent, 150),
    utmMedium: limited(source.utmMedium, 100),
    utmTerm: limited(source.utmTerm, 150),
    landingUrl: limited(source.landingUrl, 500, true),
    firstSeenAt: limited(source.firstSeenAt, 40),
  };
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

export async function sha256Hex(value: string) {
  const normalized = value.trim().toLowerCase();
  if (typeof window !== "undefined" && globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(normalized);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(normalized).digest("hex");
}

export function metaEventName(value: unknown): MetaEventName | null {
  return typeof value === "string" && (META_EVENT_NAMES as readonly string[]).includes(value)
    ? value as MetaEventName
    : null;
}
