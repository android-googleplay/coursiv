"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createUserWithEmailAndPassword, EmailAuthProvider, getAdditionalUserInfo, GoogleAuthProvider, onAuthStateChanged, reauthenticateWithCredential, reauthenticateWithPopup, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut as firebaseSignOut, updateProfile, verifyBeforeUpdateEmail, type User } from "firebase/auth";
import { getFirebaseClient, isFirebaseClientConfigured } from "@/lib/platform/firebase-client";
import { ensureUserProfile } from "@/lib/platform/user-profile-client";

type AuthUser = { id: string; email: string; displayName: string; demo: boolean; guest: boolean; providers: string[]; emailVerified: boolean };
type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ isNewUser: boolean; token: string | null }>;
  signInWithGoogle: () => Promise<{ isNewUser: boolean; token: string | null }>;
  continueAsGuest: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  changeEmail: (email: string, password?: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const DEMO_AUTH_KEY = "lumora.demo.auth.v1";
const GUEST_AUTH_KEY = "coursiv.guest.auth.v1";
const demoUser: AuthUser = { id: "demo-hj", email: "hj@lumora.demo", displayName: "HJ", demo: true, guest: false, providers: ["password"], emailVerified: true };
const guestUser: AuthUser = { id: "guest", email: "", displayName: "Guest", demo: true, guest: true, providers: ["guest"], emailVerified: true };
const debugAdminUser: AuthUser = { id: "debug-admin", email: "admin@coursiv.local", displayName: "Debug Admin", demo: true, guest: false, providers: ["debug"], emailVerified: true };
const debugAdminRequested = process.env.NEXT_PUBLIC_COURSIV_DEBUG_ADMIN === "true";
const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: User): AuthUser { return { id: user.uid, email: user.email ?? "", displayName: user.displayName ?? user.email?.split("@")[0] ?? "Member", demo: false, guest: false, providers: user.providerData.map((provider) => provider.providerId), emailVerified: user.emailVerified }; }
function isLocalDebugAdmin() {
  if (!debugAdminRequested || typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}
function readLocalUser() {
  const saved=localStorage.getItem(DEMO_AUTH_KEY); if(saved==="signed-out")return null; if(!saved)return demoUser;
  try{return {...demoUser,...JSON.parse(saved) as Partial<AuthUser>,demo:true}}catch{return demoUser}
}
function saveLocalUser(user:AuthUser){localStorage.setItem(DEMO_AUTH_KEY,JSON.stringify(user))}
function hasFirebaseAuthErrorCode(reason: unknown, code: string) {
  return typeof reason === "object" && reason !== null && "code" in reason && reason.code === code;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    if (isLocalDebugAdmin()) {
      document.documentElement.dataset.debugAdmin = "true";
      queueMicrotask(() => { setUser(debugAdminUser); setLoading(false); });
      return;
    }
    if (guestMode || sessionStorage.getItem(GUEST_AUTH_KEY) === "active") {
      if (!guestMode) queueMicrotask(() => setGuestMode(true));
      queueMicrotask(() => { setUser(guestUser); setLoading(false); });
      return;
    }
    if (!configured) { let active=true;queueMicrotask(()=>{if(active){setUser(readLocalUser());setLoading(false)}});return()=>{active=false}; }
    const client = getFirebaseClient();
    if (!client) return;
    return onAuthStateChanged(client.auth, (nextUser) => {
      const mapped = nextUser ? mapUser(nextUser) : null;
      setUser(mapped); setLoading(false);
      if (mapped) void ensureUserProfile(mapped).catch(() => undefined);
    });
  }, [configured, guestMode]);

  const leaveGuestMode = useCallback(() => {
    sessionStorage.removeItem(GUEST_AUTH_KEY);
    setGuestMode(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    leaveGuestMode();
    const client = getFirebaseClient();
    if (client) { await signInWithEmailAndPassword(client.auth, email, password); return; }
    const localUser={ ...demoUser, id:`local-${email.trim().toLowerCase()||"member"}`, email: email || demoUser.email, displayName:email.split("@")[0]||"Member" };saveLocalUser(localUser);setUser(localUser);
  }, [leaveGuestMode]);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    leaveGuestMode();
    const client = getFirebaseClient();
    if (client) { const credential = await createUserWithEmailAndPassword(client.auth, email, password); await updateProfile(credential.user, { displayName: name }); const mapped=mapUser(credential.user);await ensureUserProfile(mapped);setUser(mapped); return { isNewUser: true, token: await credential.user.getIdToken() }; }
    const localUser={ ...demoUser, id:`local-${email.trim().toLowerCase()||"member"}`, displayName: name || "Member", email: email || demoUser.email };saveLocalUser(localUser);setUser(localUser);
    return { isNewUser: true, token: null };
  }, [leaveGuestMode]);
  const signInWithGoogle = useCallback(async () => {
    leaveGuestMode();
    const client = getFirebaseClient();
    if (client) {
      const provider = new GoogleAuthProvider();
      let credential;
      try {
        credential = await signInWithPopup(client.auth, provider);
      } catch (reason) {
        if (hasFirebaseAuthErrorCode(reason, "auth/popup-blocked")) {
          return signInWithRedirect(client.auth, provider);
        }
        throw reason;
      }
      const mapped = mapUser(credential.user);
      await ensureUserProfile(mapped);
      setUser(mapped);
      return { isNewUser: getAdditionalUserInfo(credential)?.isNewUser === true, token: await credential.user.getIdToken() };
    }
    saveLocalUser(demoUser); setUser(demoUser);
    return { isNewUser: false, token: null };
  }, [leaveGuestMode]);
  const continueAsGuest = useCallback(async () => {
    const client = getFirebaseClient();
    if (client?.auth.currentUser) await firebaseSignOut(client.auth);
    sessionStorage.setItem(GUEST_AUTH_KEY, "active");
    setGuestMode(true);
    setUser(guestUser);
    setLoading(false);
  }, []);
  const requestPasswordReset = useCallback(async (email: string) => {
    const client = getFirebaseClient();
    if (!client) return;
    await sendPasswordResetEmail(client.auth, email, { url: `${window.location.origin}/login` });
  }, []);
  const sendVerification = useCallback(async () => {
    const current = getFirebaseClient()?.auth.currentUser;
    if (!current || current.emailVerified) return;
    await sendEmailVerification(current, { url: `${window.location.origin}/account/action` });
  }, []);
  const refreshUser = useCallback(async () => {
    const current = getFirebaseClient()?.auth.currentUser;
    if (!current) return user;
    await current.reload();
    const mapped = mapUser(current);
    setUser(mapped);
    return mapped;
  }, [user]);
  const signOut = useCallback(async () => {
    if (isLocalDebugAdmin()) { setUser(debugAdminUser); return; }
    sessionStorage.removeItem(GUEST_AUTH_KEY);
    setGuestMode(false);
    const client = getFirebaseClient();
    if (client?.auth.currentUser) await firebaseSignOut(client.auth);
    else { if (!configured) localStorage.setItem(DEMO_AUTH_KEY, "signed-out"); setUser(null); }
  }, [configured]);
  const changeEmail = useCallback(async (email: string, password?: string) => {
    const client = getFirebaseClient();
    if (client?.auth.currentUser) {
      const current = client.auth.currentUser;
      if (current.providerData.some((provider) => provider.providerId === "password")) {
        if (!current.email || !password) throw new Error("Enter your current password to confirm this change.");
        await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      } else if (current.providerData.some((provider) => provider.providerId === "google.com")) {
        await reauthenticateWithPopup(current, new GoogleAuthProvider());
      }
      await verifyBeforeUpdateEmail(current, email, { url: `${window.location.origin}/profile/settings`, handleCodeInApp: false });
      return;
    }
    setUser((current) => {if(!current)return current;const next={...current,email};saveLocalUser(next);return next});
  }, []);
  const deleteAccount = useCallback(async () => {
    const client = getFirebaseClient();
    if (client?.auth.currentUser) {
      const token = await client.auth.currentUser.getIdToken();
      const response = await fetch("/api/account/delete", { method:"DELETE", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({confirmation:"DELETE"}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to delete account");
      await firebaseSignOut(client.auth).catch(() => undefined);
    }
    for (const key of Object.keys(localStorage)) if (key.startsWith("lumora.")) localStorage.removeItem(key);
    sessionStorage.clear(); setUser(null);
  }, []);
  const getToken = useCallback(async () => getFirebaseClient()?.auth.currentUser?.getIdToken() ?? null, []);
  const value = useMemo(() => ({ user, loading, configured, signIn, signUp, signInWithGoogle, continueAsGuest, requestPasswordReset, sendVerification, refreshUser, signOut, changeEmail, deleteAccount, getToken }), [changeEmail, configured, continueAsGuest, deleteAccount, getToken, loading, refreshUser, requestPasswordReset, sendVerification, signIn, signInWithGoogle, signOut, signUp, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
