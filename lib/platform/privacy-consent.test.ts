import { describe, expect, it } from "vitest";
import { consentDecision, countryFromHeaders, parseConsentCookie } from "./privacy-consent";

describe("marketing consent region policy", () => {
  it.each(["DE", "FR", "GB", "CH", "NO"])("requires explicit opt-in in %s", (country) => {
    expect(consentDecision(country, "unset")).toMatchObject({ requiresConsent: true, marketingAllowed: false, basis: "opt-in-required" });
    expect(consentDecision(country, "granted").marketingAllowed).toBe(true);
  });

  it("fails closed for unknown regions", () => {
    expect(consentDecision(null, "unset")).toMatchObject({ requiresConsent: true, marketingAllowed: false });
  });

  it("allows a regional default outside regulated regions but honors opt-out", () => {
    expect(consentDecision("HK", "unset")).toMatchObject({ marketingAllowed: true, basis: "regional-default" });
    expect(consentDecision("HK", "denied")).toMatchObject({ marketingAllowed: false, basis: "explicit" });
  });

  it("uses the trusted country header order and rejects placeholders", () => {
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "HK", "cf-ipcountry": "GB" }))).toBe("HK");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(parseConsentCookie("anything-else")).toBe("unset");
  });
});
