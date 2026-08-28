# Audience Take session handoff

Updated: 2026-08-27 (America/Chicago)

## Required restart context

- Continue following `checklist.md` in order. Visual pause `2` was approved on
  2026-08-27; items `9` and `10` are complete. Item `11` is partially deployed:
  Firestore rules/indexes and Storage rules are live. After two local App
  Hosting source-upload transport failures, Tarik approved moving only the
  Next.js hosting layer to Vercel; Firebase and Google Cloud remain the backend.
  The Vercel deployment is not live yet. Continue item `11` and stop at visual
  pause `3` after item `11`.
- Preserve the approved film-festival × underground-magazine direction.
- The user is highly cost-sensitive. Do not resume a provider queue or make an MCP/provider search without explicit approval.
- Do not respond to a new deployed failure by repeatedly retrying. Pause first,
  capture the exact failure chain, consult the installed relevant ADK/agents-cli
  skills, then research the current official documentation and upstream
  source/issues for the failing SDK/API. Reproduce the boundary offline where
  possible and add a focused regression test. Propose another paid attempt only
  after the cause, fix, and verification evidence are recorded. Treat skills as
  curated guidance, not a substitute for version-specific docs or source.
- Firebase/GCP project: `test-app-mkark4` (display name: Audience Take), region `us-central1`.
- Research queue: `audience-take-research`; it must remain paused outside an explicitly approved run.
- App Hosting backend: `audience-take`, region `us-central1`, URL
  `https://audience-take--test-app-mkark4.us-central1.hosted.app`. The backend
  exists, but all five source rollouts on 2026-08-27 failed before serving
  traffic. Two later approved deploy commands failed during source upload
  before creating any rollout or build, so the URL must not be described as
  serving the app.
- Approved replacement web host: Vercel account `tmoody1973`, using the public
  GitHub repository with project root `apps/web`. This changes only the Next.js
  web/runtime host; Firebase Auth, Firestore, Storage, App Check, Cloud Tasks,
  and the private Cloud Run research service remain in place.
- Cloud Run service: `audience-take-agents`.
- Current deployed revision: `audience-take-agents-00019-z6v` using image tag
  `smoke-20260827-publication-attempt-id-v1` and immutable digest
  `sha256:82b3a9f14a2ace50e467dc8aca659128fda381a7d20b140b7bbebd7d061674f3`.
- Deployed Gemini model pin: `gemini-3.5-flash`.
- Application suppresses Cloud Tasks deliveries with `retry_count > 0` before constructing provider clients.
- Cloud Run min instances `0`, max instances `1`, concurrency `1`.
- Queue concurrency/rate are `1`; Parallel client production default is one internal attempt.
- A project-scoped `$10` monthly billing budget is configured at 10%, 50%, 90%,
  and 100% thresholds. It is an alert, not a hard billing cap. A 2026-08-27
  verification returned no Cloud Monitoring alert policies, so do not describe
  additional service-scoped alerts as verified.

## Preserved deployed smoke state

- Run ID: `run-junichiro-live-20260826-1918`.
- Project ID: `junichiro-live-20260826-1918`.
- Current run attempt: `15`; it is durably `complete` with stages `1`–`6`, no
  missing stages, and terminal receipt sequence `7`.
- Durable stages `1`, `2`, `3`, `4`, `5`, and the stage-`6` terminal receipt
  are complete.
- Attempt `6` made the one successful Parallel call and persisted a nine-source
  tool receipt. Attempts `7`, `8`, and `9` reused stage `3` without another
  Parallel call.
- `parallelRequestCount` is `1` and `sourceCount` is `9`.
- The attempt-`15` task is gone and the queue is paused and empty.
- No attempt `16` has been prepared or enqueued; none is needed for this run.
- The evidence ledger was durably persisted by attempt `10`, and the three
  pathway stage output was durably persisted by attempt `13`. Attempt `15`
  subsequently published the versioned pathways and Scout Card described
  below. Attempts `6` and `7` failed safely at stage `4` while validating
  truncated `EvidenceDraft` JSON. Attempt `8` failed safely before Gemini
  generation because the deployed
  typed schema used `Literal[False]`, which the Google Gen AI Vertex schema
  transformer rejects because Literal enum values must be strings. Attempt `9`
  reached Gemini and returned a valid typed draft, but the deterministic editor
  rejected its evidence strength/source relationship with
  `SemanticContractError` before persisting stage `4`. Attempt `10` reused stage
  `3`, persisted stage `4`, then failed safely at stage `5` when the pathway
  draft passed its loose model-facing shape but failed the stricter deterministic
  pathway contract. Attempt `11` deployed the exact typed pathway shape and
  reached Gemini once, but ADK rejected the returned pathway JSON during
  Pydantic validation before the provider could capture a field-level reason.
  Its safe chain was `ResearchSliceFailure` → `ModelOutputError` →
  `ValidationError` → `DynamicNodeFailError`. Attempt `12` ran once against
  revision `00016-pjf` after explicit approval. It again reached Gemini once,
  then failed safely at stage `5` with `ResearchSliceFailure` →
  `ModelOutputError` → `ValidationError`; the privacy-safe fingerprint was
  root location `[]`, type `json_invalid`. No stage `5` output was persisted.
  Attempt `13` ran once on revision `00017-95p` after separate explicit
  approval. The deployed final-event, finish-reason, compact-schema,
  minimal-thinking, and 8,192-token fix worked: stage `5` completed and
  durably persisted all three pathways. The run then failed safely at stage
  `6`; it wrote an honest failed publication decision and no card or pathway
  publication records. No second Parallel call was made. Attempt `14` ran once
  on revision `00018-zsh` after separate explicit approval. The deterministic
  Scout Card assembly succeeded, but the atomic commit failed before any card,
  pathway, or source publication record was written because attempt `13`'s
  failed decision already owned the version-only publication ID. The exact
  safe exception was `PublicationConflictError`; no Gemini or Parallel call was
  made. The failed delivery released the run back to `queued` at stage `6`.
  Attempt `15` ran once on revision `00019-z6v` after separate explicit
  approval. It atomically published one complete card, three pathways, ten
  sources, and a complete attempt-scoped decision with four qualified claims.
  The HTTP request then returned `503` with `RuntimeConflictError` because the
  orchestrator reused terminal sequence `6` even though attempt `13`'s honest
  failed publication receipt already occupied sequence `6`. No Gemini or
  Parallel call was made. A guarded provider-free reconciliation preserved the
  failed receipt and completed the run with attempt `15` terminal sequence `7`.
  The mutable project/public-run route pointers were then aligned to the
  immutable card slug `junichiro-live-project`; the published card was not
  modified.
- Official supporting Kickstarter URL was verified and saved on the nomination:
  `https://www.kickstarter.com/projects/teamto/jj`.
- Describe the Kickstarter accurately as the JJ psychological-thriller manga / wider project-universe campaign, not as proven film financing.

## Diagnosed and fixed during the smoke

1. The YouTube page exceeded the 512 KB reader cap. The wire cap is now 2 MB while the model-facing projection remains 32,000 characters.
2. Unsupported `gemini-3.7-flash` was replaced with the documented `gemini-3.5-flash` model ID.
3. Firestore workflow metadata caused strict `ResearchInput` validation to fail. The loader now whitelists only nomination contract fields.
4. SourceAnalysis JSON was truncated at 2,048 output tokens. That stage now has a 4,096-token cap.
5. Cloud Tasks retried unexpectedly. The HTTP adapter now returns `retry_suppressed` for `retry_count > 0` before provider construction.
6. The Parallel `/v1/search` client used former beta-style top-level fields. It now uses:
   - `max_chars_total`
   - `advanced_settings.max_results`
   - `advanced_settings.excerpt_settings.max_chars_per_result`
7. Attempt `6` proved Parallel runtime integration, returning nine normalized
   sources. Its evidence draft was truncated at the deployed 4,096-token cap.
8. Revision `00011-v8w` raised only the evidence cap to 8,192, but attempt `7`
   also truncated because `EvidenceDraft` exposed unconstrained nested objects.
   Revision `00012-g7v` deployed exact bounded claim/comparable/external-signal
   models and tighter instructions.
9. Attempt `8` exposed a response-schema transport incompatibility before model
   generation: `Literal[False]` is not supported by the Google Gen AI schema
   transformer. The new local fix emits an ordinary strict boolean in the
   Vertex schema and enforces `False` with a Pydantic validator after generation.
   The SDK's exact local `process_schema` path now succeeds, while `true` is
   rejected by application validation. Revision `00013-486` deploys this fix.
10. Attempt `9` revealed that the model schema still offered `supported` and
   `conflicting` statuses even though the normalized live sources are only
   `qualified` or `unverified` and declare no conflicts. The local fix now
   offers only `qualified`, `unsupported`, and `inference`, requires at least
   one exact source ID and a qualification for every claim, and strengthens the
   instruction to copy IDs verbatim. Revision `00014-xrd` deploys this fix.
11. Attempt `10` successfully persisted the evidence ledger, then exposed the
   same contract split at stage `5`: `PathwayDraft` still admitted generic
   dictionaries while `PathwayStrategist` required exact identities, ordering,
   evidence references, and three distinct directions. Revision `00015-4xn`'s
   fix makes all three content sections exact bounded Pydantic models and has
   the application inject the fixed IDs, order, labels, formats, run ID, and
   project ID deterministically. The prompt now limits claim references to
   qualified/inference IDs and requires exact source IDs.
12. Attempt `11` confirmed that the new schema is accepted by Google and the
   Gemini request runs, but ADK's temporary `output_key` state write called
   `model_validate_json()` first and reduced the useful error to a
   `DynamicNodeFailError` wrapper. Current official ADK docs and installed ADK
   2.7.1 source were reviewed before any further action. Revision `00016-pjf`
   deploys the observability fix: it removes unused `output_key` values from the
   standalone provider agents and logs only bounded Pydantic field locations
   and error types—never prompts, output values, messages, or model text.
13. Attempt `12` confirmed that the pathway boundary received text that was not
    valid JSON, but the deployed collector discarded ADK `finish_reason` and
    accepted text from any event rather than only `event.is_final_response()`.
    The old logs therefore cannot prove whether Gemini exhausted the 4,096-token
    ceiling or ignored the response schema. Output-budget exhaustion is the
    leading explanation: the legal pathway schema could exceed that ceiling,
    while Gemini 3.5 Flash uses medium thinking by default. The local fix now
    selects only the final event authored by the target agent, rejects
    `MAX_TOKENS` before JSON parsing, records a fixed privacy-safe provider code,
    uses minimal thinking and no temperature override for this fixed-format
    stage, raises only the pathway cap to 8,192, and narrows model-facing prose,
    ID, and list bounds. After explicit deployment approval, revision
    `00017-95p` deployed this fix and now serves 100% of traffic. No attempt
    `13` was prepared or run during deployment.
14. Attempt `13` proved the stage `5` fix, then exposed a separate stage `6`
    split contract. `ScoutCardDraft` exposed the entire card as
    `dict[str, object]`, so an arbitrary JSON object passed the model boundary;
    the stricter publication policy then converted a missing-useful-evidence or
    semantic-contract rejection into a generic failed publication. The raw card
    draft was deliberately neither logged nor persisted, so the exact rejected
    field cannot be recovered and must not be guessed. A focused regression
    proved that even `{ "card": {} }` passed the old model schema. The spec
    assigns stage `6` to the orchestrator/publisher, so the local fix removes
    the redundant Scout Card LLM stage and deterministically projects the
    validated source analysis, evidence ledger, sources, and immutable pathways
    into the canonical card contract. A read-only replay of the actual durable
    attempt-13 stages `1`–`5` produced a complete schema-valid card with ten
    sources, three pathways, useful evidence, and no missing sections. After
    explicit deployment approval, revision `00018-zsh` deployed this fix and
    now serves 100% of traffic. No attempt `14` was prepared or run during
    deployment.
15. Attempt `14` proved the deterministic stage `6` assembly reached the
    publication transaction, then exposed an ID collision: publication
    decisions used `publication-{run_id}-v{research_version}` and therefore
    could not preserve a failed decision and a later successful decision for
    the same immutable research version. A focused regression reproduced the
    exact `PublicationConflictError`. Publication decisions now include the
    attempt number in their identity while remaining idempotent within the same
    attempt. Revision `00019-z6v` deploys this fix and serves 100% of traffic.
    No attempt `15` was prepared or run during deployment.
16. Attempt `15` proved the publication-ID fix and atomically committed every
    public artifact, then exposed a separate run-wide receipt cursor bug. The
    stage-`6` finish call hard-coded sequence `6`, while the preserved attempt-
    `13` failure receipt already set `lastEventSequence` to `6`. A focused
    runtime regression now requires the later terminal receipt to use the next
    lease-owned sequence (`7`) without overwriting history. The live run was
    reconciled through that exact runtime boundary without another task or
    provider call and is complete. Browser verification then found that the
    card derived a second slug from model-produced title text instead of
    preserving the project shell slug. The project loader/card assembler now
    carry the trusted project slug, and the live mutable route pointers were
    safely aligned to the already-immutable card. These cursor/slug code fixes
    are local and are not deployed on revision `00019-z6v`.

The current local verification passed: 73 Python tests, Python Ruff, strict
mypy across 29 source files, web ESLint/TypeScript, 147 web tests, 19 Firebase
rules/emulator integration tests, the Next.js production build, 20 cross-runtime
contract fixtures, and Terraform formatting. The Firebase emulator suite uses
the existing Homebrew OpenJDK 21 binary because `/usr/bin/java` is only Apple's
missing-runtime stub. The current sandbox could not launch the installed
Terraform provider binaries; the prior Terraform validation pass still stands
and no Terraform files changed during resumption. The installed
Google Gen AI SDK's exact schema converter also accepts both `EvidenceDraft`
and the new `PathwayDraft` (`google-adk 2.7.1`, `google-genai 2.20.0`, Pydantic
2.13.4).

## Item 11 deployment state

- The Firebase App Hosting backend and dedicated runtime identity were created.
  The runtime has only the required narrow project roles plus
  `roles/iam.serviceAccountUser` on the dedicated task-invoker service account;
  the briefly attempted broad SDK-admin role was removed.
- Firebase Authentication is initialized with email/password enabled and the
  hosted App Hosting domain authorized. Google sign-in is intentionally hidden
  in production because no Google OAuth client ID/secret is configured.
- reCAPTCHA Enterprise App Check is registered for the exact hosted domain,
  debug mode is disabled, and the public browser API key is referrer-restricted
  to the hosted domain plus local development origins.
- Commit `a3830e8` added App Hosting configuration, production security headers,
  and the production Google-sign-in feature flag. Commit `c3301a1` added the
  app-local npm lockfile required by the App Hosting build root. Both are pushed
  to `origin/codex/build-mvp`.
- The approved Firebase deployment released Firestore rules/indexes and Storage
  rules successfully. Their dry-run and live compilation both passed.
- App Hosting rollout build `1046dd02-c4d6-4753-9846-edbc55c13e05` failed because
  `/workspace/apps/web` lacked a dependency lockfile. Current Firebase docs and
  the Cloud Build output agreed on that exact cause. An app-local lockfile was
  generated, a clean app-root install and production build passed, and exactly
  one researched rollout retry was made.
- The retry build `00d4b1d8-051c-4011-9e57-5964f7a9fa1a` got through dependency
  installation, Next.js compilation, TypeScript, page collection, and static
  generation. Firebase's Next.js adapter then failed while opening
  `.next/standalone/.next/routes-manifest.json`. This is a separate packaging
  failure, not an application compile failure.
- Commit `bdc6ba1` made the web app's contract fixtures self-contained and added
  an initial tracing-root heuristic. Normal builds and an isolated exact-adapter
  build passed, but the heuristic assumed Next would be present at
  `apps/web/node_modules`. Firebase installs framework dependencies in a
  buildpack layer, so that assumption did not match the managed environment.
- The explicitly approved third rollout build
  `5e24bf4f-ad8f-442b-b3cf-2da83b12824e` again completed Next.js `16.3.3`
  compilation, TypeScript, page collection, and all nine static pages. It then
  failed with the same exact adapter `14.0.21` `ENOENT` for
  `/workspace/apps/web/.next/standalone/.next/routes-manifest.json`; no retry was
  made.
- Adapter source inspection confirmed it sets
  `NEXT_PRIVATE_STANDALONE=true` before loading the project config and, because
  Cloud Build did not set `MONOREPO_COMMAND`, expects the flat app-root
  standalone layout. Commit `ab2a269` now uses that adapter-owned signal: an
  App Hosting standalone build traces from `apps/web`, while a normal workspace
  build traces from the repository root so Turbopack can resolve hoisted
  dependencies.
- The focused three-case tracing regression passes. The normal Next.js
  production build passes. An isolated run through the exact public Firebase
  adapter `14.0.21` with Next.js `16.3.3` passes and emits exactly
  `.next/standalone/.next/routes-manifest.json`, `.next/standalone/server.js`,
  and bundle command `node .next/standalone/server.js`, with no nested
  `apps/web` manifest. Lint, typecheck, and all 38 web test files / 151 tests
  pass. No provider, Gemini, Parallel, or research-queue call was made.
- The explicitly approved fourth rollout build
  `9b52debb-28e0-4906-9f60-6dbe292b0c7e` proved the adapter-owned flag reached
  Next.js: Turbopack used `/workspace/apps/web` as its filesystem root. The
  build then failed earlier because Next itself is installed in Firebase's
  external buildpack layer, outside that root, so Turbopack could not resolve
  `next/package.json`. No retry was made.
- Current Next.js documentation and source confirm that `turbopack.root` and
  `outputFileTracingRoot` cannot differ; the config loader synchronizes them.
  Next.js officially supports `next build --webpack` as the production fallback.
  Its Webpack route validator also correctly rejects helper exports from
  `route.ts`; only HTTP methods and documented route configuration are allowed.
- Commit `6087703` switches only the production build to Webpack, fixes the
  tracing root at `apps/web`, and moves the ten testable API implementations to
  sibling `handler.ts` modules. Each `route.ts` is now a thin module exporting
  only its supported HTTP methods.
- The normal Webpack production build passes through trace collection. The
  exact public Firebase adapter `14.0.21` with Next.js `16.3.3` also passes and
  emits `.next/standalone/.next/routes-manifest.json`,
  `.next/standalone/server.js`, and bundle command
  `node .next/standalone/server.js`, with no nested `apps/web` manifest. Lint,
  typecheck, six affected route suites / 18 tests, and the bounded full suite of
  37 files / 148 tests pass. No provider, Gemini, Parallel, or research-queue
  call was made.
- The explicitly approved fifth rollout used Cloud Build
  `0cdacbbd-bc3c-4c71-abf0-3f255c1b148a`. The full Webpack framework build and
  Firebase publisher both succeeded. App Hosting then marked build/rollout
  `build-2026-08-27-005` failed when Cloud Run revision
  `audience-take-build-2026-08-27-005` exited before listening on port `8080`.
  Revision logs contain the exact exception `Cannot find module 'next'` from
  `.next/standalone/server.js`; no retry was made.
- The failure is a runtime-closure boundary, not an application compile or
  adapter-manifest failure. Firebase's buildpack keeps installed packages in an
  external layer, while the app-root standalone trace copied no `node_modules`.
  Removing the developer dependency tree from the local standalone artifact
  reproduced the same `Cannot find module 'next'` exception exactly.
- Commit `33cc72c` adds a lockfile-driven post-build materializer. For standalone
  builds only, it resolves Firebase's external dependency root, copies the 242
  installed production packages represented by the app-local lockfile into
  `.next/standalone/node_modules`, and fails the build if any direct runtime
  dependency remains absent. Normal non-standalone builds are unchanged.
- The focused materializer tests pass. Lint, typecheck, the normal Webpack build,
  and the bounded full suite of 38 files / 150 tests pass. The external-layout
  standalone build produces a `571M` uncompressed artifact; copying that artifact
  alone into an empty directory starts Next.js immediately, and both `/` and
  `/sign-in` return HTTP `200`. No provider, Gemini, Parallel, or research-queue
  call was made.
- The explicitly approved sixth deploy command on 2026-08-27 stopped before an
  App Hosting rollout existed. Firebase CLI `15.28.1`, running on local Node
  `26.0.0`, created a valid source ZIP and began a single streamed `PUT` to the
  App Hosting source bucket. After reading `7,995,392` bytes, the fetch failed
  with `read EADDRNOTAVAIL`; the CLI then reported `Timed out` and the generic
  `An unexpected error has occurred`. App Hosting still lists only failed
  rollouts `001`–`005`, and the named source object returns `404`, so this did
  not start Cloud Build, create a rollout, or incur an application build.
- Current Firebase guidance confirms source deploys upload an archive to Cloud
  Storage and recommends excluding `.git`. Installed CLI source confirms that
  streamed request bodies are non-replayable and are not retried after this
  network error. It also confirms that supplying an explicit App Hosting
  `ignore` list replaces the default `.git` exclusion. The exact archive was
  valid but accidentally contained `.git` and was `61.39 MB`. Adding `.git` to
  `firebase.json` reduced the exact offline archive to `30.26 MB`; an archive
  listing proves it contains zero `.git/*` entries. This removes unnecessary
  upload exposure but does not prove the operating system's transient socket
  allocation failure cannot recur.
- The sixth command approval was consumed by that failed source upload; no
  automatic retry was made, and a fresh approval was required for the next
  command.
- A separately approved seventh deploy command from clean, public commit
  `9ae75d2` used the corrected `30.26 MB` source archive. It again failed during
  the Cloud Storage upload, this time surfacing only `Failed to make request to
  https://storage.googleapis.com/...zip`. The CLI did not leave a
  `firebase-debug.log`, so do not claim the second command's underlying socket
  code was proven. The named object returns `404`, App Hosting still lists only
  failed rollouts `001`–`005`, and no Cloud Build was created. The queue remains
  `PAUSED` and empty. No retry was made.
- The repeated failure with the archive reduced by half rules out archive size
  as a sufficient fix. Current npm metadata shows Firebase CLI `15.28.2` is the
  latest patch while the workspace has `15.28.1`; the official source diff has
  no upload-path change, so upgrading alone is not an evidence-backed remedy.
  Both versions use the same non-replayable streamed source-upload boundary.
- Firebase's documented alternative is a GitHub-connected App Hosting backend
  followed by `apphosting:rollouts:create` for an exact commit. Installed CLI
  source confirms the current backend has no connected `codebase.repository`
  and directs operators to connect one through the Firebase Console. Connecting
  the public repository changes backend/Developer Connect configuration and may
  require interactive GitHub OAuth, so obtain explicit approval before doing
  that. After connection, use commit `9ae75d2` rather than another local source
  upload. Do not issue another deploy or rollout command without fresh approval.
- Tarik subsequently approved replacing App Hosting with normal Vercel Next.js
  hosting. The web runtime now prefers Vercel OIDC through Google Workload
  Identity Federation and passes the resulting short-lived authenticated client
  to Firebase Admin and Cloud Tasks. ADC and a strict encrypted JSON secret
  remain compatibility fallbacks. Cross-project, malformed, and incomplete
  configuration fails closed.
- Vercel Functions cap request bodies at `4.5 MB`; the existing trusted creator
  upload route is therefore capped at `4 MB` with multipart headroom. The robust
  follow-up is a short-lived direct-to-Firebase-Storage upload grant plus a
  server finalize step that rechecks authorization, size, magic bytes,
  checksum, reservation, and idempotency. Do not enable raw client Storage
  writes; current Storage Rules correctly deny them.
- Vercel project `tmoody1973s-projects/audiencetake`
  (`prj_plS1X3irS2tQrvi2sRA8CJj6ajMX`) is created, connected to the public
  `tmoody1973/audiencetake` repository, configured as Next.js with root
  `apps/web`, and has the 23 required production environment values. No
  `GOOGLE_SERVICE_ACCOUNT_JSON` was stored.
- Google workload identity pool `audience-take-vercel` and OIDC provider
  `audiencetake` are active. The provider issuer is the team-specific Vercel
  issuer, its allowed audience is the team-specific Vercel audience, and its
  condition requires both the exact Vercel project ID and
  `environment == 'production'`. Only the exact production subject may
  impersonate `firebase-app-hosting-compute@test-app-mkark4.iam.gserviceaccount.com`.
  The identity has zero user-managed keys; a temporary unused key was revoked
  and deleted before it left the local machine.
- `audiencetake.vercel.app` is present in both Firebase Auth authorized domains
  and the reCAPTCHA Enterprise/App Check key's allowed domains. The research
  queue remains paused. The keyless implementation passes the complete local
  gate: lint, typecheck, 20 contract fixtures, 39 web test files / 157 tests,
  and the normal Webpack production build. Production deployment is still
  pending the Git checkpoint containing the keyless code.

## Failure research findings

- Attempts `6` and `7` were output-design failures: the Evidence stage could
  emit a large, weakly bounded object and exhausted first 4,096 then 8,192
  output tokens. Raising the cap alone did not fix the loose shape.
- Attempt `8` was a confirmed Google SDK compatibility failure before Gemini
  generation. Pydantic emits a single-value non-string `Literal` as JSON Schema
  `const`; Google Gen AI's current `process_schema` transformer raises for
  non-string Literal values. A normal boolean plus an application validator is
  the compatible representation.
- Attempts `9` and `10` were Audience Take contract-alignment failures after
  valid structured model responses. Google/ADK output schemas enforce the
  declared JSON structure; they cannot enforce business rules omitted from that
  structure. Our generic nested dictionaries admitted statuses, IDs, and
  relationships that the deterministic editors correctly rejected later.
- Attempt `11` was a Pydantic structured-output validation failure after Gemini
  generation. Research confirms `DynamicNodeFailError` is only ADK's dynamic
  workflow propagation wrapper; the underlying failure occurs when ADK calls
  `model_validate_json()` while saving `output_key`. The exact field cannot be
  recovered from existing logs because the deliberately safe logger retained
  class names only. Do not guess which field failed.
- Attempt `12` was a root-level JSON parse failure after Gemini generation. The
  deployed code did not retain ADK's finish reason, so truncation cannot be
  stated as proven. Current official ADK examples require filtering
  `Runner.run_async()` events with `event.is_final_response()`, and the exact
  installed ADK event exposes `finish_reason` and usage metadata. Vertex defines
  `MAX_TOKENS` as exhausting `maxOutputTokens`; Google Gen AI
  [issue #1039](https://github.com/googleapis/python-genai/issues/1039)
  records structured output ending without parseable content at that boundary.
  Gemini 3.5 Flash documentation also says thinking defaults to medium and
  recommends `thinking_level` plus default sampling values for Gemini 3.x.
- Attempt `13` completed stage `5`, proving that the 8,192-token compact pathway
  boundary fixed the prior failure. Stage `6` then returned a valid outer JSON
  object but failed publication policy. Current ADK guidance relies on a
  concrete Pydantic `output_schema`; `dict[str, object]` constrained only the
  outer object and could not enforce the Scout Card contract. The persisted
  ledger contains four qualified source-linked claims, and the persisted stage
  `5` contains all three fixed pathways, ruling out genuinely absent useful
  evidence. The deterministic live-artifact replay confirms the failure was
  card assembly, not insufficient research.
- Attempt `14` did not call Gemini or Parallel. It reached the deterministic
  publication transaction and failed because the version-only publication ID
  was already occupied by attempt `13`'s failed decision. Artifact collisions
  and duplicate delivery were ruled out: zero versioned source, pathway, and
  card records existed, and exactly one task delivery occurred. Attempt-scoped
  publication decision IDs preserve both audit records and same-attempt
  idempotency.
- Attempt `15` atomically published successfully before runtime finalization.
  Its `RuntimeConflictError` was reproduced offline as a receipt-sequence
  conflict: the prior failed stage-`6` receipt held sequence `6`, and the later
  successful stage-`6` receipt also requested `6` instead of the next run-wide
  sequence. The correct fix advances monotonically to `7`; rewinding the cursor
  would have weakened the audit trail and was explicitly rejected.
- The common root cause is a split contract: the model-visible schema/prompt
  was looser than the deterministic publication contract. Every model-generated
  handoff should therefore be exact and bounded, while fixed identity and policy
  values should be injected by deterministic code rather than echoed by Gemini.
- Deployment reproducibility is partially hardened: revision `00015-4xn` pins
  `google-adk==2.7.1`, `google-genai==2.20.0`, and Pydantic `2.13.4`. The
  Dockerfile still runs `pip install .` without the checked-in `uv.lock`, so
  transitive dependencies may still drift; build from the lock before final
  submission.
- Add an offline Google schema-compilation regression for every LLM output
  model, semantic fixtures that cross the draft-to-publication boundary, and
  stable privacy-safe failure reason codes. ADK does not automatically repair
  every schema/semantic mismatch, so any future bounded repair attempt must be
  explicit and must never weaken the truth rules.

## Verified resumption state

- The `parallel-search` MCP server is installed and exposes callable search/fetch
  tools. This was confirmed through capability discovery only; no provider search
  was made.
- The official Parallel CLI is installed through Homebrew at version `0.9.3` and
  has active stored OAuth credentials. Eleven official Parallel agent skills are
  installed globally in Codex; they become available on the next turn. Installing
  and verifying them did not invoke a search or other provider-bearing operation.
- Git is on `codex/build-mvp`. The approved items `5`–`8` checkpoint is pushed
  at `f1b9383`; item `9` is pushed at `7c12850`; item `10` is pushed through
  `a8a1a08`; item `11` deployment configuration and the researched App Hosting
  fixes and the fifth-failure handoff are pushed through `26f8463`. Public origin
  `https://github.com/tmoody1973/audiencetake.git` is configured, and the branch
  tracks `origin/codex/build-mvp`.
- Cloud Run is ready and routes 100% of traffic to
  `audience-take-agents-00019-z6v`. The revision reports `Ready`, `Active`,
  `ContainerReady`, and `ContainerHealthy`; there were no revision error logs
  during deployment verification. The active template preserved min instances
  `0`, max instances `1`, concurrency `1`, the `gemini-3.5-flash` pin, runtime
  identity, secret binding, and zero application task retries. The operator
  identity cannot invoke the private health route and cannot impersonate the
  dedicated task identity; no IAM permission was added or weakened.
- An unauthenticated `POST /tasks/research` returned `403`. The task-invoker
  service account is the only `roles/run.invoker` member.
- The queue is `PAUSED`, configured for one concurrent dispatch and one dispatch
  per second, and contains zero tasks.
- Firestore has attempt `15` complete with all six stages, terminal sequence
  `7`, one Parallel request, nine provider sources, ten public sources including
  the submitted source, four qualified claims, three versioned pathways, one
  complete Scout Card, and no missing sections. Attempt `13`'s failed receipt
  and publication decision remain preserved alongside attempt `15`'s complete
  decision. The official
  Kickstarter supporting URL remains on the nomination.
- Direct citation reachability returned seven `200` responses, two `403`
  responses, and one TikTok result that redirected to the TikTok homepage.
  Behance, Brooklyn On Demand, and generic TikTok discovery results are weak or
  irrelevant leads and must not be promoted into supported claims.
- The Parallel secret has one enabled version; its value was not read.
- `scripts/deployed_smoke.py prepare-retry` permits only safe pre-provider
  recovery. The separate `prepare-continuation` command requires provider proof
  and a durable stage `3`, preserves contiguous outputs only through stage `5`,
  and refuses a completed stage `6`. Eleven focused tests pass.
- Google's `google-agents-cli-adk-code` and workflow skills are installed and
  were applied to review the ADK change. `agents-cli info` reports CLI `0.2.0`,
  skill bundle `1.4.1`, and no scaffolded agents-cli project in this repository.
  Audience Take currently uses ADK directly; do not claim agents-cli controls
  its builds, evals, or deployments without a separately approved enhancement.

## Next safe actions

1. Keep the queue paused.
2. For every new failure, follow the research-before-retry rule above; an
   approval covers only the single diagnosed attempt it explicitly authorizes.
3. Do not prepare attempt `16`; the preserved run is complete and needs no
   further paid attempt.
4. Visual approval checkpoint `2` was approved by Tarik on 2026-08-27. The live
   Firestore-backed Scout Card was verified locally at
   `/projects/junichiro-live-project`; desktop, expanded Industry Lens, and
   mobile captures are in this directory as
   `attempt-15-scout-card-desktop.png`,
   `attempt-15-scout-card-desktop-full.png`,
   `attempt-15-scout-card-mobile.png`, and
   `attempt-15-scout-card-mobile-full.png`. Items `5`–`8` are checked.
5. Checklist item `9` is complete locally: transactional Follow, four
   commitments, one current pathway vote, one structured Take, flat replies,
   realtime Audience Pulse, safe sign-in return, and public Scout Profiles are
   implemented. Concurrent/idempotent social transitions and privacy rules pass
   the Firebase emulator suite. The signed-out live-data browser path was
   verified on desktop and mobile; repeat one fresh authenticated action after
   item `11` deploys the web/rules surface.
6. Checklist item `10` is complete locally: nomination supporting links become
   Community Leads; post-card Suggest Evidence has canonical URL safety,
   transactional deduplication, all five terminal review outcomes, private
   append-only reviews, and Community Lead source provenance. Request to Claim
   has real pending/rejected/approved states backed by private project-scoped
   roles. Approved creators have a gated update desk and server-mediated image
   uploads. Reports, account limits, demo labels, and append-only correction
   history are implemented with public-safe projections. Demo-account social
   actions are stamped and counted separately from organic participation;
   upload retries use a stable idempotency key; reporters can follow case
   status; and evidence ownership stays server-private. The local desktop and
   mobile emulator walkthrough showed the Trust & Ownership panel, one pending
   evidence lead, one labeled demo creator update, and one correction row.
7. Continue checklist item `11`: rules/indexes are live and Vercel is now the
   web host. Production deployment `dpl_SmrDq5Mq1jZTY8uU9bmLvYPdXYu6` from
   commit `8a3a919` is Ready at `https://audiencetake.vercel.app`; `/` and
   `/sign-in` returned `200`, but the Firestore-backed
   `/projects/junichiro-live-project` returned `500`. Runtime logs subsequently
   identified the exact pre-application crash: Vercel's function package had
   `next/dist/server/node-environment.js` but omitted its required sibling
   `node-environment-baseline.js`. The cause was reproduced locally with Next's
   own NFT tracer: `outputFileTracingRoot` was restricted to `apps/web` while
   the workspace-installed Next package lives at the repository root, so only
   the entry file was traced. Using the documented monorepo tracing root includes
   the baseline and all node-environment extensions. The local fix and regression
   test pass the full gate: 20 contract fixtures, 40 web test files / 159 tests,
   lint, typecheck, and the production Next build. No further rollout is
   authorized until the user approves one diagnosed retry under the
   research-before-retry rule.
   Keyless Vercel OIDC to Google Workload Identity Federation is configured;
   no service-account JSON key is stored. The authorized follow-up rollout
   `dpl_4XLSbajRUTvTFzzmQLep8Dy2NukG` from `8c23ddc` reached `READY` and fixed
   the Next launcher crash: `/`, `/sign-in`, and `/nominate` return `200`.
   `/projects/junichiro-live-project` now cleanly returns `404`, while the
   canonical `/projects/junichiro-jackson` returns the explicit saved fallback,
   proving the remaining break is server authentication rather than packaging.
   A bounded local token exchange found the exact cause: Google's identity-pool
   client calls `getSubjectToken` with its supplier context, and the direct
   `getVercelOidcToken` callback interpreted Google's provider audience as
   Vercel custom-audience options. Google rejected that token with
   `invalid_grant` audience mismatch. A zero-argument wrapper keeps Vercel's
   expected team audience; the same local exchange then advanced to the
   expected production-only attribute-condition rejection for the local
   development token. The wrapper and regression test pass the full local gate:
   20 contract fixtures, 40 web test files / 160 tests, lint, typecheck, and the
   production Next build. The approved rollout
   `dpl_EqXqUdJcTEM1aFvwVBxHvUixp5BK` from `70475e0` reached `READY`, and the
   primary alias was confirmed to resolve to that exact deployment. `/`,
   `/sign-in`, and `/nominate` return `200`; `/projects/junichiro-live-project`
   returns `404`; and `/projects/junichiro-jackson` returns `200` but still
   displays the explicit saved fallback. Firestore, STS, and IAM Credentials
   APIs are enabled and the runtime service account has `roles/datastore.user`,
   but the bounded post-request audit-log queries returned no STS, IAM
   Credentials, or Firestore entries. The existing fallback catch hid the exact
   provider-stage error, so a structured, redacted diagnostic was added at that
   boundary without changing fallback behavior. Tarik explicitly approved its
   single diagnostic rollout after the full local gate passed. Deployment
   `dpl_6mtH6xeysqKxyYMkQr1MRuRZatAo` from `de7580f` reached `READY`, the public
   alias was confirmed to resolve to it, and the canonical card request still
   served the explicit fallback. Its redacted event captured the exact error:
   `firestore/invalid-credential` — Firebase Admin's Firestore adapter requires
   a certificate credential or its own application-default credential. The
   installed Firebase Admin source and a bounded no-network local reproduction
   confirmed that the custom `getAccessToken` wrapper is rejected before STS,
   while `applicationDefault()` is accepted before network access. Current
   Firebase Admin and Google Auth documentation confirm the supported keyless
   bridge: an external-account ADC config with a file-sourced subject token.
   The local fix atomically refreshes the current Vercel OIDC token in a private
   `/tmp` file, writes a non-secret external-account config, and initializes
   Firebase Admin with `applicationDefault()`; Google's client rereads the token
   file for later exchanges. Focused tests prove `0700`/`0600` permissions,
   token/config separation, warm-token refresh, ADC-class selection, and the
   absence of the former Firestore initialization rejection; emulator access
   remains credential-free. The full local gate passes 20 contract fixtures and
   42 web test files / 163 tests, plus lint, typecheck, and the production build.
   Tarik approved one diagnosed rollout. Deployment
   `dpl_BCRghFmp1ANrfnXtCaPS3k38uVu2` from `41426ef` reached `READY`, and
   `https://audiencetake.vercel.app` resolves to that exact artifact. `/`,
   `/sign-in`, and `/nominate` return `200`. The live Firestore-backed route
   `/projects/junichiro-live-project` returns `200`, renders immutable version
   `card-junichiro-live-20260826-1918-v1`, and contains no saved-fallback
   markers. A clean isolated browser rendered the complete Scout Card, all
   three pathways, Audience Pulse, Trust & Ownership, correction history, and
   evidence ledger. The deployment-scoped error scan is clean. This proves the
   Vercel OIDC -> Google WIF -> Firebase ADC -> Firestore read path is working.
   `/projects/junichiro-jackson` now returns a clean `404` rather than the saved
   fallback because the published Firestore project's stored slug is
   `junichiro-live-project`; treat canonical-slug reconciliation as a separate
   data/URL task, not an authentication retry. Do not trigger another rollout
   merely to sync this handoff entry. The follow-up production audit confirmed
   exactly one matching project (`junichiro-live-20260826-1918`), immutable card
   `card-junichiro-live-20260826-1918-v1`, no target-slug collision, and no
   correction, claim, creator assignment, creator update, or project-scoped
   creator role. The card itself explicitly retains an unresolved question
   about the identity link between “Junichiro Live Project” and “Junichiro
   Jackson,” so renaming or cloning it as Junichiro Jackson would overstate the
   evidence. The evidence-safe fix is a server-side `308` alias from
   `/projects/junichiro-jackson` to the verified stored route; it performs no
   Firestore read or write before redirecting. The stored live slug also shares
   the exact labeled saved fallback during a provider outage. The full gate
   passes 20 contract fixtures and 42 web test files / 165 tests, lint,
   typecheck, and production build; a local production HTTP check confirmed the
   exact `308` and Location header. Production deployment
   `dpl_D7WQQXHApCyREoLbxNrF9z2gPTfq` from `a418321` reached `READY` and is
   assigned to `https://audiencetake.vercel.app`.
   `/projects/junichiro-jackson` returns that evidence-safe `308`; the live
   destination returns `200`, renders `card-junichiro-live-20260826-1918-v1`,
   contains no saved-fallback markers, and its deployment-scoped error scan is
   clean. The creator Auth audit blocker was then resolved without modifying
   local ADC: the installed Google Auth Library confirms that process-local
   `GOOGLE_CLOUD_QUOTA_PROJECT` replaces the ADC quota project before it adds
   `x-goog-user-project`. A read-only inventory charged to `test-app-mkark4`
   succeeded and found exactly zero Firebase Auth users. No API was enabled and
   no Auth or Firestore record was changed. A real account must sign in or be
   created before there is a UID to review and bind; do not synthesize or guess
   a privileged identity. Vercel's current request-header contract confirms
   that it overwrites `x-forwarded-for` and discards caller-supplied values to
   prevent spoofing; `VERCEL=1` identifies that runtime. The local nomination
   command now uses that header only on Vercel, validates one IPv4/IPv6 literal,
   and atomically checks account plus IP limits before writing either counter.
   Raw UIDs and IP addresses are never persisted. Non-Vercel or ambiguous
   requests retain the account limit and omit the IP principal. The full local
   gate passes 20 contract fixtures and 43 web test files / 172 tests, lint,
   typecheck, and the production build. Deployment
   `dpl_xXD7R2NgtpXmtT7E75n9cSYvxdsF` from `541faa5` reached `READY` and owns
   the public alias. The production alias route returns `308`, the live
   Firestore card returns `200` with immutable version
   `card-junichiro-live-20260826-1918-v1` and no saved-fallback marker, and the
   deployment-scoped error/fatal log query is empty. The optional emulator
   rerun was not retried because this workstation currently has no Java runtime;
   no rules changed in this slice. A read-only production reconciliation then
   compared `follows`, `commitments`, `pathwayVotes`, `takes`, and `replies`
   with every organic and demo counter on project
   `junichiro-live-20260826-1918`. All source collections and all stored
   counters are currently zero, so they match exactly and no repair is needed.
   After a real account exists, bind the
   pre-approved demo creator to the reviewed live project/Auth UID, exercise
   the three-role journey, repeat a fresh authenticated native action,
   reconcile counters, and rehearse the judge path. Stop at visual pause `3`.
8. The run-wide next-sequence and trusted-project-slug fixes are local only.
   Require explicit deployment approval before replacing revision `00019-z6v`.

## Local multi-video Source Card enhancement

- The Scout Card now derives a no-autoplay carousel from its existing source
  ledger: one primary authorized embed plus up to four additional available
  YouTube sources. Each selection keeps its own title, outbound source URL,
  origin, and verification status; duplicate video IDs are suppressed.
- The controls expose previous/next actions, direct source selection, a live
  screen-reader announcement, responsive mobile layout, and an outbound
  fallback link. One-video and unavailable-media cards retain their prior
  behavior.
- The user-provided Junichiro URL
  `https://www.youtube.com/watch?v=s8G7425lfKs` is covered by the component test
  as an observed Community Lead. It has not been silently inserted into the
  immutable published card; incorporation requires the normal reviewed source
  path and a new card version.
- Local verification: `npm run check` passed 20 contract fixtures and 39 web
  test files / 158 tests; `npm run build` passed. These edits are intentionally
  not synced to GitHub yet because a push would trigger another Vercel rollout
  before the existing production `500` is diagnosed.

## Evidence-first Scout Card and immutable TeamTO correction

- The evidence-first Scout Card redesign is locally complete and visually
  approved. The first viewport now separates structural completeness from
  evidence strength, starts with source media, presents a concise evidence
  brief, keeps pathway confidence framed as exploratory evidence readiness,
  and adds a bounded decision brief before the comparative Industry Lens.
- YouTube media is projected from the immutable source ledger into a
  privacy-enhanced, no-autoplay carousel. Each source retains its own role,
  tier, verification state, title, and outbound link. The player now uses a
  dedicated responsive `16 / 9` viewport instead of inheriting the square-like
  image minimum height. Browser measurements confirmed ratio `1.778` at both
  desktop (`278 × 156.375`) and 390px mobile (`312 × 175.5`) widths.
- YouTube's oEmbed endpoint identified the reviewed community lead
  `https://www.youtube.com/watch?v=s8G7425lfKs` as “Junichiro Jackson (JJ) -
  Proof of Concept” by TeamTO. This verifies public platform metadata and an
  embeddable source; it does not prove creator ownership, rights, or the wider
  project relationship.
- Firestore Standard database `(default)` in `test-app-mkark4` now contains an
  immutable correction publication for project
  `junichiro-live-20260826-1918`. The original card
  `card-junichiro-live-20260826-1918-v1` still exists unchanged. The mutable
  project pointer now targets
  `card-junichiro-live-20260826-1918-v1-correction-5ea5f36d0447`; both
  `researchVersion` and `publishedResearchVersion` remain `1`, and the existing
  completed run ID remains unchanged. This was not attempt `16` and did not
  invoke a paid provider.
- The new card labels the TeamTO source as `primary_work /
  platform_metadata / observed`, retains the original submitted YouTube source
  as `commentary / community`, exposes two source videos, and remains
  `source_limited`. Public correction
  `correction-5ea5f36d0447bb8f1d3b` records the v1-to-correction transition and
  contains no actor identity. The same-ID private audit retains the operator
  field. A replay returned `changed: false`, proving idempotency.
- Firestore rules were compiled with `firebase deploy --dry-run` and released
  successfully so the optional public from/to/source correction fields remain
  readable while private audit data stays default-denied. The local emulator
  suite was not retried after its first pre-test failure because this
  workstation has no Java runtime; no test case failed. All available gates
  passed: 20 cross-runtime fixtures, 47 web files / 188 tests, lint, strict
  TypeScript, 90 Python tests, and the Next production build.
- Live verification of the first web rollout caught and locally corrected one
  presentation-only audit bug: the “Initial research publication” label had
  used the current correction card ID. The UI now walks the public from/to
  chain back to the original v1 card, with pure tests for chained and note-only
  corrections.
- The production correction tool is
  `scripts/publish_scout_card_correction.mjs`. It defaults to a read-only dry
  run, requires an explicit `--apply` plus private audit label to write, uses a
  compare-and-set pointer, creates every immutable artifact with deterministic
  IDs, and treats exact retries as no-ops.
- The approved web/GitHub sync should deploy the evidence-first UI and 16:9
  player to `https://audiencetake.vercel.app`. After rollout, verify the live
  route renders the correction card ID, TeamTO primary embed, second commentary
  video, source-limited label, and public correction history. Do not prepare or
  run attempt `16`.

## Recorded final MVP enhancement

The PRD now records a compliance-gated Industry Lens enhancement for aggregate
YouTube public-comment sentiment, themes, feedback, and questions as the final
MVP implementation slice before hackathon submission. It must wait until the
existing critical path is stable, and no YouTube API integration has yet been
authorized or implemented. Before enabling it, Audience Take must complete the
YouTube Analytics & Reporting audit application, explicitly obtain derived-
metrics permission, publish the required privacy/retention disclosures, and
meet the bounded sampling, provenance, labeling, data-minimization, and raw-data
refresh/deletion constraints in the PRD. Pending approval must be disclosed and
the integration must remain disabled rather than operating without permission.
