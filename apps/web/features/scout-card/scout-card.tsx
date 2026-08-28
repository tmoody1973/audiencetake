import { IndustryLens } from "../industry-lens/industry-lens";
import { citationText, createCitationLabels } from "./citation-labels";
import { DecisionBrief } from "./decision-brief";
import {
  claimEvidenceState,
  evidenceStateLabel,
  evidenceStatusLabel,
  sourcePresentation,
  structureStatus,
} from "./evidence-display";
import type { ScoutCard as ScoutCardModel } from "./types";
import { ScoutSocialPanel } from "../social/scout-social-panel";
import { ScoutTrustPanel } from "../trust/scout-trust-panel";
import { SourceVideoCarousel } from "./source-video-carousel";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function SourceMarks({ sourceIds, labels }: { sourceIds: string[]; labels: Map<string, string> }) {
  return <span className="citation-marks" aria-label={`Citations ${citationText(sourceIds, labels)}`}>{citationText(sourceIds, labels)}</span>;
}

function ScoutMediaContent({ card }: { card: ScoutCardModel }) {
  const { media } = card;
  if (media.state === "authorized_embed" && media.embedUrl) {
    return <SourceVideoCarousel card={card} />;
  }
  if (media.state === "authorized_image" && media.imageUrl) {
    return <figure className="scout-media-frame">{/* The authorized source URL is contract data and cannot be constrained to Next Image remote patterns. */}<img // eslint-disable-line @next/next/no-img-element
      src={media.imageUrl} alt={media.title} /><figcaption>{media.attribution}</figcaption></figure>;
  }
  return (
    <div className="scout-media-unavailable" role="img" aria-label={media.title}>
      <span>Media state / {media.state.replace("_", " ")}</span>
      <strong>{media.accessibleFallback}</strong>
      <p>{media.attribution}</p>
    </div>
  );
}

function ScoutMedia({ card }: { card: ScoutCardModel }) {
  return (
    <section className="scout-start-here" aria-labelledby="start-here-title">
      <div className="scout-start-here-heading">
        <span>Start here / source media</span>
        <h2 id="start-here-title">Watch before you judge</h2>
      </div>
      <ScoutMediaContent card={card} />
    </section>
  );
}

function claimSourceIds(card: ScoutCardModel, claimIds: string[]): string[] {
  return [...new Set(claimIds.flatMap(
    (claimId) => card.evidenceClaims.find((claim) => claim.id === claimId)?.sourceIds ?? [],
  ))];
}

function EvidenceBrief({ card, sourceLabels }: { card: ScoutCardModel; sourceLabels: Map<string, string> }) {
  const knownClaims = card.evidenceClaims.filter((claim) => (
    claimEvidenceState(claim, card.sourceLedger) !== "unknown"
  )).slice(0, 2);
  const checking = card.industryLens.unresolvedQuestions.slice(0, 2);
  const observationSourceIds = claimSourceIds(card, card.storyContext.claimIds);
  const hooks = card.storyContext.audienceHooks.slice(0, 3);
  const activeQuestion = checking[0] ?? card.limitations[0];

  return (
    <div className="scout-summary evidence-brief">
      <div className="evidence-brief-block">
        <h2>What we know</h2>
        {knownClaims.length ? <ul>{knownClaims.map((claim) => {
          const state = claimEvidenceState(claim, card.sourceLedger);
          return <li key={claim.id}><span className={`evidence-state evidence-state-${state}`}>{evidenceStateLabel(state)}</span><p>{claim.statement} <SourceMarks sourceIds={claim.sourceIds} labels={sourceLabels} /></p></li>;
        })}</ul> : <p>No public claim has enough usable source support yet.</p>}
      </div>
      <div className="evidence-brief-block evidence-checking">
        <h3>What we&apos;re checking</h3>
        <ul>{checking.map((question) => <li key={question}>{question}</li>)}</ul>
      </div>
      <div className="why-scouted">
        <h3>Why this is being scouted</h3>
        <ol>{hooks.map((hook) => <li key={hook}><span className="evidence-state evidence-state-inferred">Inferred</span><p>{hook} <SourceMarks sourceIds={observationSourceIds} labels={sourceLabels} /></p></li>)}</ol>
      </div>
      <aside className="active-question" aria-label="Active community question">
        <span>Open question</span>
        <strong>{activeQuestion}</strong>
        <a href="#audience-pulse">Add your informed Take</a>
      </aside>
    </div>
  );
}

function readinessLabel(confidence: ScoutCardModel["pathways"][number]["confidence"]): string {
  return {
    low: "Early evidence basis",
    medium: "Developing evidence basis",
    high: "Stronger evidence basis",
  }[confidence];
}

function CardStatus({ card }: { card: ScoutCardModel }) {
  if (card.fallbackUsed) {
    return <div className="card-state-banner card-state-fallback" role="status"><strong>Saved Scout Card</strong><span>{card.fallbackLabel}</span></div>;
  }
  if (card.completeness === "partial") {
    return <div className="card-state-banner card-state-partial" role="status"><strong>Partial Scout Card</strong><span>Published with named missing sections and retained limitations.</span></div>;
  }
  return null;
}

function TrailerCritic({ card, sourceLabels }: { card: ScoutCardModel; sourceLabels: Map<string, string> }) {
  const analyses = card.trailerCritiques ?? [];
  if (!analyses.length) return null;
  return (
    <section className="trailer-critic" aria-labelledby="trailer-critic-title">
      <div className="section-heading-line trailer-critic-heading">
        <div><span>Gemini video reading / sampled audiovisual analysis</span><h2 id="trailer-critic-title">Trailer critic</h2></div>
        <strong>{analyses.length} {analyses.length === 1 ? "video" : "videos"} analyzed</strong>
      </div>
      {analyses.map((analysis, analysisIndex) => (
        <article key={analysis.artifactId} className="trailer-critic-artifact">
          <header>
            <span>{String(analysisIndex + 1).padStart(2, "0")} / source video</span>
            <a href={analysis.youtubeUrl} target="_blank" rel="noreferrer">Open analyzed video</a>
            <small>Model {analysis.modelId} / version {analysis.analysisVersion} / {formatDate(analysis.analyzedAt)}</small>
          </header>
          <div className="trailer-critic-grid">
            <section>
              <h3>Structural &amp; narrative</h3>
              <dl>
                <div><dt>Genre signaling</dt><dd>{analysis.structuralNarrative.genreSignaling}</dd></div>
                <div><dt>Narrative delivery</dt><dd>{analysis.structuralNarrative.narrativeDelivery}</dd></div>
                <div><dt>Trailer type</dt><dd>{analysis.structuralNarrative.trailerType}</dd></div>
              </dl>
              <ol className="trailer-beats">{analysis.structuralNarrative.beats.map((beat) => <li key={`${beat.start}-${beat.end}-${beat.label}`}><span>{beat.start}–{beat.end}</span><div><strong>{beat.label}</strong><p>{beat.observation}</p><small>{beat.modality}</small></div></li>)}</ol>
            </section>
            <section>
              <h3>Technical craft</h3>
              <dl>
                <div><dt>Editing &amp; pace</dt><dd>{analysis.technicalCraft.editingAndPace}</dd></div>
                <div><dt>Cinematography</dt><dd>{analysis.technicalCraft.cinematographyAndFraming}</dd></div>
                <div><dt>Sound &amp; score</dt><dd>{analysis.technicalCraft.soundAndScore}</dd></div>
                <div><dt>Graphics &amp; titles</dt><dd>{analysis.technicalCraft.graphicsAndTitles}</dd></div>
              </dl>
            </section>
            <section>
              <h3>Marketing &amp; persuasion</h3>
              <dl>
                <div><dt>USP</dt><dd>{analysis.marketingPersuasion.uniqueSellingProposition}</dd></div>
                <div><dt>Audience hypothesis</dt><dd>{analysis.marketingPersuasion.targetAudienceHypothesis}</dd></div>
                <div><dt>Concept vs. star</dt><dd>{analysis.marketingPersuasion.conceptVsStarEmphasis}</dd></div>
                <div><dt>Representation caveat</dt><dd>{analysis.marketingPersuasion.representationCaveat}</dd></div>
              </dl>
            </section>
            <section>
              <h3>Emotional &amp; rhetorical</h3>
              <dl>
                <div><dt>Emotional hook</dt><dd>{analysis.emotionalRhetorical.emotionalHook}</dd></div>
                <div><dt>Tone &amp; mood</dt><dd>{analysis.emotionalRhetorical.toneAndMoodBalance}</dd></div>
                <div><dt>Argument</dt><dd>{analysis.emotionalRhetorical.persuasiveArgument}</dd></div>
              </dl>
            </section>
          </div>
          <div className="critic-matrix">
            <h3>Critic&apos;s breakdown matrix</h3>
            <dl>{analysis.matrix.map((row) => <div key={row.category}><dt>{row.category.replaceAll("_", " / ")}</dt><dd>{row.analysis}</dd></div>)}</dl>
          </div>
          <footer>
            <div><strong>Analysis limits</strong><ul>{analysis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>
            {analysis.sourceIds.length ? <p>Public context citations <SourceMarks sourceIds={analysis.sourceIds} labels={sourceLabels} /></p> : <p>Audiovisual observations are grounded by timestamps; no additional card facts were imported.</p>}
          </footer>
        </article>
      ))}
    </section>
  );
}

export function ScoutCard({ card }: { card: ScoutCardModel }) {
  if (card.pathways.length !== 3) throw new Error("A Scout Card requires exactly three pathways.");
  const sourceLabels = createCitationLabels(card.sourceLedger);
  const cardStructureStatus = structureStatus(card);
  const cardEvidenceLabel = evidenceStatusLabel(card);

  return (
    <main className="scout-card-page paper-texture">
      <div className="scout-release-strip" aria-label={`${cardStructureStatus} structure; ${cardEvidenceLabel}`}>
        <strong>Scout Card — public evidence summary<span className="tear-holes" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span></strong>
        <span className="tear-label">Scout Card tear-off<span className="tear-dashes" aria-hidden="true" /><i className="fold-wedge" aria-hidden="true" /></span>
        <span>AT—{card.cardVersionId.slice(-8).toUpperCase()}</span>
      </div>
      <CardStatus card={card} />

      <article className="scout-dossier" aria-labelledby="scout-card-title">
        <header className="scout-identity">
          <h1 id="scout-card-title">{card.title}</h1>
          <p>{card.submissionLabel}</p>
          <div className="scout-status-stack" aria-label="Scout Card status">
            <span><small>Structure</small><strong>{cardStructureStatus}</strong></span>
            <span><small>Evidence</small><strong>{cardEvidenceLabel}</strong></span>
          </div>
          {card.identity?.relationshipStatus === "unresolved" ? <p className="identity-caution">Identity relationship remains unresolved; similar names are not silently merged.</p> : null}
          <p className="scout-hook">{card.hook}</p>
          <dl className="scout-accession">
            <div><dt>Format</dt><dd>{card.projectType.replace("_", " ")}</dd></div>
            <div><dt>Claim</dt><dd>{card.claimStatus}</dd></div>
            <div><dt>Published</dt><dd>{formatDate(card.publishedAt)}</dd></div>
          </dl>
        </header>

        <section className="scout-overview" aria-label="Submitted media and scouting summary">
          <ScoutMedia card={card} />
          <EvidenceBrief card={card} sourceLabels={sourceLabels} />
        </section>

        <section className="pathway-hypotheses" aria-labelledby="pathway-title">
          <div className="section-heading-line"><h2 id="pathway-title">Pathway hypotheses</h2><span>Exactly three / bounded</span></div>
          <ol>
            {card.pathways.map((pathway) => (
              <li key={pathway.id}>
                <span className="pathway-number">{String(pathway.order).padStart(2, "0")}</span>
                <div>
                  <h3>{pathway.label}</h3>
                  <p>{pathway.rationale}</p>
                  <dl>
                    <div><dt>Format</dt><dd>{pathway.format}</dd></div>
                    <div><dt>Audience</dt><dd>{pathway.audience}</dd></div>
                    <div><dt>Evidence</dt><dd><span className="source-origin source-origin-inference">Inference</span> <SourceMarks sourceIds={pathway.supportingClaimIds.flatMap((claimId) => card.evidenceClaims.find((claim) => claim.id === claimId)?.sourceIds ?? [])} labels={sourceLabels} /></dd></div>
                    <div><dt>Evidence readiness</dt><dd>{readinessLabel(pathway.confidence)}</dd></div>
                  </dl>
                  <p className="pathway-experiment"><strong>Next experiment:</strong> {pathway.nextExperiment.title} / {pathway.nextExperiment.timebox}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="scout-stub" aria-label="Scout Card accession stub">
          <span>{card.cardVersionId}</span><strong>{card.title}</strong><small>Scout Card</small>
        </aside>
      </article>

      <TrailerCritic card={card} sourceLabels={sourceLabels} />

      <DecisionBrief card={card} />
      <ScoutSocialPanel card={card} />
      <IndustryLens card={card} />
      <ScoutTrustPanel card={card} />

      <section className="evidence-section" aria-labelledby="evidence-title">
        <div className="section-heading-line"><h2 id="evidence-title">Evidence &amp; citations</h2><span>Claims stay qualified</span></div>
        <div className="evidence-grid">
          <div className="claim-ledger">
            <h3>Claim ledger</h3>
            {card.evidenceClaims.map((claim) => (
              <article key={claim.id}>
                <span className={`evidence-state evidence-state-${claimEvidenceState(claim, card.sourceLedger)}`}>{evidenceStateLabel(claimEvidenceState(claim, card.sourceLedger))}</span>
                <p>{claim.statement} <SourceMarks sourceIds={claim.sourceIds} labels={sourceLabels} /></p>
                {claim.qualification ? <small>{claim.qualification}</small> : null}
              </article>
            ))}
          </div>
          <div className="source-ledger-public">
            <h3>Source ledger</h3>
            <ol>
              {card.sourceLedger.map((source) => (
                <li key={source.id}>
                  <span className="source-index">{sourceLabels.get(source.id)}</span>
                  <div><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{sourcePresentation(source).role} / {sourcePresentation(source).tier} / {source.availability}</p><small>Retrieved {formatDate(source.retrievedAt)}</small></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="external-signals" aria-labelledby="signals-title">
        <div><h2 id="signals-title">External signals</h2><p>Public-web observations remain separate from Audience Take-native participation.</p></div>
        {card.externalSignals.length ? <ul>{card.externalSignals.map((signal) => <li key={signal.label}><strong>{signal.label}</strong><p>{signal.analysis}</p><small>Not an Audience Take-native count.</small></li>)}</ul> : <p className="signals-empty">No external signals were included in this Scout Card. No native audience count is claimed.</p>}
      </section>

      <section className="scout-limitations" aria-labelledby="limitations-title">
        <h2 id="limitations-title">What this card cannot establish</h2>
        <ul>{card.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        {card.missingSections.length ? <div><strong>Missing sections</strong><p>{card.missingSections.map((item) => item.replaceAll("_", " ")).join(" / ")}</p></div> : null}
      </section>
    </main>
  );
}
