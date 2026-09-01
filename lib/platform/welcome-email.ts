import "server-only";

import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions, type ErrorResponse } from "resend";

export const WELCOME_EMAIL_SUBJECT = "Welcome to Coursiv — let’s get started";
export const WELCOME_EMAIL_TEMPLATE_VERSION = 1 as const;

type SendResponse = {
  data: { id: string } | null;
  error: ErrorResponse | null;
};

export type WelcomeEmailSend = (
  payload: CreateEmailOptions,
  options?: CreateEmailRequestOptions,
) => Promise<SendResponse>;

export type WelcomeEmailInput = {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  appUrl: string;
};

export type WelcomeEmailConfig = {
  apiKey: string;
  fromEmail: string;
  replyToEmail: string;
};

export type WelcomeEmailResult =
  | { status: "sent"; attempts: number; emailId: string }
  | { status: "failed"; attempts: number; errorCode: string };

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "there";
}

export function welcomeEmailUrl(appUrl: string) {
  return new URL("/onboarding", appUrl).toString();
}

export function welcomeEmailText(input: Pick<WelcomeEmailInput, "recipientName" | "appUrl">) {
  const name = firstName(input.recipientName);
  const onboardingUrl = welcomeEmailUrl(input.appUrl);
  return [
    `Hi ${name},`,
    "",
    "Welcome to Coursiv. Your account is ready.",
    "Build practical AI skills with short, hands-on lessons designed to help you make progress right away.",
    "",
    `Start learning: ${onboardingUrl}`,
    "",
    "Questions? Reply to this email and our team will help.",
    "",
    "The Coursiv Team",
  ].join("\n");
}

export function welcomeEmailHtml(input: Pick<WelcomeEmailInput, "recipientName" | "appUrl">) {
  const name = escapeHtml(firstName(input.recipientName));
  const onboardingUrl = escapeHtml(welcomeEmailUrl(input.appUrl));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${WELCOME_EMAIL_SUBJECT}</title></head><body style="margin:0;background:#f4f3ff;font-family:Arial,sans-serif;color:#252551"><div style="display:none;max-height:0;overflow:hidden;opacity:0">Your practical AI learning path is ready.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f3ff"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 35px rgba(67,58,180,.12)"><tr><td style="padding:26px 34px;background:linear-gradient(135deg,#5a54ff,#7d77ff);color:#ffffff;font-size:24px;font-weight:800">Coursiv</td></tr><tr><td style="padding:34px"><p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#252551">Hi ${name},</p><h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#252551">Welcome to Coursiv</h1><p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#4c4b6b">Your account is ready. Build practical AI skills with short, hands-on lessons designed to help you make progress right away.</p><p style="margin:0 0 26px;font-size:16px;line-height:1.65;color:#4c4b6b">Start with a quick onboarding so we can shape your learning path.</p><a href="${onboardingUrl}" style="display:block;padding:15px 20px;border-radius:9px;background:#5a54ff;color:#ffffff;text-align:center;text-decoration:none;font-size:16px;font-weight:800">Start learning</a><p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#6b6a82">Questions? Reply to this email and our team will help.</p><p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#4c4b6b">The Coursiv Team</p></td></tr></table><p style="margin:18px 0 0;color:#8b8a9c;font-size:11px">This transactional email was sent because a Coursiv account was created with this address.</p></td></tr></table></body></html>`;
}

export function isWelcomeEmailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.RESEND_API_KEY && env.WELCOME_FROM_EMAIL && env.WELCOME_REPLY_TO_EMAIL);
}

export function welcomeEmailErrorCode(error: unknown) {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    const code = error.name.trim().toLowerCase().replaceAll(/[^a-z0-9_-]/g, "_");
    if (code) return code.slice(0, 80);
  }
  return "network_error";
}

export function isTransientWelcomeEmailError(error: unknown) {
  if (!error || typeof error !== "object") return true;
  const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : null;
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) return true;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  return ["rate_limit_exceeded", "application_error", "internal_server_error", "concurrent_idempotent_requests"].includes(name);
}

export async function sendWelcomeEmail(
  input: WelcomeEmailInput,
  config: WelcomeEmailConfig,
  send?: WelcomeEmailSend,
): Promise<WelcomeEmailResult> {
  const resend = send ? null : new Resend(config.apiKey);
  const sendEmail: WelcomeEmailSend = send ?? resend!.emails.send.bind(resend!.emails);
  const payload: CreateEmailOptions = {
    from: config.fromEmail,
    to: [input.recipientEmail],
    replyTo: config.replyToEmail,
    subject: WELCOME_EMAIL_SUBJECT,
    html: welcomeEmailHtml(input),
    text: welcomeEmailText(input),
    headers: { "X-Entity-Ref-ID": `welcome-v1:${input.userId}` },
    tags: [{ name: "category", value: "welcome" }],
  };
  const options = { idempotencyKey: `welcome-v1/${input.userId}` };
  let attempts = 0;
  let finalError: unknown = null;
  while (attempts < 2) {
    attempts += 1;
    try {
      const result = await sendEmail(payload, options);
      if (!result.error && result.data?.id) return { status: "sent", attempts, emailId: result.data.id };
      finalError = result.error ?? { name: "missing_provider_id", statusCode: null };
      if (!isTransientWelcomeEmailError(finalError)) break;
    } catch (error) {
      finalError = error;
    }
  }
  return { status: "failed", attempts, errorCode: welcomeEmailErrorCode(finalError) };
}
