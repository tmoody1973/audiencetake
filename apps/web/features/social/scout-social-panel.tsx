"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { getClientAuth, getClientFirestore } from "../../lib/firebase/client";
import { hasFirebaseClientConfig } from "../../lib/firebase/config";
import { socialCommand } from "./client";
import type { ScoutCard } from "../scout-card/types";

type Props = { card: ScoutCard };
type Commitment = "would_watch" | "would_pay" | "bring_to_city" | "back_next_chapter";
const commitments: Array<[Commitment, string, string]> = [
  ["would_watch", "I would watch", "Signal intent to watch."],
  ["would_pay", "I would pay", "Signal willingness to pay."],
  ["bring_to_city", "Bring it to my city", "Tell the team where to bring it."],
  ["back_next_chapter", "Back the next chapter", "Signal support for another chapter."],
];

type Take = { id: string; uid?: string; whyItShouldGrow?: string; preferredPathwayId?: string; audienceNote?: string; active?: boolean; replyCount?: number; demoReplyCount?: number; displayName?: string; demoOnly?: boolean; demoLabel?: string };
type Reply = { id: string; uid?: string; body?: string; active?: boolean; displayName?: string; demoOnly?: boolean; demoLabel?: string };
type Counts = { followerCount?: number; demoFollowerCount?: number; takeCount?: number; demoTakeCount?: number; replyCount?: number; demoReplyCount?: number; commitmentCounts?: Record<string, number>; demoCommitmentCounts?: Record<string, number>; pathwayVoteCounts?: Record<string, number>; demoPathwayVoteCounts?: Record<string, number> };

function DemoCount({ value }: { value?: number }) {
  return value ? <small className="demo-count">+ {value} demo</small> : null;
}

function signInHref(slug: string) { return `/sign-in?returnTo=${encodeURIComponent(`/projects/${slug}#audience-pulse`)}`; }

export function ScoutSocialPanel({ card }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [followed, setFollowed] = useState(false);
  const [commitmentState, setCommitmentState] = useState<Partial<Record<Commitment, boolean>>>({});
  const [city, setCity] = useState("");
  const [vote, setVote] = useState<string | undefined>();
  const [takes, setTakes] = useState<Take[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [takeWhy, setTakeWhy] = useState("");
  const [takeNote, setTakeNote] = useState("");
  const [takePath, setTakePath] = useState(card.pathways[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const signedIn = Boolean(uid);
  const mine = useMemo(() => takes.find((take) => take.uid === uid && take.active !== false), [takes, uid]);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    let unsubscribe: () => void = () => undefined;
    try { unsubscribe = onAuthStateChanged(getClientAuth(), (user) => setUid(user?.uid ?? null)); } catch { /* demo mode */ }
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    try {
      const db = getClientFirestore();
      const projectRef = doc(db, "projects", card.projectId);
      const stopProject = onSnapshot(projectRef, (snapshot) => setCounts((snapshot.data() ?? {}) as Record<string, number>));
      const stopTakes = onSnapshot(query(collection(db, "takes"), where("projectId", "==", card.projectId), where("status", "==", "published")), (snapshot) => setTakes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Take)).filter((item) => item.active !== false)));
      return () => { stopProject(); stopTakes(); };
    } catch { return undefined; }
  }, [card.projectId]);

  useEffect(() => {
    if (!hasFirebaseClientConfig() || !takes.length) return;
    try {
      const db = getClientFirestore();
      const stops = takes.map((take) => onSnapshot(query(collection(db, "replies"), where("takeId", "==", take.id), where("status", "==", "published")), (snapshot) => setReplies((old) => ({ ...old, [take.id]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Reply)).filter((item) => item.active !== false) }))));
      return () => stops.forEach((stop) => stop());
    } catch { return undefined; }
  }, [takes]);

  useEffect(() => {
    if (!hasFirebaseClientConfig() || !uid) return;
    try {
      const db = getClientFirestore();
      const stops = [
        onSnapshot(doc(db, "follows", `${card.projectId}_${uid}`), (s) => setFollowed(s.data()?.active === true)),
        onSnapshot(doc(db, "pathwayVotes", `${card.projectId}_${uid}`), (s) => setVote(s.data()?.active ? s.data()?.pathwayId : undefined)),
        ...commitments.map(([type]) => onSnapshot(doc(db, "commitments", `${card.projectId}_${uid}_${type}`), (s) => setCommitmentState((old) => ({ ...old, [type]: s.data()?.active === true })))),
      ];
      return () => stops.forEach((stop) => stop());
    } catch { return undefined; }
  }, [card.projectId, uid]);

  const action = async (key: string, fn: () => Promise<void>) => { setError(""); setBusy(key); try { await fn(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed."); } finally { setBusy(null); } };
  const requireSignIn = () => { if (!signedIn) { window.location.assign(signInHref(card.slug)); return true; } return false; };
  const onFollow = () => { if (requireSignIn()) return; void action("follow", async () => { const next = !followed; setFollowed(next); try { await socialCommand(`/api/projects/${card.projectId}/follow`, next ? "PUT" : "DELETE"); } catch (e) { setFollowed(!next); throw e; } }); };
  const onCommitment = (type: Commitment) => { if (requireSignIn()) return; void action(type, async () => { if (type === "bring_to_city" && !commitmentState[type] && !city.trim()) throw new Error("City is required to bring this project to your city."); const next = !commitmentState[type]; setCommitmentState((old) => ({ ...old, [type]: next })); try { await socialCommand(`/api/projects/${card.projectId}/commitments/${type}`, next ? "PUT" : "DELETE", next && type === "bring_to_city" ? { city } : undefined); } catch (e) { setCommitmentState((old) => ({ ...old, [type]: !next })); throw e; } }); };
  const onVote = (pathwayId: string) => { if (requireSignIn()) return; void action("vote", async () => { const next = vote === pathwayId ? undefined : pathwayId; setVote(next); try { await socialCommand(`/api/projects/${card.projectId}/pathway-vote`, next ? "PUT" : "DELETE", next ? { pathwayId: next } : undefined); } catch (e) { setVote(vote); throw e; } }); };
  const saveTake = () => action("take", async () => { if (!takeWhy.trim() || (takeWhy.trim().length + takeNote.trim().length) > 600) throw new Error("Your Take and optional note must total 600 characters or fewer."); await socialCommand(`/api/projects/${card.projectId}/take`, mine ? "PATCH" : "PUT", { whyItShouldGrow: takeWhy.trim(), preferredPathwayId: takePath, audienceNote: takeNote.trim() || undefined }); setTakeWhy(""); setTakeNote(""); setEditing(false); });
  const withdrawTake = () => action("withdraw", async () => { await socialCommand(`/api/projects/${card.projectId}/take`, "DELETE"); setEditing(false); });
  const saveReply = (takeId: string) => action(`reply-${takeId}`, async () => { const body = replyDraft[takeId]?.trim(); if (!body || body.length > 600) throw new Error("Reply must be between 1 and 600 characters."); const existing = replies[takeId]?.find((reply) => reply.uid === uid); await socialCommand(`/api/takes/${takeId}/reply`, existing ? "PATCH" : "PUT", { body }); setReplyDraft((old) => ({ ...old, [takeId]: "" })); });
  const withdrawReply = (takeId: string) => action(`withdraw-reply-${takeId}`, async () => { await socialCommand(`/api/takes/${takeId}/reply`, "DELETE"); });

  // Populate the editor from the user's current Take when it arrives from Firestore.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (mine && !editing) { setTakeWhy(mine.whyItShouldGrow ?? ""); setTakeNote(mine.audienceNote ?? ""); setTakePath(mine.preferredPathwayId ?? card.pathways[0]?.id ?? ""); } }, [mine, editing, card.pathways]);

  return <section className="scout-social-panel" id="audience-pulse" aria-labelledby="audience-pulse-title">
    <div className="section-heading-line"><div><span className="route-label">Audience Take native</span><h2 id="audience-pulse-title">Audience Pulse</h2></div><span>Participation, not prediction</span></div>
    <p className="social-intro">A public place to show what you would do next. Counts below are Audience Take-native and update live when available.</p>
    {!signedIn ? <p className="social-auth-note">Sign in to participate. <Link href={signInHref(card.slug)}>Continue to sign in</Link></p> : null}
    <div className="social-primary"><button className="button-primary" type="button" aria-pressed={followed} aria-busy={busy === "follow"} disabled={busy !== null} onClick={onFollow}>{followed ? "Following" : "Follow this project"} <span>{counts.followerCount ?? 0}</span><DemoCount value={counts.demoFollowerCount} /></button><small>Follow is a lightweight signal that you want updates. Demo-account signals are shown separately.</small></div>
    <div className="social-grid">
      <fieldset className="commitment-list"><legend>Commitments</legend>{commitments.map(([type, label, definition]) => <div className="social-control" key={type}><button type="button" aria-pressed={Boolean(commitmentState[type])} aria-busy={busy === type} disabled={busy !== null} onClick={() => onCommitment(type)}>{commitmentState[type] ? "✓ " : ""}{label}<span>{counts.commitmentCounts?.[type] ?? 0}</span><DemoCount value={counts.demoCommitmentCounts?.[type]} /></button><small>{definition}</small>{type === "bring_to_city" && commitmentState[type] !== true ? <label>City<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Chicago" /></label> : null}</div>)}</fieldset>
      <fieldset className="pathway-votes"><legend>Which pathway should grow?</legend>{card.pathways.map((pathway) => <label key={pathway.id}><input type="radio" name={`pathway-${card.projectId}`} checked={vote === pathway.id} disabled={busy !== null} onChange={() => onVote(pathway.id)} /> <span>{pathway.label}</span><small>{counts.pathwayVoteCounts?.[pathway.id] ?? 0} organic votes <DemoCount value={counts.demoPathwayVoteCounts?.[pathway.id]} /></small></label>)}<button className="text-link" type="button" disabled={!vote || busy !== null} onClick={() => { if (vote) onVote(vote); }}>Clear my vote</button></fieldset>
    </div>
    <div className="take-editor"><div><span className="route-label">One structured Take</span><h3>Make the case for growth</h3><p>One Take per person. Flat replies keep the conversation legible.</p></div><form onSubmit={(event) => { event.preventDefault(); if (requireSignIn()) return; void saveTake(); }}><label>Why should it grow? <textarea value={takeWhy} onChange={(event) => setTakeWhy(event.target.value)} maxLength={600} required disabled={!signedIn || busy !== null} /><small>{takeWhy.length}/600</small></label><label>Preferred pathway<select value={takePath} onChange={(event) => setTakePath(event.target.value)} disabled={!signedIn || busy !== null}>{card.pathways.map((pathway) => <option value={pathway.id} key={pathway.id}>{pathway.label}</option>)}</select></label><label>Audience note (optional)<textarea value={takeNote} onChange={(event) => setTakeNote(event.target.value)} maxLength={600} disabled={!signedIn || busy !== null} /></label><div><button className="button-primary" type="submit" disabled={busy !== null}>{mine ? "Edit Take" : "Publish Take"}</button>{mine ? <button type="button" onClick={withdrawTake} disabled={busy !== null}>Withdraw</button> : null}</div></form></div>
    {error ? <p className="field-error" role="alert">{error}</p> : null}<div className="social-live" aria-live="polite">{(counts.takeCount ?? 0) || (counts.demoTakeCount ?? 0) ? <>{counts.takeCount ?? 0} organic published Takes <DemoCount value={counts.demoTakeCount} /></> : "No published Takes yet."}</div>
    <div className="takes-list" aria-label="Published Takes">{takes.map((take) => { const visibleReplies = replies[take.id] ?? []; const organicReplyCount = visibleReplies.length ? visibleReplies.filter((reply) => !reply.demoOnly).length : take.replyCount ?? 0; const demoReplyCount = visibleReplies.length ? visibleReplies.filter((reply) => reply.demoOnly).length : take.demoReplyCount ?? 0; return <article key={take.id}><h4>{take.displayName ?? "Audience member"} {take.demoOnly ? <span className="demo-activity-badge">Demo activity</span> : null}</h4><p>{take.whyItShouldGrow}</p><small>{card.pathways.find((pathway) => pathway.id === take.preferredPathwayId)?.label ?? "Pathway"} · {organicReplyCount} organic replies <DemoCount value={demoReplyCount} /></small><div className="replies-list">{visibleReplies.map((reply) => <div key={reply.id}><strong>{reply.displayName ?? "Audience member"} {reply.demoOnly ? <span className="demo-activity-badge">Demo activity</span> : null}</strong><p>{reply.body}</p>{reply.uid === uid ? <><button type="button" onClick={() => setReplyDraft((old) => ({ ...old, [take.id]: reply.body ?? "" }))} disabled={busy !== null}>Edit reply</button> <button type="button" onClick={() => withdrawReply(take.id)} disabled={busy !== null}>Withdraw reply</button></> : null}</div>)}</div>{signedIn ? <form onSubmit={(event) => { event.preventDefault(); void saveReply(take.id); }}><label>Reply<textarea value={replyDraft[take.id] ?? ""} maxLength={600} onChange={(event) => setReplyDraft((old) => ({ ...old, [take.id]: event.target.value }))} /></label><button type="submit" disabled={busy !== null}>Reply</button></form> : null}</article>; })}</div>
    <div className="social-demo-label"><strong>Audience Pulse is native-only.</strong> No external-web attention is included. Demo-account activity is labeled and excluded from organic totals.</div>
  </section>;
}
