import { evidenceStatusLabel, sourcePresentation } from "./evidence-display";
import type { ScoutCard } from "./types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}

function relationshipLabel(card: ScoutCard): string {
  return {
    unresolved: "Relationship unresolved",
    source_aligned: "Aligned by public sources",
    creator_confirmed: "Creator confirmed",
    disputed: "Relationship disputed",
  }[card.identity?.relationshipStatus ?? "unresolved"];
}

function Unknown() {
  return <span className="decision-unknown">Unknown</span>;
}

export function DecisionBrief({ card }: { card: ScoutCard }) {
  const primaryWork = card.primaryWorkSourceId
    ? card.sourceLedger.find((source) => source.id === card.primaryWorkSourceId)
    : undefined;
  const nextQuestion = card.industryLens.unresolvedQuestions[0];
  const identityNeedsWork = !card.identity
    || card.identity.relationshipStatus === "unresolved"
    || card.identity.relationshipStatus === "disputed";
  const recommendedAction = identityNeedsWork || !primaryWork
    ? "Confirm the project identity and primary work source before evaluating format, financing, or market pathways."
    : nextQuestion;

  return (
    <section className="decision-brief" aria-labelledby="decision-brief-title">
      <div className="decision-brief-heading">
        <span>Professional triage / 60 seconds</span>
        <h2 id="decision-brief-title">Decision brief</h2>
        <p>Known facts, material gaps, and the next human follow-up—not an acquisition recommendation.</p>
      </div>
      <dl className="decision-identity">
        <div><dt>Entity</dt><dd><strong>{card.title}</strong><small>{relationshipLabel(card)}</small></dd></div>
        <div><dt>Primary work</dt><dd>{primaryWork ? <><strong>{primaryWork.title}</strong><small>{sourcePresentation(primaryWork).role} / {sourcePresentation(primaryWork).tier}</small></> : <Unknown />}</dd></div>
        <div><dt>Evidence level</dt><dd><strong>{evidenceStatusLabel(card)}</strong><small>Research retrieved {formatDate(card.provenance.researchedAt)}</small></dd></div>
      </dl>
      <div className="decision-stage">
        <h3>Stage &amp; availability</h3>
        <dl>
          <div><dt>Visible source format</dt><dd>{card.storyContext.currentFormat}</dd></div>
          <div><dt>Development stage</dt><dd><Unknown /></dd></div>
          <div><dt>Financing</dt><dd><Unknown /></dd></div>
          <div><dt>Attached partners</dt><dd><Unknown /></dd></div>
          <div><dt>Buyer / distribution</dt><dd><Unknown /></dd></div>
          <div><dt>Rights / representation</dt><dd>{card.claimStatus === "approved" ? "Creator claim approved; rights and representation remain unverified." : <Unknown />}</dd></div>
        </dl>
      </div>
      <aside className="decision-action">
        <span>Decision question</span>
        <strong>{nextQuestion}</strong>
        <span>Recommended next action</span>
        <p>{recommendedAction}</p>
        <a href="#trust-and-ownership">Review sources or submit evidence</a>
      </aside>
    </section>
  );
}
