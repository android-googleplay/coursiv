import { describe, expect, it } from "vitest";
import { isSha256, sanitizeEventId, sanitizeMetaAttribution, sha256Hex } from "./meta-contract";

describe("Meta event contract", () => {
  it("normalizes and hashes email without retaining the raw value", async () => {
    const hash = await sha256Hex("  Learner@Example.COM ");
    expect(hash).toBe("2d985f691975ed96ce710fc7f6272a38c0c6ae910798dfd12c24365ed185bfd4");
    expect(isSha256(hash)).toBe(true);
    expect(hash).not.toContain("learner");
  });

  it("bounds attribution fields and strips unsafe metadata characters", () => {
    const value = sanitizeMetaAttribution({
      anonymousId: "anon<script>",
      utmCampaign: "summer<script>alert(1)</script>",
      landingUrl: "javascript:alert(1)",
      fbc: "x".repeat(500),
    });
    expect(value.anonymousId).toBe("anonscript");
    expect(value.utmCampaign).not.toContain("<");
    expect(value.landingUrl).toBeUndefined();
    expect(value.fbc).toHaveLength(250);
  });

  it("accepts stable event IDs and removes separators that cannot be trusted", () => {
    expect(sanitizeEventId("a75ec2ee-6b8c-4ac1-903e-550cd48a4c02")).toBe("a75ec2ee-6b8c-4ac1-903e-550cd48a4c02");
    expect(sanitizeEventId("lead/<script>id")).toBe("leadscriptid");
  });
});
