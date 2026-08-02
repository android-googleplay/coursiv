import "server-only";
import { Resend } from "resend";
import type { IssuedCertificate } from "./types";

const escapeHtml = (value: string) => value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

export function certificateEmailHtml(certificate: IssuedCertificate, appUrl: string) {
  const certificateUrl = `${appUrl}/certificates/${encodeURIComponent(certificate.id)}`;
  return `<!doctype html><html><body style="margin:0;background:#f6f6f8;font-family:Arial,sans-serif;color:#252551"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:30px 14px"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:0"><div style="height:230px;background:linear-gradient(135deg,#fff0c8,#ffe2a6);position:relative;text-align:center"><div style="padding-top:35px;color:#5a54ff;font-size:28px;font-weight:800">Lumora</div><div style="margin:25px auto 0;width:250px;padding:22px;border:7px solid #ffad19;border-radius:10px;background:#fff;color:#302f55"><strong style="font-family:Georgia,serif;font-size:20px">CERTIFICATE</strong><br><span style="font-size:12px">${escapeHtml(certificate.courseTitle)}</span></div></div></td></tr><tr><td style="padding:30px 34px"><h2 style="margin:0 0 22px;font-size:21px">Hi ${escapeHtml(certificate.learnerName)}!</h2><p style="font-size:16px;line-height:1.55">Your <strong>${escapeHtml(certificate.courseTitle)}</strong> certificate has been issued and is ready to share.</p><p style="font-size:16px;line-height:1.55">Celebrate your progress with colleagues, clients and friends — your verified credential is ready.</p><a href="${certificateUrl}" style="display:block;margin:26px 0;padding:15px;border-radius:7px;background:#5a54ff;color:#fff;text-align:center;text-decoration:none;font-size:16px;font-weight:800">✨ View &amp; Share Certificate ✨</a><p style="font-size:14px;line-height:1.6">Or open Lumora manually: <strong>Profile → Certificates → Share</strong>.</p><p style="margin-top:28px;font-size:14px;line-height:1.5">Cheering you on always,<br><strong>The Lumora Team</strong></p></td></tr></table><p style="color:#999;font-size:11px">Credential ${escapeHtml(certificate.credentialId)}</p></td></tr></table></body></html>`;
}

export async function sendCertificateEmail(certificate: IssuedCertificate, appUrl: string) {
  if (!process.env.RESEND_API_KEY || !process.env.CERTIFICATE_FROM_EMAIL) return { status:"not_configured" as const };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.CERTIFICATE_FROM_EMAIL,
    to: [certificate.recipientEmail],
    subject: `Your ${certificate.courseTitle} certificate is ready — share your win`,
    html: certificateEmailHtml(certificate, appUrl),
    headers: { "X-Entity-Ref-ID": certificate.id },
  });
  if (error) return { status:"failed" as const, error };
  return { status:"sent" as const, emailId:data?.id };
}
