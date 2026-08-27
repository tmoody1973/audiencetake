"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { getClientFirestore } from "../../lib/firebase/client";
import { hasFirebaseClientConfig } from "../../lib/firebase/config";
import {
  localJunichiroDemo,
  RESEARCH_STAGES,
  stageState,
  subscribeToPublicResearch,
  type ResearchSnapshot,
  type StageState,
} from "../../lib/research/public-research";

type LoadState =
  | { kind: "loading"; snapshot: ResearchSnapshot }
  | { kind: "ready"; snapshot: ResearchSnapshot }
  | { kind: "empty"; snapshot: ResearchSnapshot }
  | { kind: "error"; snapshot: ResearchSnapshot };

const stateCopy: Record<StageState, string> = {
  waiting: "Waiting",
  active: "In progress",
  complete: "Complete",
  incomplete: "Incomplete",
  failed: "Failed",
};

const receiptKindLabels: Record<string, string> = {
  stage: "Stage log",
  tool_receipt: "Tool receipts",
  source_receipt: "Source receipts",
  warning: "Warnings",
  publication: "Publication",
};

function receiptKindLabel(kind: string): string {
  return receiptKindLabels[kind] ?? kind.replaceAll("_", " ");
}

function statusHeadline(snapshot: ResearchSnapshot): string {
  if (snapshot.mode === "demo") return "Local demo projection";
  switch (snapshot.run.status) {
    case "complete": return "Scouting complete";
    case "partial": return "Partial card published";
    case "failed": return "Research needs attention";
    case "running": return "Live scouting run";
    default: return "Research is queued";
  }
}

function ReceiptIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}

function stageVisual(stage: number) {
  return <div className={`stage-art stage-art-${stage}`} aria-hidden="true"><span /><span /><span /><b>{stage === 3 ? "Parallel" : stage === 6 ? "Scout card" : RESEARCH_STAGES[stage - 1].id.replace("-", " ")}</b></div>;
}

function handleFilmstripKeyDown(event: KeyboardEvent<HTMLOListElement>) {
  const filmstrip = event.currentTarget;
  const firstFrame = filmstrip.querySelector<HTMLElement>(".research-frame");
  const frameAdvance = firstFrame?.offsetWidth || Math.max(filmstrip.clientWidth * 0.82, 1);
  let nextPosition: number | null = null;
  if (event.key === "ArrowRight") nextPosition = filmstrip.scrollLeft + frameAdvance;
  if (event.key === "ArrowLeft") nextPosition = filmstrip.scrollLeft - frameAdvance;
  if (event.key === "Home") nextPosition = 0;
  if (event.key === "End") nextPosition = filmstrip.scrollWidth - filmstrip.clientWidth;
  if (nextPosition === null) return;
  event.preventDefault();
  filmstrip.scrollLeft = Math.max(0, Math.min(nextPosition, filmstrip.scrollWidth - filmstrip.clientWidth));
}

export function ResearchProgress({ runId }: { runId: string }) {
  const demo = useMemo(() => localJunichiroDemo(), []);
  const firebaseAvailable = hasFirebaseClientConfig();
  const [loadState, setLoadState] = useState<LoadState>(firebaseAvailable ? { kind: "loading", snapshot: demo } : { kind: "empty", snapshot: demo });
  const filmstripRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!firebaseAvailable) return;
    let received = false;
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToPublicResearch(
        getClientFirestore(),
        runId,
        (snapshot) => {
          received = true;
          setLoadState(snapshot ? { kind: "ready", snapshot } : { kind: "empty", snapshot: demo });
        },
        () => setLoadState({ kind: "error", snapshot: demo }),
      );
    } catch {
      window.setTimeout(() => setLoadState({ kind: "error", snapshot: demo }), 0);
    }
    const fallbackTimer = window.setTimeout(() => {
      if (!received) setLoadState({ kind: "error", snapshot: demo });
    }, 8_000);
    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [demo, firebaseAvailable, runId]);

  const { snapshot } = loadState;
  const run = snapshot.run;
  const currentStage = Math.min(6, Math.max(1, run.currentStage));
  const announcement = `${statusHeadline(snapshot)}. Stage ${currentStage} of 6: ${RESEARCH_STAGES[currentStage - 1].label}.`;
  const hasCard = (run.status === "complete" || run.status === "partial") && Boolean(run.cardUrl);
  const receiptCategories = [...new Set(snapshot.events.map((event) => event.kind))];

  useEffect(() => {
    const restoreActiveFrame = () => {
      const filmstrip = filmstripRef.current;
      if (!filmstrip || typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 760px)").matches) return;
      const active = filmstrip.querySelector<HTMLElement>("[aria-current='step']");
      if (!active) return;
      filmstrip.scrollLeft = active.offsetLeft - (filmstrip.clientWidth - active.clientWidth) / 2;
    };
    // Wait one painted frame so responsive widths and scroll-snap points are
    // resolved before restoring the durable stage position.
    const frame = window.requestAnimationFrame(restoreActiveFrame);
    window.addEventListener("resize", restoreActiveFrame);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", restoreActiveFrame);
    };
  }, [currentStage]);

  return (
    <main className="research-page paper-texture" data-current-stage={currentStage}>
      <div className="research-announcement sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      <section className="research-banner" aria-labelledby="research-title">
        <div>
          <h1 id="research-title">{snapshot.mode === "demo" ? "Live scouting run" : statusHeadline(snapshot)}</h1>
        </div>
        <div className="research-banner-status">
          <strong>{statusHeadline(snapshot)}</strong>
          <span>Run {runId.slice(0, 18)}</span>
          <p>Public. Traceable. Useful.</p>
        </div>
      </section>

      {snapshot.mode === "demo" ? (
        <div className="demo-disclosure" role="status">
          <strong>Local Junichiro demonstration</strong>
          <span>Firebase configuration or run data is unavailable. This labeled projection demonstrates the interface only; it does not claim a completed provider result.</span>
        </div>
      ) : loadState.kind === "loading" ? (
        <div className="demo-disclosure" role="status"><strong>Loading saved run</strong><span>Restoring the latest public projection and receipts.</span></div>
      ) : null}

      <div className="research-workbench">
        <section className="filmstrip-region" aria-labelledby="stages-title">
          <h2 id="stages-title" className="sr-only">Six research stages</h2>
          <p id="filmstrip-instructions" className="sr-only">Horizontal research filmstrip. Use Left and Right Arrow keys to move one stage, or Home and End to reach the first or last stage.</p>
          <div className="film-perforations" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <i key={index} />)}</div>
          <ol ref={filmstripRef} className="research-filmstrip" tabIndex={0} aria-label="Research stages filmstrip" aria-describedby="filmstrip-instructions" onKeyDown={handleFilmstripKeyDown} style={{ "--current-stage": currentStage } as React.CSSProperties}>
            {RESEARCH_STAGES.map((stage, index) => {
              const number = index + 1;
              const state = stageState(run, number);
              return (
                <li key={stage.id} className="research-frame" data-state={state} aria-current={state === "active" ? "step" : undefined}>
                  <div className="frame-heading"><span>{String(number).padStart(2, "0")}</span><h3>{stage.label}</h3></div>
                  {stageVisual(number)}
                  <p>{stage.summary}</p>
                  <strong className="stage-stamp">{stateCopy[state]}</strong>
                  {state === "active" && number === 3 ? <div className="parallel-chase" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div> : null}
                </li>
              );
            })}
          </ol>
          <div className="film-progress" aria-hidden="true"><span style={{ transform: `translateX(${(currentStage - 1) * 100}%)` }} /></div>
        </section>

        <aside className="receipt-ledger" aria-labelledby="receipts-title">
          {receiptCategories.length ? <ul className="receipt-category-spine" aria-label="Receipt categories present in this run">{receiptCategories.map((kind) => <li key={kind}>{receiptKindLabel(kind)}</li>)}</ul> : null}
          <div className="receipt-ledger-content">
            <div className="ledger-heading"><h2 id="receipts-title">Public receipts</h2><ReceiptIcon /></div>
            <p className="ledger-policy">Safe source and tool receipts only. No prompts, private data, or hidden reasoning.</p>
            {snapshot.events.length ? (
              <ol className="receipt-list">
                {snapshot.events.map((event) => (
                  <li key={event.id}>
                    <div><span>{String(event.sequence).padStart(2, "0")}</span><strong>{event.title}</strong></div>
                    <p>{event.summary}</p>
                    <dl>
                      <div><dt>Stage</dt><dd>{String(event.stage).padStart(2, "0")} — {RESEARCH_STAGES[event.stage - 1]?.label ?? "Research"}</dd></div>
                      {event.toolName ? <div><dt>Source/tool</dt><dd>{event.toolName}</dd></div> : null}
                      {event.queryLabel ? <div><dt>Receipt</dt><dd>{event.queryLabel}</dd></div> : null}
                    </dl>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="receipt-empty"><strong>No public receipts yet</strong><p>The ledger will update when the worker publishes its first safe event.</p></div>
            )}
            {run.publicFailureMessage ? <div className="research-failure" role="alert"><strong>{run.retryEligible ? "Automatic retry eligible" : "Research interrupted"}</strong><p>{run.publicFailureMessage}</p>{run.retryEligible ? <button type="button" onClick={() => window.location.reload()}>Check retry status</button> : null}</div> : null}
          </div>
        </aside>
      </div>

      <section className="card-destination" aria-labelledby="destination-title">
        <span className="destination-code">AT—{runId.slice(-4).toUpperCase()}</span>
        <div>
          <h2 id="destination-title">Completion destination</h2>
          <p>{hasCard ? (run.status === "partial" ? "A clearly labeled Partial Scout Card is ready to inspect." : "The cited Scout Card is ready to inspect.") : "Your Scout Card will tear off here after complete or honestly partial publication."}</p>
        </div>
        {hasCard && run.cardUrl ? <Link className="card-tearoff-action" href={run.cardUrl}>View Scout Card <ArrowIcon /></Link> : <span className="card-tearoff-waiting">Scout Card<br />releases here</span>}
      </section>
    </main>
  );
}
