"use client";

import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { trackSignedOut } from "../lib/analytics/auth-events";
import { signOutCurrentUser } from "../lib/auth/sign-in";
import { getClientAuth } from "../lib/firebase/client";
import { hasFirebaseClientConfig } from "../lib/firebase/config";
import { ArrowIcon } from "./icons";

type AuthState = "checking" | "signed-in" | "signed-out";

export function SiteHeader() {
  const pathname = usePathname();
  const firebaseConfigured = hasFirebaseClientConfig();
  const [authState, setAuthState] = useState<AuthState>(firebaseConfigured ? "checking" : "signed-out");
  const [signingOut, setSigningOut] = useState(false);
  const homeIsCurrent = pathname === "/";
  const wallIsCurrent = pathname === "/projects" || pathname?.startsWith("/projects/") === true;
  const returnTo = encodeURIComponent(pathname || "/");

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onAuthStateChanged(
      getClientAuth(),
      (user) => setAuthState(user ? "signed-in" : "signed-out"),
      () => setAuthState("signed-out"),
    );
  }, [firebaseConfigured]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutCurrentUser();
      trackSignedOut();
    } finally {
      setSigningOut(false);
    }
  };

  const authAction = authState === "checking"
    ? <span className="auth-status" aria-live="polite">Checking…</span>
    : authState === "signed-in"
      ? <button className="sign-in-link" type="button" onClick={() => void handleSignOut()} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
      : <Link className="sign-in-link" href={`/sign-in?returnTo=${returnTo}`}>Sign in</Link>;

  return <header className="site-header"><Link className="wordmark" href="/" aria-label="Audience Take home">Audience Take</Link><nav aria-label="Primary navigation"><Link href="/" aria-current={homeIsCurrent ? "page" : undefined}><span>01</span> Home</Link><Link href="/projects" aria-current={wallIsCurrent ? "page" : undefined}><span>02</span> Scouting Wall</Link><Link href="/#selects"><span>03</span> The Selects</Link></nav><div className="header-actions">{authAction}<Link className="header-nominate" href="/nominate">Nominate <ArrowIcon /></Link></div></header>;
}
