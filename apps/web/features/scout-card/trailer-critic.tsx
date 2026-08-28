/* Hallmark · post-browser critique: P5 H5 E4 S5 R5 V5 */
/* Hallmark · component: Trailer Critic disclosure · genre: editorial · theme: Audience Take / Public Scouting Program
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass; locked project ink/paper and accent pairs
 */

import { citationText } from "./citation-labels";
import type { TrailerCriticAnalysis } from "./types";

export type TrailerCriticState =
  | "default"
  | "hover"
  | "focus"
  | "active"
  | "disabled"
  | "loading"
  | "error"
  | "success";

type TrailerCriticProps = {
  analyses: TrailerCriticAnalysis[];
  sourceLabels: Map<string, string>;
  idPrefix?: string;
  previewState?: TrailerCriticState;
};

const stateMessages: Partial<Record<TrailerCriticState, string>> = {
  loading: "Loading critique",
  error: "Analysis unavailable",
  success: "Analysis ready",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function SourceMarks({ sourceIds, labels }: { sourceIds: string[]; labels: Map<string, string> }) {
  const text = citationText(sourceIds, labels);
  return <span className="citation-marks" aria-label={`Citations ${text}`}>{text}</span>;
}

function compact(value: string, limit = 132): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;
  const bounded = normalized.slice(0, limit + 1).replace(/\s+\S*$/, "");
  return `${bounded || normalized.slice(0, limit)}…`;
}

function matrixValue(analysis: TrailerCriticAnalysis, category: TrailerCriticAnalysis["matrix"][number]["category"]): string {
  return analysis.matrix.find((row) => row.category === category)?.analysis ?? "Not stated in this analysis.";
}

function ScanItem({ label, value }: { label: string; value: string }) {
  return <span className="trailer-critic-scan-item"><small>{label}</small><strong>{compact(value)}</strong></span>;
}

export function TrailerCritic({
  analyses,
  sourceLabels,
  idPrefix = "trailer-critic",
  previewState = "default",
}: TrailerCriticProps) {
  if (!analyses.length) return null;
  const stateMessage = stateMessages[previewState];

  return (
    <section className="trailer-critic" aria-labelledby={`${idPrefix}-title`} data-state={previewState}>
      <header className="section-heading-line trailer-critic-heading">
        <div>
          <span>Gemini video reading / sampled audiovisual analysis</span>
          <h2 id={`${idPrefix}-title`}>Trailer critic</h2>
        </div>
        <strong>{analyses.length} {analyses.length === 1 ? "video" : "videos"} analyzed</strong>
      </header>

      <div className="trailer-critic-list">
        {analyses.map((analysis, analysisIndex) => {
          const disabled = previewState === "disabled";
          const previewClass = ["hover", "focus", "active"].includes(previewState)
            ? `is-${previewState}`
            : undefined;
          return (
            <details
              key={analysis.artifactId}
              className={`trailer-critic-artifact${previewClass ? ` ${previewClass}` : ""}`}
              data-state={previewState}
              aria-busy={previewState === "loading" || undefined}
            >
              <summary aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}>
                <span className="trailer-critic-number">{String(analysisIndex + 1).padStart(2, "0")}</span>
                <span className="trailer-critic-summary-copy">
                  <span className="trailer-critic-summary-kicker">Critic read / source video</span>
                  <span className="trailer-critic-scan">
                    <ScanItem label="Genre" value={matrixValue(analysis, "genre")} />
                    <ScanItem label="Form" value={analysis.structuralNarrative.trailerType} />
                    <ScanItem label="Why it may connect" value={analysis.emotionalRhetorical.emotionalHook} />
                  </span>
                </span>
                <span className="trailer-critic-toggle" aria-hidden="true">
                  <span className="trailer-critic-toggle-open">Show full analysis</span>
                  <span className="trailer-critic-toggle-close">Close analysis</span>
                  <b>+</b>
                </span>
                {stateMessage ? <span className="trailer-critic-state-label" role="status">{stateMessage}</span> : null}
              </summary>

              <div className="trailer-critic-body">
                <div className="trailer-critic-meta">
                  <span>Source video {String(analysisIndex + 1).padStart(2, "0")}</span>
                  <a href={analysis.youtubeUrl} target="_blank" rel="noreferrer">Open analyzed video</a>
                  <small>Model {analysis.modelId} / version {analysis.analysisVersion} / {formatDate(analysis.analyzedAt)}</small>
                </div>

                <div className="trailer-critic-grid">
                  <section className="trailer-critic-structure">
                    <h3>Structural &amp; narrative</h3>
                    <dl>
                      <div><dt>Genre signaling</dt><dd>{analysis.structuralNarrative.genreSignaling}</dd></div>
                      <div><dt>Narrative delivery</dt><dd>{analysis.structuralNarrative.narrativeDelivery}</dd></div>
                      <div><dt>Trailer type</dt><dd>{analysis.structuralNarrative.trailerType}</dd></div>
                    </dl>
                    <ol className="trailer-beats">
                      {analysis.structuralNarrative.beats.map((beat) => (
                        <li key={`${beat.start}-${beat.end}-${beat.label}`}>
                          <span>{beat.start}–{beat.end}</span>
                          <div><strong>{beat.label}</strong><p>{beat.observation}</p><small>{beat.modality}</small></div>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section className="trailer-critic-craft">
                    <h3>Technical craft</h3>
                    <dl>
                      <div><dt>Editing &amp; pace</dt><dd>{analysis.technicalCraft.editingAndPace}</dd></div>
                      <div><dt>Cinematography</dt><dd>{analysis.technicalCraft.cinematographyAndFraming}</dd></div>
                      <div><dt>Sound &amp; score</dt><dd>{analysis.technicalCraft.soundAndScore}</dd></div>
                      <div><dt>Graphics &amp; titles</dt><dd>{analysis.technicalCraft.graphicsAndTitles}</dd></div>
                    </dl>
                  </section>

                  <section className="trailer-critic-emotion">
                    <h3>Emotional &amp; rhetorical</h3>
                    <dl>
                      <div><dt>Emotional hook</dt><dd>{analysis.emotionalRhetorical.emotionalHook}</dd></div>
                      <div><dt>Tone &amp; mood</dt><dd>{analysis.emotionalRhetorical.toneAndMoodBalance}</dd></div>
                      <div><dt>Argument</dt><dd>{analysis.emotionalRhetorical.persuasiveArgument}</dd></div>
                    </dl>
                  </section>

                  <section className="trailer-critic-marketing">
                    <h3>Marketing &amp; persuasion</h3>
                    <dl>
                      <div><dt>USP</dt><dd>{analysis.marketingPersuasion.uniqueSellingProposition}</dd></div>
                      <div><dt>Audience hypothesis</dt><dd>{analysis.marketingPersuasion.targetAudienceHypothesis}</dd></div>
                      <div><dt>Concept vs. star</dt><dd>{analysis.marketingPersuasion.conceptVsStarEmphasis}</dd></div>
                      <div><dt>Representation caveat</dt><dd>{analysis.marketingPersuasion.representationCaveat}</dd></div>
                    </dl>
                  </section>
                </div>

                <section className="critic-matrix" aria-labelledby={`${idPrefix}-${analysisIndex}-matrix-title`}>
                  <h3 id={`${idPrefix}-${analysisIndex}-matrix-title`}>Critic&apos;s breakdown matrix</h3>
                  <dl>{analysis.matrix.map((row) => <div key={row.category}><dt>{row.category.replaceAll("_", " / ")}</dt><dd>{row.analysis}</dd></div>)}</dl>
                </section>

                <footer>
                  <div><strong>Analysis limits</strong><ul>{analysis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>
                  {analysis.sourceIds.length
                    ? <p>Public context citations <SourceMarks sourceIds={analysis.sourceIds} labels={sourceLabels} /></p>
                    : <p>Audiovisual observations are grounded by timestamps; no additional card facts were imported.</p>}
                </footer>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
