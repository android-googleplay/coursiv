import { NextResponse } from "next/server";
import { eligibleCertificateDefinitionsFromContent } from "@/lib/certificate-eligibility.server";
import { sendCertificateEmail } from "@/lib/platform/certificate-email";
import { readAuthoritativeLearningState } from "@/lib/platform/authoritative-learning";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { listCertificateRecords } from "@/lib/platform/certificate-store";
import type { IssuedCertificate } from "@/lib/platform/types";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";

export const runtime = "nodejs";

function credentialCode(courseId: string) {
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `LMR-${courseId.replaceAll(/[^a-z0-9]/gi, "").slice(0, 7).toUpperCase()}-${token}`;
}

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Certificates are not configured" }, { status: 503 });
  const decoded = await verifyBearerToken(request);
  if (!decoded) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { courseId?: string };
  const state = await readAuthoritativeLearningState(decoded.uid);
  const eligible = await eligibleCertificateDefinitionsFromContent(state);
  if (body.courseId && !eligible.some((definition) => definition.courseId === body.courseId)) {
    return NextResponse.json({ error: "Certificate requirements are not complete" }, { status: 403 });
  }
  const definitions = body.courseId ? eligible.filter((definition) => definition.courseId === body.courseId) : eligible;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const database = getAdminDb();

  for (const definition of definitions) {
    const id = `${decoded.uid}-${definition.courseId}`;
    const reference = database.collection("certificates").doc(id);
    const certificate: IssuedCertificate = {
      id,
      credentialId: credentialCode(definition.courseId),
      userId: decoded.uid,
      recipientEmail: decoded.email ?? "",
      learnerName: typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : decoded.email?.split("@")[0] ?? "Coursiv learner",
      ...definition,
      issuedAt: new Date().toISOString(),
      visibility: "public",
      emailStatus: "queued",
    };
    let created = false;
    await database.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (current.exists) return;
      transaction.set(reference, certificate);
      created = true;
    });
    if (created) {
      const delivery = await sendCertificateEmail(certificate, appUrl);
      await reference.set({ emailStatus: delivery.status, emailId: "emailId" in delivery ? delivery.emailId ?? null : null }, { merge: true });
    }
  }

  const certificates = await listCertificateRecords(decoded.uid);
  await refreshAdminUserSummary(decoded.uid);
  return NextResponse.json({ certificates, certificate: body.courseId ? certificates.find((item) => item.courseId === body.courseId) ?? null : undefined });
}
