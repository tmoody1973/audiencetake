"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getClientAuth, getClientFirestore } from "@/lib/firebase/client";
import { hasFirebaseClientConfig } from "@/lib/firebase/config";

type Claim = {
  projectId?: string;
  role?: string;
  status?: "pending" | "approved" | "rejected";
  publicProofUrl?: string;
};

export function ClaimReceipt({ claimId }: { claimId: string }) {
  const firebaseConfigured = hasFirebaseClientConfig();
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [signedIn, setSignedIn] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) return;
    try {
      return onAuthStateChanged(getClientAuth(), (user) => {
        setSignedIn(Boolean(user));
        setAuthReady(true);
      });
    } catch {
      queueMicrotask(() => setAuthReady(true));
    }
  }, [firebaseConfigured]);

  useEffect(() => {
    if (!signedIn || !firebaseConfigured) return;
    try {
      return onSnapshot(doc(getClientFirestore(), "claimRequests", claimId), (snapshot) => {
        setMissing(!snapshot.exists());
        setClaim(snapshot.exists() ? snapshot.data() as Claim : null);
      }, () => setMissing(true));
    } catch {
      queueMicrotask(() => setMissing(true));
    }
  }, [claimId, firebaseConfigured, signedIn]);

  const signIn = `/sign-in?returnTo=${encodeURIComponent(`/claims/${claimId}`)}`;
  return <main className="claim-page"><section className="claim-sheet">
    <span className="route-label">Private claim receipt</span><h1>Request to claim</h1>
    {!authReady ? <p>Checking your session…</p> : !signedIn ? <p>Sign in with the account that submitted this claim. <Link href={signIn}>Continue to sign in</Link>.</p> : missing ? <p>This claim is unavailable to this account.</p> : claim ? <>
      <dl><div><dt>Status</dt><dd>{claim.status ?? "pending"}</dd></div><div><dt>Project</dt><dd>{claim.projectId}</dd></div><div><dt>Requested role</dt><dd>{claim.role}</dd></div>{claim.publicProofUrl ? <div><dt>Public proof</dt><dd><a href={claim.publicProofUrl} target="_blank" rel="noreferrer">Open submitted link</a></dd></div> : null}</dl>
      <p className="evidence-note"><strong>{claim.status === "approved" ? "Approved." : claim.status === "rejected" ? "Not approved." : "Human review pending."}</strong> Private email, context, reviewer identity, and moderation notes are not shown publicly.</p>
    </> : <p>Loading your claim…</p>}
  </section></main>;
}
