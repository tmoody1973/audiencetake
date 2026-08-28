# Evidence-first Scout Card design

Status: approved by Tarik on 2026-08-27

## Outcome

Make the Scout Card useful in its first viewport without weakening Audience
Take's evidence discipline. A visitor should be able to experience the primary
work, understand what is established versus unresolved, and choose one useful
next action before opening the full research dossier.

The implementation retains the industrial editorial / tear-off dossier visual
language. It uses real source media and evidence-backed text; the visual
reference is composition guidance, not a factual or media source.

## Evidence behind the design

- The live publisher currently hardcodes `editorial_fallback`, even for a safe
  YouTube submission, while the contract fixtures expect `authorized_embed`.
- YouTube oEmbed identifies the submitted `M2djoKmnOTY` source as commentary
  titled “This Series Could Be The Black Cartoon Comeback” by Esther Helas.
- YouTube oEmbed identifies `s8G7425lfKs` as “Junichiro Jackson (JJ) - Proof of
  Concept” by TeamTO. This is strong platform metadata for a primary-work
  candidate, not proof of rights, representation, or creator approval.
- The current card is structurally complete but retains an explicit unresolved
  identity relationship between “Junichiro Live Project” and “Junichiro
  Jackson.” The interface must not silently merge those identities.

## Product principles

1. Separate structural completeness from evidence verification.
2. Put the work before the hypotheses: primary media is the visual anchor.
3. Preserve five public evidence states: Verified, Reported, Inferred,
   Conflicting, and Unknown.
4. Make provenance human-readable while retaining immutable source IDs.
5. Derive summaries from validated claims and sources instead of generating a
   second unconstrained narrative.
6. Preserve every published card version and correction record.

## First-viewport information architecture

1. Identity block with `Structure complete` and the evidence status.
2. “Start here” source-video carousel with provenance per item and no autoplay.
3. Compact “What we know / What we are checking” evidence brief.
4. Three “Why this is being scouted” observations tied to claim IDs.
5. One active community question and one primary action.
6. Three exploratory pathway summaries.
7. Audience Pulse and the full evidence dossier below the initial dossier.

The Industry Lens remains a semantic data table inside the public card. It is
not split into a paid product during the hackathon slice.

## Contract evolution

New fields are additive and backward-compatible so immutable v1 cards remain
readable:

- `structureStatus?: complete | partial`
- `evidenceStatus?: verified_core | verification_in_progress | source_limited | conflicting`
- `identity?: { relationshipStatus, primarySourceId?, lastVerifiedAt? }`
- `primaryWorkSourceId?: string`
- `sourceLedger[].sourceRole?: primary_work | commentary | trade_reporting | community | creator_statement | other`
- `sourceLedger[].sourceTier?: primary | creator_authorized | reputable_trade | platform_metadata | secondary | community`

Old cards receive conservative derived display defaults. Missing metadata never
upgrades a source or claim to Verified.

## Increment plan

### Slice 1 — deterministic media projection

- Parse only supported YouTube URL forms and valid 11-character IDs.
- Produce `https://www.youtube-nocookie.com/embed/{id}` with no autoplay.
- Keep unsupported, malformed, unavailable, and non-video sources in the
  explicit fallback state.
- Add semantic checks tying the primary media URL to the source ledger.
- Add Python and contract regression coverage.

### Slice 2 — backward-compatible evidence model

- Add optional contract fields and TypeScript/Python projections.
- Create deterministic display-state and source-label helpers.
- Add fixtures for verified, reported, inferred, conflicting, and unknown
  presentations.

### Slice 3 — evidence-first first viewport

- Add the dual-status identity strip.
- Make the source carousel the center visual anchor.
- Add a concise evidence brief and human-readable source chips.
- Reframe pathway confidence as exploratory evidence readiness in the UI.
- Keep social actions below the informed-context block.

### Slice 4 — decision brief and Industry Lens refinement

- Add a concise identity/stage/unknowns/follow-up brief derived from the card.
- Keep native table semantics, captions, row headers, and keyboard-scroll access.
- Add owner, permission, prerequisite, cost class, and success criterion only
  when the data exists; otherwise show Unknown rather than inventing it.

### Slice 5 — immutable correction publication

- Review the TeamTO proof-of-concept through the evidence workflow.
- Create a new immutable correction card version using existing evidence; do
  not overwrite v1.
- Record why source roles/media changed and preserve the submitted commentary
  source as context.
- This is a deterministic correction, not research attempt 16 and not a paid
  provider run.

## Verification gates

- Contract fixtures and Python tests cover supported/unsupported media and
  backward compatibility.
- Component tests cover one video, multiple videos, fallback, removed media,
  all evidence states, deduplicated chips, and table semantics.
- Keyboard testing covers carousel controls, links, disclosure, and focus order.
- Visual checks cover 1536×1024, laptop, 390px mobile, 200% zoom, and reduced
  motion.
- A fan can identify the work, source status, and useful action in 30–60 seconds.
- A professional can identify source strength, material unknowns, and the next
  human follow-up without reading the full ledger.

## Deferred

Professional workspaces, paid exports, private notes, notification loops,
price-specific demand tests, and cohort analytics remain post-hackathon work.

## Stop conditions

- Do not prepare or run attempt 16.
- Do not rename or merge project identities without reviewed evidence.
- Do not mutate an immutable card version.
- Do not publish a production correction before local contract, test, build,
  accessibility, and visual review gates pass.
