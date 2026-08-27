"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { sanitizeReturnTo } from "../../lib/auth/return-to";
import { createEmailAccount, signInWithEmail, signInWithGoogle } from "../../lib/auth/sign-in";

const googleSignInEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED === "true";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      router.replace(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void finish(() => create ? createEmailAccount(email, password) : signInWithEmail(email, password));
  };

  return <main className="sign-in-page"><section className="sign-in-card" aria-labelledby="sign-in-title"><span className="route-label">Audience Take / access</span><h1 id="sign-in-title">Sign in to participate</h1><p>Browsing is public. Sign in when you want to follow, commit, vote, Take, or reply.</p>{googleSignInEnabled ? <><button className="button-primary" type="button" onClick={() => void finish(signInWithGoogle)} disabled={busy}>Continue with Google</button><div className="sign-in-rule">or use email</div></> : null}<form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button-primary" type="submit" disabled={busy}>{create ? "Create account" : "Sign in"}</button></form>{error ? <p className="field-error" role="alert">{error}</p> : null}<button className="text-link" type="button" onClick={() => setCreate((value) => !value)}>{create ? "Already have an account? Sign in" : "New here? Create an account"}</button><small>Return destination: <code>{returnTo}</code></small></section></main>;
}
