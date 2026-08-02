"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseClient } from "./firebase-client";

export type OnboardingProfileState = {
  step: number;
  selectedProgram: string;
  completed: boolean;
};

export async function ensureUserProfile(user: { id: string; email: string; displayName: string }) {
  const client = getFirebaseClient();
  if (!client) return;
  const reference = doc(client.db, "users", user.id);
  const snapshot = await getDoc(reference);
  const now = new Date().toISOString();
  const identity = { email: user.email, displayName: user.displayName, updatedAt: now, lastActiveAt: now };
  if (snapshot.exists()) await setDoc(reference, identity, { merge: true });
  else await setDoc(reference, { ...identity, role: "learner", onboardingCompleted: false, createdAt: now });
}

export async function loadOnboardingProfile(userId: string): Promise<OnboardingProfileState | null> {
  const client = getFirebaseClient();
  if (!client) return null;
  const snapshot = await getDoc(doc(client.db, "users", userId));
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  if (typeof value.onboardingStep !== "number" || typeof value.onboardingProgramId !== "string") return null;
  return { step: value.onboardingStep, selectedProgram: value.onboardingProgramId, completed: value.onboardingCompleted === true };
}

export async function saveOnboardingProfile(userId: string, state: OnboardingProfileState) {
  const client = getFirebaseClient();
  if (!client) return;
  const reference = doc(client.db, "users", userId);
  const snapshot = await getDoc(reference);
  const now = new Date().toISOString();
  const fields = {
    onboardingStep: state.step,
    onboardingProgramId: state.selectedProgram,
    onboardingCompleted: state.completed,
    updatedAt: now,
  };
  if (snapshot.exists()) await setDoc(reference, fields, { merge: true });
  else await setDoc(reference, { ...fields, role: "learner", createdAt: now });
}
