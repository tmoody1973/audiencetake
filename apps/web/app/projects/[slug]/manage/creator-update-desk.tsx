"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { trustCommand } from "@/features/trust/client";
import { getClientAuth, getClientFirestore } from "@/lib/firebase/client";
import { hasFirebaseClientConfig } from "@/lib/firebase/config";

type Update = { id: string; title?: string; body?: string; media?: Array<{ id?: string; url?: string }>; demoLabel?: string };

export function CreatorUpdateDesk({ projectId, slug, title }: { projectId: string; slug: string; title: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [access, setAccess] = useState<"checking" | "approved" | "denied">("checking");
  const [demoOnly, setDemoOnly] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadRequestId, setUploadRequestId] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    try {
      return onAuthStateChanged(getClientAuth(), (user) => {
        setSignedIn(Boolean(user));
        if (!user) { setAccess("denied"); return; }
        void trustCommand<{ authorized: true; demoOnly: boolean }>(`/api/projects/${projectId}/creator-updates`, "GET")
          .then((result) => { setAccess("approved"); setDemoOnly(result.demoOnly); })
          .catch(() => setAccess("denied"));
      });
    } catch {
      return;
    }
  }, [projectId]);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    try {
      return onSnapshot(query(collection(getClientFirestore(), "creatorUpdates"), where("projectId", "==", projectId), where("status", "==", "published"), orderBy("createdAt", "desc")), (snapshot) => {
        setUpdates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Update)));
      });
    } catch {
      return;
    }
  }, [projectId]);

  const upload = async () => {
    if (!file) return mediaIds;
    const requestId = uploadRequestId ?? crypto.randomUUID();
    if (!uploadRequestId) setUploadRequestId(requestId);
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("requestId", requestId);
    form.set("file", file);
    const uploaded = await trustCommand<{ mediaId: string }>(`/api/uploads?projectId=${encodeURIComponent(projectId)}&requestId=${encodeURIComponent(requestId)}`, "POST", form);
    const next = [...mediaIds, uploaded.mediaId];
    setMediaIds(next);
    setFile(null);
    setUploadRequestId(null);
    return next;
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const attached = await upload();
      await trustCommand(`/api/projects/${projectId}/creator-updates`, "POST", { title: headline, body, mediaIds: attached });
      setHeadline(""); setBody(""); setMediaIds([]);
      setNotice("Creator update published in its own labeled ledger.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The update could not be published.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (updateId: string) => {
    setBusy(true); setError("");
    try {
      await trustCommand(`/api/creator-updates/${updateId}`, "DELETE");
      setNotice("Update withdrawn. Its private audit history was retained.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The update could not be withdrawn.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = `/sign-in?returnTo=${encodeURIComponent(`/projects/${slug}/manage`)}`;
  return <main className="manage-page"><section className="manage-sheet">
    <span className="route-label">Project-scoped creator desk</span><h1>{title}</h1>
    {access === "checking" ? <p>Verifying project permission…</p> : access === "denied" ? <div className="form-alert"><strong>Approved creator access required</strong><p>{signedIn ? "This account is not approved for this project." : <>Sign in with an approved project account. <Link href={signIn}>Continue to sign in</Link>.</>}</p></div> : <>
      {demoOnly ? <p className="social-demo-label"><strong>Pre-approved demo creator.</strong> Activity from this account is labeled Demo activity.</p> : null}
      <p>Updates and authorized media appear separately from agent research, citations, fan history, and native counts.</p>
      <form onSubmit={publish}><label>Update title<input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={120} required disabled={busy} /></label><label>Update body<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} required disabled={busy} /></label><label>Optional image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setUploadRequestId(event.target.files?.[0] ? crypto.randomUUID() : null); }} disabled={busy} /><small>JPEG, PNG, or WebP · maximum 5 MB · server-generated path</small></label><button className="button-primary" type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish creator update"}</button></form>
      <section className="manage-update-list"><h2>Published updates</h2>{updates.length ? updates.map((update) => <article key={update.id}><span className="route-label">{update.demoLabel ?? "Creator update"}</span><h3>{update.title}</h3><p>{update.body}</p><button type="button" disabled={busy} onClick={() => void withdraw(update.id)}>Withdraw</button></article>) : <p>No creator updates are published.</p>}</section>
    </>}
    {notice ? <p className="trust-notice" role="status">{notice}</p> : null}{error ? <p className="field-error" role="alert">{error}</p> : null}
  </section></main>;
}
