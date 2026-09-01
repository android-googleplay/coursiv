import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isTransientWelcomeEmailError,
  isWelcomeEmailConfigured,
  sendWelcomeEmail,
  welcomeEmailHtml,
  welcomeEmailText,
  WELCOME_EMAIL_SUBJECT,
  type WelcomeEmailSend,
} from "./welcome-email";

const input = {
  userId: "user-123",
  recipientEmail: "alex@example.com",
  recipientName: "Alex Morgan",
  appUrl: "https://learn.example.com/base",
};

describe("welcome email template", () => {
  it("renders the fixed English subject, escaped first name and absolute onboarding CTA", () => {
    const html = welcomeEmailHtml({ ...input, recipientName:"<Alex> Morgan" });
    const text = welcomeEmailText(input);
    expect(WELCOME_EMAIL_SUBJECT).toBe("Welcome to Coursiv — let’s get started");
    expect(html).toContain("Welcome to Coursiv");
    expect(html).toContain("Hi &lt;Alex&gt;,");
    expect(html).not.toContain("Hi <Alex>,");
    expect(html).toContain('href="https://learn.example.com/onboarding"');
    expect(html).toContain("Start learning");
    expect(text).toContain("Start learning: https://learn.example.com/onboarding");
  });

  it("requires the API key, from address and reply-to address", () => {
    expect(isWelcomeEmailConfigured({ RESEND_API_KEY:"key", WELCOME_FROM_EMAIL:"Coursiv <welcome@example.com>", WELCOME_REPLY_TO_EMAIL:"support@example.com" })).toBe(true);
    expect(isWelcomeEmailConfigured({ RESEND_API_KEY:"key", WELCOME_FROM_EMAIL:"Coursiv <welcome@example.com>" })).toBe(false);
  });
});

describe("welcome email delivery", () => {
  const config = { apiKey:"key", fromEmail:"Coursiv <welcome@example.com>", replyToEmail:"support@example.com" };

  it("sends once with transactional content and a user-scoped idempotency key", async () => {
    const send = vi.fn<WelcomeEmailSend>().mockResolvedValue({ data:{ id:"email-1" }, error:null });
    const result = await sendWelcomeEmail(input, config, send);
    expect(result).toEqual({ status:"sent", attempts:1, emailId:"email-1" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      from:config.fromEmail,
      to:[input.recipientEmail],
      replyTo:config.replyToEmail,
      subject:WELCOME_EMAIL_SUBJECT,
    });
    expect(send.mock.calls[0]?.[1]).toEqual({ idempotencyKey:"welcome-v1/user-123" });
  });

  it("retries one transient provider failure and then succeeds", async () => {
    const send = vi.fn<WelcomeEmailSend>()
      .mockResolvedValueOnce({ data:null, error:{ name:"rate_limit_exceeded", message:"slow down", statusCode:429 } })
      .mockResolvedValueOnce({ data:{ id:"email-2" }, error:null });
    await expect(sendWelcomeEmail(input, config, send)).resolves.toEqual({ status:"sent", attempts:2, emailId:"email-2" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent validation failures", async () => {
    const send = vi.fn<WelcomeEmailSend>().mockResolvedValue({ data:null, error:{ name:"validation_error", message:"bad sender", statusCode:422 } });
    await expect(sendWelcomeEmail(input, config, send)).resolves.toEqual({ status:"failed", attempts:1, errorCode:"validation_error" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(isTransientWelcomeEmailError({ name:"validation_error", statusCode:422 })).toBe(false);
  });

  it("retries a thrown network failure once and records a safe error code", async () => {
    const send = vi.fn<WelcomeEmailSend>().mockRejectedValue(new Error("private provider details"));
    await expect(sendWelcomeEmail(input, config, send)).resolves.toEqual({ status:"failed", attempts:2, errorCode:"error" });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
