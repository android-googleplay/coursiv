"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { getFirebaseClient } from "@/lib/platform/firebase-client";
import { friendlyAuthError, parseFirebaseAction } from "@/lib/platform/auth-recovery";

export function AccountActionScreen() {
  const search = useSearchParams();
  const action = useMemo(() => parseFirebaseAction(search), [search]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"checking"|"ready"|"success"|"error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function prepare() {
      const client = getFirebaseClient();
      if (!client || !action.valid) {
        if (active) { setStatus("error"); setMessage(!client?"Account recovery is not configured.":"This recovery link is incomplete or invalid."); }
        return;
      }
      try {
        if (action.mode === "resetPassword") {
          await verifyPasswordResetCode(client.auth, action.code);
          if (active) setStatus("ready");
        } else {
          await applyActionCode(client.auth, action.code);
          if (active) { setStatus("success"); setMessage(action.mode==="verifyEmail"?"Your email is verified. You can continue to Coursiv.":"Your email address has been recovered."); }
        }
      } catch (reason) {
        if (active) { setStatus("error"); setMessage(friendlyAuthError(reason)); }
      }
    }
    void prepare();
    return () => { active = false; };
  }, [action]);

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setMessage("Use a password with at least 8 characters."); return; }
    if (password !== confirm) { setMessage("The passwords do not match."); return; }
    const client = getFirebaseClient();
    if (!client) return;
    setStatus("checking"); setMessage("");
    try {
      await confirmPasswordReset(client.auth, action.code, password);
      setStatus("success"); setMessage("Your password has been changed. You can now sign in.");
    } catch (reason) {
      setStatus("error"); setMessage(friendlyAuthError(reason));
    }
  }

  return <main className="recovery-stage"><section className="auth-card recovery-card"><Link className="recovery-brand" href="/"><span>C</span>Coursiv</Link><div className="recovery-icon">{status==="success"?<CheckCircle2/>:<ShieldCheck/>}</div><h2>{action.mode==="resetPassword"?"Choose a new password":"Secure account recovery"}</h2>
    {status==="checking"&&<p>Checking your secure recovery link…</p>}
    {status==="ready"&&<form onSubmit={resetPassword}><label>New password<span className="password-field"><input type={show?"text":"password"} autoComplete="new-password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="At least 8 characters"/><button type="button" onClick={()=>setShow((value)=>!value)}>{show?<EyeOff/>:<Eye/>}</button></span></label><label>Confirm new password<input type={show?"text":"password"} autoComplete="new-password" value={confirm} onChange={(event)=>setConfirm(event.target.value)}/></label>{message&&<div className="auth-error">{message}</div>}<button className="auth-submit" disabled={!password||!confirm}>Reset password<ArrowRight/></button></form>}
    {status==="success"&&<><div className="auth-success"><CheckCircle2/>{message}</div><Link className="auth-submit" href="/login">Continue to sign in<ArrowRight/></Link></>}
    {status==="error"&&<><div className="auth-error">{message}</div><Link className="auth-submit" href="/account/recovery">Request a new link<ArrowRight/></Link></>}
  </section></main>;
}
