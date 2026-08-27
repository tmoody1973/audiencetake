# Shared contracts

JSON Schema files in `schemas/` are the canonical boundary between the TypeScript web application, Firebase documents, and Python agent service. Fixtures in `fixtures/` must validate in both runtimes. Runtime-specific types may wrap these schemas but may not silently add incompatible fields.

## Contract map

| Contract | Durable boundary |
|---|---|
| `nomination.schema.json` | Authenticated public URL intake |
| `source.schema.json` | Canonical source record and submitted/Parallel/community/creator provenance |
| `source-analysis.schema.json` | Source Analyst stages 1–2 structured handoff |
| `research-bundle.schema.json` | Web Researcher stage 3 output, bounded Parallel query batches, normalized source provenance, and safe tool receipts |
| `evidence-claim.schema.json` | Reusable claim classification |
| `evidence-ledger.schema.json` | Evidence Editor stage 4 output, including source assessments, comparables, and separately labeled external signals |
| `pathway.schema.json` | One Pathway Strategist hypothesis with evidence, risk, questions, confidence, and a bounded experiment |
| `research-event.schema.json` | Ordered, public Firestore progress receipt for one run attempt |
| `public-run-projection.schema.json` | Refresh-safe public run state for complete, partial, failed, and fallback views |
| `card-publication.schema.json` | Atomic, immutable publication decision; failed decisions never create an empty card version |
| `scout-card.schema.json` | Server-renderable Scout Card and embedded Industry Lens view model |

## Invariants

- Run events require `runId`, `projectId`, monotonically assigned `sequence`, `attempt`, stage `1..6`, and `publicVisibility: "public"`. They expose receipts, never hidden reasoning.
- A source discovered by Parallel requires query provenance. A submitted, creator, or community source must keep `queryProvenance: null` and must never be relabeled as a Parallel discovery.
- Complete and partial publication decisions create a new immutable `cardVersionId`. A failed decision has no `cardVersionId`; an earlier immutable version may remain reachable through `previousCardVersionId`.
- A complete Scout Card has no missing sections. A Partial Scout Card must list at least one missing section. Both expose exactly three distinct pathway IDs and three pathway view models for the hackathon card.
- Media states distinguish authorized embeds/images from editorial fallback and unavailable playback. Fallback and unavailable states cannot include an embed or copied image URL.
- Evidence claims cite source IDs. External commentary is explicitly separate and carries `nativeAudienceCount: false`; it cannot become an Audience Take-native count.
- Named platforms, distributors, studios, endorsements, interest, private analytics, and audience counts may appear only when a directly supporting public source exists. The Junichiro fixtures intentionally invent none.
- Whenever `fallbackUsed` is true, the exact visible label is `Previously generated — live refresh unavailable.`

## Fixture coverage

`fixtures/manifest.json` is the shared cross-runtime validation list. It covers the Junichiro nomination, source-analysis/research/evidence handoffs, source and pathway records, a public receipt, complete/partial/failed/fallback run projections, complete/partial/failed/fallback publication decisions, and complete/partial/unavailable-media/fallback Scout Card render states.

The representative Parallel bundle records a truthful zero-result receipt rather than fabricating discoveries. A deployed smoke run must persist its real nonzero request/source proof and current citations separately.
