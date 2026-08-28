import type { TrailerCriticAnalysis } from "./types";
import { TrailerCritic, type TrailerCriticState } from "./trailer-critic";

const previewStates: TrailerCriticState[] = [
  "default",
  "hover",
  "focus",
  "active",
  "disabled",
  "loading",
  "error",
  "success",
];

export function TrailerCriticPreview({
  analysis,
  sourceLabels,
}: {
  analysis: TrailerCriticAnalysis;
  sourceLabels: Map<string, string>;
}) {
  return (
    <main className="trailer-critic-preview" aria-label="Trailer Critic interaction states">
      <h1>Trailer Critic — eight states</h1>
      {previewStates.map((state) => (
        <section key={state} aria-labelledby={`trailer-critic-preview-${state}-label`}>
          <h2 id={`trailer-critic-preview-${state}-label`}>{state}</h2>
          <TrailerCritic
            analyses={[analysis]}
            sourceLabels={sourceLabels}
            idPrefix={`trailer-critic-preview-${state}`}
            previewState={state}
          />
        </section>
      ))}
    </main>
  );
}
