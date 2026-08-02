"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { friendlyAuthError } from "@/lib/platform/auth-recovery";
import { useAuth } from "./auth-context";

export function AccountRecoveryScreen() {
  const search = useSearchParams();
  const auth = useAuth();
  const verification = search.get("verify") === "1" || search.get("sent") === "verification";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(verification && search.get("sent") ? "Verification email sent. Check your inbox and spam folder." : "");
  const [error, setError] = useState("");

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await auth.requestPasswordReset(email.trim());
      setMessage("If an account exists for that email, a secure reset link has been sent.");
    } catch (reason) { setError(friendlyAuthError(reason)); }
    finally { setBusy(false); }
  }

  async function resendVerification() {
    setBusy(true); setError(""); setMessage("");
    try {
      await auth.sendVerification();
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (reason) { setError(friendlyAuthError(reason)); }
    finally { setBusy(false); }
  }

  async function checkVerification() {
    setBusy(true); setError("");
    try {
      const current = await auth.refreshUser();
      if (current?.emailVerified) window.location.assign("/onboarding");
      else setError("Your email is not verified yet. Open the link in the email, then try again.");
    } catch (reason) { setError(friendlyAuthError(reason)); }
    finally { setBusy(false); }
  }

  if (verification) {
    return <RecoveryShell icon={<Mail/>} title="Verify your email" description={`We sent a verification link${auth.user?.email ? ` to ${auth.user.email}` : ""}.`}>
      {message&&<div className="auth-success"><CheckCircle2/>{message}</div>}
      {error&&<div className="auth-error">{error}</div>}
      <button className="auth-submit" type="button" disabled={busy} onClick={()=>void checkVerification()}>{busy?"Checking…":"I’ve verified my email"}<ArrowRight/></button>
      <button className="auth-secondary" type="button" disabled={busy||!auth.user} onClick={()=>void resendVerification()}>Resend verification email</button>
      <p className="auth-switch"><Link href="/login">Use a different account</Link></p>
    </RecoveryShell>;
  }

  return <RecoveryShell icon={<ShieldCheck/>} title="Reset your password" description="Enter your account email and we’ll send you a secure recovery link.">
    <form onSubmit={requestReset}>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@example.com" required/></label>
      {message&&<div className="auth-success"><CheckCircle2/>{message}</div>}
      {error&&<div className="auth-error">{error}</div>}
      <button className="auth-submit" disabled={busy||!email.trim()}>{busy?"Sending…":"Send reset link"}<ArrowRight/></button>
    </form>
    <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
  </RecoveryShell>;
}

function RecoveryShell({ icon, title, description, children }: { icon:React.ReactNode; title:string; description:string; children:React.ReactNode }) {
  return <main className="recovery-stage"><section className="auth-card recovery-card"><Link className="recovery-brand" href="/"><span>C</span>Coursiv</Link><div className="recovery-icon">{icon}</div><h2>{title}</h2><p>{description}</p>{children}<small><ShieldCheck/>Recovery links are single-use and expire automatically.</small></section></main>;
}
