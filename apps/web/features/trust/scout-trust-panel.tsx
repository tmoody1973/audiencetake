"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getClientAuth, getClientFirestore } from "@/lib/firebase/client";
import { hasFirebaseClientConfig } from "@/lib/firebase/config";

import type { ClaimStatus, ScoutCard } from "../scout-card/types";
import { trustCommand } from "./client";
import { initialCardVersionId } from "./correction-history";

type EvidenceLead = {
  id: string;
  url?: string;
  note?: string;
  status?: string;
  incorporatedSourceId?: string;
  suggestedUse?: "scout_card_video";
};

type CreatorUpdate = {
  id: string;
  title?: string;
  body?: string;
  status?: string;
  media?: Array<{ id?: string; url?: string }>;
  demoLabel?: string;
};
type Correction = {
  id: string;
  section?: string;
  summary?: string;
  priorBasis?: string;
  cardVersionId?: string;
  fromCardVersionId?: string;
  toCardVersionId?: string;
};

type ClaimRequest = { id: string; status?: "pending" | "approved" | "rejected" };
type ReportReason = "spam" | "impersonation" | "copyright_privacy" | "harassment" | "misleading" | "other";
type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type ReportReceipt = { id: string; targetType: string; targetId: string; reason: ReportReason; status: ReportStatus };

const evidenceLabels: Record<string, string> = {
  community_lead: "Awaiting review",
  verified_incorporated: "Verified and incorporated",
  relevant_support: "Relevant supporting context",
  conflicts: "Conflicting evidence retained",
  could_not_verify: "Could not verify",
  rejected: "Rejected",
};

function signInHref(slug: string) {
  return `/sign-in?returnTo=${encodeURIComponent(`/projects/${slug}#trust-and-ownership`)}`;
}

export function ScoutTrustPanel({ card }: { card: ScoutCard }) {
  const [uid, setUid] = useState<string | null>(null);
  const [liveClaimStatus, setLiveClaimStatus] = useState<ClaimStatus>(card.claimStatus);
  const [claim, setClaim] = useState<ClaimRequest | null>(null);
  const [evidence, setEvidence] = useState<EvidenceLead[]>([]);
  const [updates, setUpdates] = useState<CreatorUpdate[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [proposeAsVideo, setProposeAsVideo] = useState(false);
  const [role, setRole] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [claimContext, setClaimContext] = useState("");
  const [reportReason, setReportReason] = useState<ReportReason>("misleading");
  const [reportContext, setReportContext] = useState("");
  const [reportIds, setReportIds] = useState<string[]>([]);
  const [reportReceipts, setReportReceipts] = useState<Record<string, ReportReceipt>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const initialPublishedCardVersionId = initialCardVersionId(card.cardVersionId, corrections);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    try {
      return onAuthStateChanged(getClientAuth(), (user) => setUid(user?.uid ?? null));
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!hasFirebaseClientConfig()) return;
    try {
      const database = getClientFirestore();
      const stops = [
        onSnapshot(doc(database, "projects", card.projectId), (snapshot) => {
          const status = snapshot.data()?.claimStatus;
          if (["unclaimed", "pending", "approved", "rejected"].includes(status)) {
            setLiveClaimStatus(status as ClaimStatus);
          }
        }),
        onSnapshot(
          query(
            collection(database, "evidenceSuggestions"),
            where("projectId", "==", card.projectId),
            where("visibility", "==", "public"),
            orderBy("createdAt", "desc"),
          ),
          (snapshot) => setEvidence(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as EvidenceLead))),
        ),
        onSnapshot(
          query(
            collection(database, "creatorUpdates"),
            where("projectId", "==", card.projectId),
            where("status", "==", "published"),
            orderBy("createdAt", "desc"),
          ),
          (snapshot) => setUpdates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CreatorUpdate))),
        ),
        onSnapshot(
          query(
            collection(database, "projectCorrections"),
            where("projectId", "==", card.projectId),
            where("visibility", "==", "public"),
            orderBy("createdAt", "desc"),
          ),
          (snapshot) => setCorrections(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Correction))),
        ),
      ];
      return () => stops.forEach((stop) => stop());
    } catch {
      return;
    }
  }, [card.projectId]);

  useEffect(() => {
    if (!hasFirebaseClientConfig() || !uid) return;
    try {
      return onSnapshot(
        doc(getClientFirestore(), "claimRequests", `${card.projectId}_${uid}`),
        (snapshot) => setClaim(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as ClaimRequest : null),
      );
    } catch {
      return;
    }
  }, [card.projectId, uid]);

  useEffect(() => {
    if (!hasFirebaseClientConfig() || !uid) return;
    try {
      return onSnapshot(query(
        collection(getClientFirestore(), "reports"),
        where("reporterUid", "==", uid),
        where("projectId", "==", card.projectId),
        orderBy("updatedAt", "desc"),
      ), (snapshot) => {
        const receipts = Object.fromEntries(snapshot.docs.map((item) => {
          const data = item.data();
          return [item.id, {
            id: item.id,
            targetType: String(data.targetType ?? "content"),
            targetId: String(data.targetId ?? ""),
            reason: (data.latestReason ?? "other") as ReportReason,
            status: (data.status ?? "open") as ReportStatus,
          } satisfies ReportReceipt];
        }));
        setReportReceipts(receipts);
        setReportIds(Object.keys(receipts));
      });
    } catch {
      return;
    }
  }, [card.projectId, uid]);

  const action = async (key: string, work: () => Promise<string>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      setNotice(await work());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That request could not be saved.");
    } finally {
      setBusy(null);
    }
  };

  const submitEvidence = () => action("evidence", async () => {
    const result = await trustCommand<{ duplicate: boolean; status: string }>(
      `/api/projects/${card.projectId}/evidence-suggestions`,
      "POST",
      {
        url: evidenceUrl,
        ...(evidenceNote.trim() ? { note: evidenceNote.trim() } : {}),
        ...(proposeAsVideo ? { suggestedUse: "scout_card_video" } : {}),
      },
    );
    setEvidenceUrl("");
    setEvidenceNote("");
    setProposeAsVideo(false);
    return result.duplicate
      ? "That source is already in the project ledger or review queue."
      : "Evidence lead submitted for review.";
  });

  const submitClaim = () => action("claim", async () => {
    const result = await trustCommand<{ claimId: string }>(
      `/api/projects/${card.projectId}/claim-requests`,
      "POST",
      {
        role,
        ...(claimEmail.trim() ? { projectConnectedEmail: claimEmail.trim() } : {}),
        ...(proofUrl.trim() ? { publicProofUrl: proofUrl.trim() } : {}),
        ...(claimContext.trim() ? { context: claimContext.trim() } : {}),
      },
    );
    setClaim({ id: result.claimId, status: "pending" });
    return "Claim request submitted. It does not grant access until an administrator approves it.";
  });

  const submitReport = (target: { type: "project" | "evidence_suggestion" | "creator_update"; id: string }) =>
    action(`report-${target.type}-${target.id}`, async () => {
      const result = await trustCommand<{ reportId: string; status: ReportStatus }>("/api/reports", "POST", {
        target,
        reason: reportReason,
        ...(reportContext.trim() ? { context: reportContext.trim() } : {}),
      });
      setReportIds((current) => current.includes(result.reportId) ? current : [...current, result.reportId]);
      setReportReceipts((current) => ({ ...current, [result.reportId]: {
        id: result.reportId,
        targetType: target.type,
        targetId: target.id,
        reason: reportReason,
        status: result.status,
      } }));
      setReportContext("");
      return "Report received for human review. Reporting does not automatically hide content.";
    });

  const signedIn = Boolean(uid);
  const visibleClaim = signedIn ? claim : null;
  const canRequestClaim = liveClaimStatus !== "approved" && visibleClaim?.status !== "pending";

  return (
    <section className="scout-trust-panel" id="trust-and-ownership" aria-labelledby="trust-panel-title">
      <div className="section-heading-line">
        <div><span className="route-label">Community review lane</span><h2 id="trust-panel-title">Trust &amp; ownership</h2></div>
        <span>Auditable / project-scoped</span>
      </div>
      <p className="trust-intro">Community leads stay outside confidence scoring until a human review. Creator access changes only creator-owned fields and never rewrites the evidence record or audience history.</p>
      {!signedIn ? <p className="social-auth-note">Sign in to suggest, claim, or report. <Link href={signInHref(card.slug)}>Continue to sign in</Link></p> : null}

      <div className="trust-grid">
        <section className="trust-ticket" aria-labelledby="suggest-evidence-title">
          <span className="route-label">Suggest evidence</span>
          <h3 id="suggest-evidence-title">Add a public source</h3>
          <p>Every URL is safety-checked, deduplicated, and queued as a Community Lead. It cannot change this card before review.</p>
          <form onSubmit={(event) => { event.preventDefault(); void submitEvidence(); }}>
            <label>Public URL<input type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} required disabled={!signedIn || busy !== null} /></label>
            <label>Why it matters (optional)<textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} maxLength={1000} disabled={!signedIn || busy !== null} /></label>
            <label className="trust-checkbox"><input type="checkbox" checked={proposeAsVideo} onChange={(event) => setProposeAsVideo(event.target.checked)} disabled={!signedIn || busy !== null} />Propose this YouTube link as the Scout Card video after review</label>
            <p className="trust-form-note">A verified video publishes as a new immutable Scout Card version. It never silently rewrites the existing card.</p>
            <button type="submit" disabled={!signedIn || busy !== null}>Submit evidence lead</button>
          </form>
        </section>

        <section className="trust-ticket" aria-labelledby="claim-project-title">
          <span className="route-label">Claim state / {liveClaimStatus}</span>
          <h3 id="claim-project-title">Creator ownership</h3>
          {visibleClaim ? <p className="claim-receipt">Your request is <strong>{visibleClaim.status}</strong>. <Link href={`/claims/${visibleClaim.id}`}>View claim receipt</Link>.</p> : null}
          {liveClaimStatus === "approved" ? <p>This project has an approved creator. Approved managers can use the <Link href={`/projects/${card.slug}/manage`}>project update desk</Link>.</p> : null}
          {canRequestClaim ? <form onSubmit={(event) => { event.preventDefault(); void submitClaim(); }}>
            <label>Your project role<input value={role} onChange={(event) => setRole(event.target.value)} maxLength={80} required disabled={!signedIn || busy !== null} /></label>
            <label>Project-connected email<input type="email" value={claimEmail} onChange={(event) => setClaimEmail(event.target.value)} maxLength={320} disabled={!signedIn || busy !== null} /></label>
            <label>Or public professional link<input type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} maxLength={2000} disabled={!signedIn || busy !== null} /></label>
            <label>Context (optional)<textarea value={claimContext} onChange={(event) => setClaimContext(event.target.value)} maxLength={1000} disabled={!signedIn || busy !== null} /></label>
            <button type="submit" disabled={!signedIn || busy !== null}>Request to claim</button>
          </form> : null}
        </section>
      </div>

      <section className="community-leads" aria-labelledby="community-leads-title">
        <h3 id="community-leads-title">Community evidence leads</h3>
        {evidence.length ? <ul>{evidence.map((lead) => <li key={lead.id}>
          <div><a href={lead.url} target="_blank" rel="noreferrer">{lead.url}</a><strong>{evidenceLabels[lead.status ?? ""] ?? "Under review"}</strong></div>
          {lead.suggestedUse === "scout_card_video" ? <small>Proposed Scout Card video</small> : null}
          {lead.note ? <p>{lead.note}</p> : null}
          {lead.incorporatedSourceId ? <small>Source ledger link: {lead.incorporatedSourceId}</small> : <small>Separate from published confidence and claims.</small>}
          {signedIn ? <button type="button" disabled={busy !== null} onClick={() => void submitReport({ type: "evidence_suggestion", id: lead.id })}>Report lead</button> : null}
        </li>)}</ul> : <p>No community evidence leads have been published yet.</p>}
      </section>

      <section className="creator-update-ledger" aria-labelledby="creator-updates-title">
        <h3 id="creator-updates-title">Creator updates</h3>
        <p>Creator-authored notices are kept separate from research findings and native audience signals.</p>
        {updates.length ? <div>{updates.map((update) => <article key={update.id}>
          <span className="route-label">Creator update{update.demoLabel ? ` / ${update.demoLabel}` : ""}</span>
          <h4>{update.title}</h4><p>{update.body}</p>
          {update.media?.map((media) => media.url ? <img // eslint-disable-line @next/next/no-img-element
            key={media.id ?? media.url} src={media.url} alt="Creator-authorized update media" /> : null)}
          {signedIn ? <button type="button" disabled={busy !== null} onClick={() => void submitReport({ type: "creator_update", id: update.id })}>Report update</button> : null}
        </article>)}</div> : <p>No creator updates have been published.</p>}
      </section>

      <section className="correction-ledger" aria-labelledby="correction-history-title">
        <h3 id="correction-history-title">Update &amp; correction history</h3>
        <p>The published Scout Card remains an immutable research object. Material corrections name the earlier basis instead of silently replacing it.</p>
        <ol><li><strong>Initial research publication</strong><span>Card {initialPublishedCardVersionId} · research version {card.researchVersion}</span></li>{corrections.map((correction) => <li key={correction.id}><strong>{correction.section ?? "Project"} correction</strong><p>{correction.summary}</p><small>Prior basis: {correction.priorBasis}</small><span>{correction.toCardVersionId ? `Card ${correction.fromCardVersionId ?? correction.cardVersionId} → ${correction.toCardVersionId}` : `Card basis retained: ${correction.cardVersionId}`}</span></li>)}</ol>
      </section>

      <details className="report-desk">
        <summary>Report this project</summary>
        <p>Reports go to human review and do not automatically remove content.</p>
        <label>Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)} disabled={!signedIn || busy !== null}>
          <option value="spam">Spam</option><option value="impersonation">Impersonation</option><option value="copyright_privacy">Copyright or privacy</option><option value="harassment">Harassment</option><option value="misleading">Misleading</option><option value="other">Other</option>
        </select></label>
        <label>Context (optional)<textarea value={reportContext} onChange={(event) => setReportContext(event.target.value)} maxLength={1000} disabled={!signedIn || busy !== null} /></label>
        <button type="button" disabled={!signedIn || busy !== null} onClick={() => void submitReport({ type: "project", id: card.projectId })}>Send report</button>
        {reportIds.length ? <div className="report-receipts" aria-live="polite"><h4>Your report cases</h4><p>Status changes appear here during this signed-in session. Reports remain visible to you and do not automatically hide content.</p><ul>{reportIds.map((reportId) => {
          const receipt = reportReceipts[reportId];
          return <li key={reportId}><strong>{receipt?.targetType?.replaceAll("_", " ") ?? "content"}</strong><span>{receipt?.reason ?? "submitted"}</span><b>{receipt?.status ?? "open"}</b></li>;
        })}</ul></div> : null}
      </details>
      {notice ? <p className="trust-notice" role="status">{notice}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
