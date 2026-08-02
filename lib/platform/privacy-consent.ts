export type MarketingConsent = "granted" | "denied" | "unset";

export const META_CONSENT_COOKIE = "coursiv_marketing_consent";
export const META_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

const REGULATED_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CH",
]);

export function normalizeCountryCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

export function countryFromHeaders(headers: Headers) {
  return normalizeCountryCode(
    headers.get("x-vercel-ip-country") ??
      headers.get("cf-ipcountry") ??
      headers.get("x-appengine-country") ??
      headers.get("x-country-code"),
  );
}

export function consentDecision(countryCode: string | null, consent: MarketingConsent) {
  const requiresConsent = !countryCode || REGULATED_COUNTRIES.has(countryCode);
  const marketingAllowed = consent === "granted" || (consent === "unset" && !requiresConsent);
  return {
    countryCode,
    requiresConsent,
    consent,
    marketingAllowed,
    basis: consent !== "unset" ? "explicit" as const : requiresConsent ? "opt-in-required" as const : "regional-default" as const,
  };
}

export function parseConsentCookie(value: string | undefined): MarketingConsent {
  return value === "granted" || value === "denied" ? value : "unset";
}
