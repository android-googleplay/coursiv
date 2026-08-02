import { describe, expect, it } from "vitest";
import { friendlyAuthError, parseFirebaseAction } from "./auth-recovery";

describe("parseFirebaseAction", () => {
  it("accepts supported Firebase actions", () => {
    expect(parseFirebaseAction(new URLSearchParams("mode=resetPassword&oobCode=abc"))).toMatchObject({ mode:"resetPassword", code:"abc", valid:true });
  });
  it("rejects missing codes and unsafe redirects", () => {
    expect(parseFirebaseAction(new URLSearchParams("mode=verifyEmail&continueUrl=https://evil.test"))).toMatchObject({ valid:false, continueUrl:null });
  });
});

describe("friendlyAuthError", () => {
  it("turns expired action codes into a useful message", () => {
    expect(friendlyAuthError({ code:"auth/expired-action-code" })).toContain("expired");
  });
});
