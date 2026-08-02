import "server-only";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import { getDemoCertificate } from "@/lib/certificates";
import type { IssuedCertificate } from "./types";

const demoCertificateStore = new Map<string, IssuedCertificate>();

export function saveDemoCertificate(certificate: IssuedCertificate) {
  demoCertificateStore.set(certificate.id, certificate);
  demoCertificateStore.set(certificate.credentialId, certificate);
}

export async function getCertificateRecord(id: string): Promise<IssuedCertificate | null> {
  if (!isFirebaseAdminConfigured()) return demoCertificateStore.get(id) ?? getDemoCertificate(id);
  const direct = await getAdminDb().collection("certificates").doc(id).get();
  if (direct.exists) return direct.data() as IssuedCertificate;
  const query = await getAdminDb().collection("certificates").where("credentialId","==",id).limit(1).get();
  return query.empty ? null : query.docs[0].data() as IssuedCertificate;
}

export async function listCertificateRecords(userId: string): Promise<IssuedCertificate[]> {
  if (!isFirebaseAdminConfigured()) return [];
  const snapshot = await getAdminDb().collection("certificates").where("userId", "==", userId).limit(100).get();
  return snapshot.docs.map((document) => document.data() as IssuedCertificate).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
