import type { IssuedCertificate } from "@/lib/platform/types";

export const demoCertificates: IssuedCertificate[] = [
  { id:"cert-chatgpt-demo", credentialId:"LMR-CHGPT-7KGYRKF5", userId:"demo-hj", recipientEmail:"hj@lumora.demo", learnerName:"HJ", courseId:"chatgpt", courseTitle:"ChatGPT", courseHours:6, issuedAt:"2026-07-20T12:00:00.000Z", visibility:"public", emailStatus:"sent", emailId:"demo-email-1" },
  { id:"cert-claude-demo", credentialId:"LMR-CLAUDE-4P9TX2QK", userId:"demo-hj", recipientEmail:"hj@lumora.demo", learnerName:"HJ", courseId:"claude", courseTitle:"Claude", courseHours:5, issuedAt:"2026-07-18T12:00:00.000Z", visibility:"public", emailStatus:"sent", emailId:"demo-email-2" },
  { id:"cert-jasper-demo", credentialId:"LMR-JASPER-8N5KQ3DL", userId:"demo-hj", recipientEmail:"hj@lumora.demo", learnerName:"HJ", courseId:"jasper", courseTitle:"Jasper AI", courseHours:5, issuedAt:"2026-07-16T12:00:00.000Z", visibility:"public", emailStatus:"sent", emailId:"demo-email-3" },
];

export function getDemoCertificate(id: string) {
  return demoCertificates.find((certificate) => certificate.id === id || certificate.credentialId === id) ?? null;
}
