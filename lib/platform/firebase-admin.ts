import "server-only";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  );
}

function getAdminApp() {
  if (!isFirebaseAdminConfigured()) throw new Error("Firebase Admin is not configured");
  if (getApps().length) return getApps()[0]!;
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? applicationDefault()
    : cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      });
  return initializeApp({ credential, storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
}

export function getAdminAuth() { return getAuth(getAdminApp()); }
let adminDbConfigured = false;
export function getAdminDb() {
  const database = getFirestore(getAdminApp());
  if (!adminDbConfigured) {
    database.settings({ preferRest: true });
    adminDbConfigured = true;
  }
  return database;
}
export function getAdminStorage() { return getStorage(getAdminApp()); }

export async function verifyBearerToken(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try { return await getAdminAuth().verifyIdToken(token); } catch { return null; }
}

export async function requireAdmin(request: Request) {
  const decoded = await verifyBearerToken(request);
  if (!decoded || decoded.admin !== true) return null;
  return decoded;
}
