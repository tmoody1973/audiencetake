"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  trackSignIn,
  trackSignInFailed,
  trackSignInStarted,
  type SignInIntent,
  type SignInMethod,
} from "../../lib/analytics/auth-events";
import { sanitizeReturnTo } from "../../lib/auth/return-to";
import {
  completeEmailLinkSignIn,
  createEmailAccount,
  isEmailSignInLink,
  sendEmailSignInLink,
  signInWithEmail,
  signInWithGoogle,
} from "../../lib/auth/sign-in";
import { GoogleOneTap } from "./google-one-tap";

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
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !isEmailSignInLink(window.location.href)) {
      return undefined;
    }
    let active = true;
    trackSignIn("email_link", "sign_in", () => completeEmailLinkSignIn(window.location.href))
      .then(() => {
        if (active) router.replace(returnTo);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Sign in failed.");
      });
    return () => {
      active = false;
    };
  }, [router, returnTo]);

  const finish = async (
    work: () => Promise<{ user: { uid: string } }>,
    method: SignInMethod,
    intent: SignInIntent,
  ) => {
    setBusy(true);
    setError("");
    try {
      await trackSignIn(method, intent, work);
      router.replace(returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const intent: SignInIntent = create ? "create_account" : "sign_in";
    void finish(
      () => (create ? createEmailAccount(email, password) : signInWithEmail(email, password)),
      "email_password",
      intent,
    );
  };

  const sendLink = async () => {
    setBusy(true);
    setError("");
    setLinkSent(false);
    trackSignInStarted("email_link", "sign_in");
    try {
      await sendEmailSignInLink(email);
      setLinkSent(true);
    } catch (cause) {
      trackSignInFailed("email_link", "sign_in", cause);
      setError(cause instanceof Error ? cause.message : "We could not send the sign-in link.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="sign-in-page"><GoogleOneTap returnTo={returnTo} /><section className="sign-in-card" aria-labelledby="sign-in-title"><span className="route-label">Audience Take / access</span><h1 id="sign-in-title">Sign in to participate</h1><p>Browsing is public. Sign in when you want to follow, commit, vote, Take, or reply.</p>{googleSignInEnabled ? <><button className="button-primary" type="button" onClick={() => void finish(signInWithGoogle, "google_popup", "sign_in")} disabled={busy}>Continue with Google</button><div className="sign-in-rule">or use email</div></> : null}<form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button-primary" type="submit" disabled={busy}>{create ? "Create account" : "Sign in"}</button></form><button className="text-link" type="button" onClick={() => void sendLink()} disabled={busy || !email}>Email me a sign-in link</button>{linkSent ? <p className="field-note" role="status">Check {email} for a sign-in link.</p> : null}{error ? <p className="field-error" role="alert">{error}</p> : null}<button className="text-link" type="button" onClick={() => setCreate((value) => !value)}>{create ? "Already have an account? Sign in" : "New here? Create an account"}</button><small>Return destination: <code>{returnTo}</code></small></section></main>;
}
