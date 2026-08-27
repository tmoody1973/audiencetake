import { IndustryLens } from "../industry-lens/industry-lens";
import { citationText, createCitationLabels } from "./citation-labels";
import type { ScoutCard as ScoutCardModel } from "./types";
import { ScoutSocialPanel } from "../social/scout-social-panel";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function SourceMarks({ sourceIds, labels }: { sourceIds: string[]; labels: Map<string, string> }) {
  return <span className="citation-marks" aria-label={`Citations ${citationText(sourceIds, labels)}`}>{citationText(sourceIds, labels)}</span>;
}

function ScoutMedia({ card }: { card: ScoutCardModel }) {
  const { media } = card;
  if (media.state === "authorized_embed" && media.embedUrl) {
    return (
      <div className="scout-media-frame">
        <iframe
          src={media.embedUrl}
          title={media.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <p>{media.attribution}</p>
      </div>
    );
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

function CardStatus({ card }: { card: ScoutCardModel }) {
  if (card.fallbackUsed) {
    return <div className="card-state-banner card-state-fallback" role="status"><strong>Saved Scout Card</strong><span>{card.fallbackLabel}</span></div>;
  }
  if (card.completeness === "partial") {
    return <div className="card-state-banner card-state-partial" role="status"><strong>Partial Scout Card</strong><span>Published with named missing sections and retained limitations.</span></div>;
  }
  return null;
}

export function ScoutCard({ card }: { card: ScoutCardModel }) {
  if (card.pathways.length !== 3) throw new Error("A Scout Card requires exactly three pathways.");
  const sourceLabels = createCitationLabels(card.sourceLedger);

  return (
    <main className="scout-card-page paper-texture">
      <div className="scout-release-strip" aria-label={`${card.completeness} Scout Card`}>
        <strong>Scout Card — public summary ({card.completeness})<span className="tear-holes" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span></strong>
        <span className="tear-label">Scout Card tear-off<span className="tear-dashes" aria-hidden="true" /><i className="fold-wedge" aria-hidden="true" /></span>
        <span>AT—{card.cardVersionId.slice(-8).toUpperCase()}</span>
      </div>
      <CardStatus card={card} />

      <article className="scout-dossier" aria-labelledby="scout-card-title">
        <header className="scout-identity">
          <h1 id="scout-card-title">{card.title}</h1>
          <p>{card.submissionLabel}</p>
          <strong className="scout-completeness">{card.completeness} Scout Card</strong>
          <p className="scout-hook">{card.hook}</p>
          <dl className="scout-accession">
            <div><dt>Format</dt><dd>{card.projectType.replace("_", " ")}</dd></div>
            <div><dt>Claim</dt><dd>{card.claimStatus}</dd></div>
            <div><dt>Published</dt><dd>{formatDate(card.publishedAt)}</dd></div>
          </dl>
        </header>

        <section className="scout-overview" aria-label="Submitted media and scouting summary">
          <ScoutMedia card={card} />
          <div className="scout-summary">
            <h2>Scouting summary</h2>
            <p>{card.storyContext.summary}</p>
            <dl>
              <div><dt>Current format</dt><dd>{card.storyContext.currentFormat}</dd></div>
              <div><dt>Storyworld</dt><dd>{card.storyContext.storyworld}</dd></div>
              <div><dt>Source basis</dt><dd>{card.provenance.nominationLabel}</dd></div>
            </dl>
            <div className="theme-list" aria-label="Story themes">{card.storyContext.themes.map((theme) => <span key={theme}>{theme}</span>)}</div>
          </div>
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
                    <div><dt>Confidence</dt><dd>{pathway.confidence}</dd></div>
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

      <IndustryLens card={card} />
      <ScoutSocialPanel card={card} />

      <section className="evidence-section" aria-labelledby="evidence-title">
        <div className="section-heading-line"><h2 id="evidence-title">Evidence &amp; citations</h2><span>Claims stay qualified</span></div>
        <div className="evidence-grid">
          <div className="claim-ledger">
            <h3>Claim ledger</h3>
            {card.evidenceClaims.map((claim) => (
              <article key={claim.id}>
                <span className={`claim-status claim-status-${claim.status}`}>{claim.status}</span>
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
                  <div><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p><span className={`source-origin source-origin-${source.origin}`}>{source.origin.replace("_", " ")}</span> {source.verificationStatus} / {source.availability}</p><small>Retrieved {formatDate(source.retrievedAt)}</small></div>
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
