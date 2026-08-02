import { describe, expect, it } from "vitest";
import { shouldSendTicketEmail } from "./admin-ticket-policy";

const configured = {
  debug: false,
  firebaseConfigured: true,
  internal: false,
  apiKey: "resend-key",
  fromEmail: "support@example.com",
  recipientEmail: "member@example.com",
};

describe("admin ticket delivery policy", () => {
  it("allows configured production replies", () => {
    expect(shouldSendTicketEmail(configured)).toBe(true);
  });

  it("never sends external email from debug or internal-note flows", () => {
    expect(shouldSendTicketEmail({ ...configured, debug: true })).toBe(false);
    expect(shouldSendTicketEmail({ ...configured, internal: true })).toBe(false);
    expect(shouldSendTicketEmail({ ...configured, firebaseConfigured: false })).toBe(false);
  });
});
