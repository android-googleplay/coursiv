import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { listCertificateRecords } from "@/lib/platform/certificate-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error:"Certificates are not configured" }, { status:503 });
  const user = await verifyBearerToken(request);
  if (!user) return NextResponse.json({ error:"Authentication required" }, { status:401 });
  return NextResponse.json({ certificates:await listCertificateRecords(user.uid) });
}
