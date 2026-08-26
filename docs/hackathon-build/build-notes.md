# Audience Take — Guided Build Notes

## 2026-08-26 — Onboarding

- Guided build started inside the Resources stage.
- Confirmed product name: Audience Take.
- Confirmed central demo sequence: fan nomination → visible Parallel research → cited Scout Card with commitments and three pathways → social activation.
- Confirmed primary demonstration project: Junichiro Jackson, presented as an unclaimed fan nomination until creator verification.
- Confirmed user progression: fan → creator → industry professional.
- Confirmed initial B2B market: producers, studios, distributors, exhibitors, and streaming-platform research teams.
- Confirmed visual direction: film-festival and underground-magazine hybrid, influenced by Letterboxd, Sundance, and Are.na.
- Confirmed public/pro split: cultural public experience and calmer professional Slate View.
- Participant actively shaped the goal around both judge wow factor and post-hackathon product credibility.
- Onboarding interview rounds completed: 3.
- Deepening rounds: not applicable to onboarding.

## 2026-08-26 — Scope

- Approved the end-to-end fan nomination and Scout Card workflow as the critical path.
- Confirmed a bold landing page, simple nomination, animated agent activity, concise expandable Scout Card, and post-card social activation.
- Confirmed **Follow Project** as the primary relationship action, with meaningful commitments and structured Takes beside it.
- Confirmed working sign-in, a real Request to Claim action, and a pre-approved claimed-creator demonstration state.
- Confirmed a basic Scout Profile; activity streams, affinity matching, notifications, badges, and advanced moderation are deferred.
- Confirmed Junichiro Jackson as the primary demonstration project and approved three pathways: premium adult animated series, independent animated feature, and creator-direct serialized animation/publishing franchise.
- Confirmed seeded demonstration accounts and activity may be used only with clear demo labeling; at least one social action will be performed live.
- Confirmed the Industry Lens is inside every Scout Card as a core MVP requirement.
- Tarik retained full Slate View as a gated stretch goal: “let's do slate view for the mvp if we finished the other stuff before the deadline.”
- Confirmed one shared public view for all roles in the core MVP; specialized professional workflow is represented by Industry Lens.
- Scope deepening rounds completed: 0. Participant chose to write after mandatory scope beats.

## 2026-08-26 — PRD

- Approved landing hierarchy: mission hero, bold nomination, featured Scout Card, three-step explanation, and The Selects.
- Approved nomination fields: public URL and why it should grow required; what it could become and audience fit optional; up to five supporting links.
- Approved six visible agent stages and truthful source receipts.
- Approved persistent research runs and clearly labeled Partial Scout Cards with retry.
- Added **Suggest Evidence** to the core MVP with Community Lead provenance and five review outcomes.
- Approved commitments: Would Watch, Would Pay to Watch, Bring It to My City, and Would Back the Next Chapter.
- Approved separate fan pathway voting.
- Approved one 600-character structured Take per user per card and one-level, non-nested replies.
- Approved collapsed Scout Card hierarchy and authorized embedded media with fallback artwork.
- Approved creator claim request fields, pending state, pre-approved demonstration state, and strict creator-edit boundaries.
- Approved Scout Profile public defaults and a Public Activity toggle for follows and commitments.
- Approved canonical duplicate routing and unavailable-source preservation.
- Approved creator direct submission with verification-pending status.
- Approved editorial The Selects without search, advanced filters, or opaque ranking.
- Approved report reasons and review-state behavior.
- PRD deepening rounds completed: 0. Participant chose to write after mandatory PRD beats.

## 2026-08-26 — Technical Specification

- Approved an isolated `audience-take/` project directory so the hackathon build does not modify the unrelated application at the workspace root.
- Approved one repository containing a Next.js web app, a Python Google ADK agent service, canonical JSON contracts, Firebase configuration, infrastructure definitions, and end-to-end tests.
- Confirmed Firebase App Hosting/Auth/Firestore/Storage, private Cloud Run, Cloud Tasks, Vertex AI/Gemini, Google ADK, Parallel Search, and Secret Manager as the core stack.
- Confirmed four agent responsibilities: Source Analyst, Web Researcher, Evidence Editor, and Pathway Strategist; only the Web Researcher calls Parallel.
- Defined a durable six-stage research state machine with Firestore receipts, leases, idempotent retries, complete/partial/failed publication, and a visibly labeled previous-result fallback.
- Defined the Scout Card, Industry Lens, social actions, Suggest Evidence, creator claims, profiles, trust controls, and The Selects as concrete routes, records, and server commands.
- Confirmed native Audience Take signals remain separate from YouTube, Kickstarter, and other external commentary.
- Approved canonical JSON Schemas shared by TypeScript and Python.
- Approved layered tests: contract/unit tests, Firebase Emulator rules tests, Python agent tests, Playwright judge-journey coverage, and one deployed Gemini/Parallel smoke test.
- Kept Grafana observability and the professional Slate View gated behind a stable deployed core workflow.
- Specification deepening rounds completed: 0. Participant repeatedly approved the recommended architecture and directed the workflow to continue.

## 2026-08-26 — Build Checklist Draft

- Tarik approved handing checklist design and implementation sequencing to Codex.
- Tarik approved autonomous build mode with three visual pauses: landing/nomination, live research/Scout Card, and the deployed judge journey.
- The already-approved wow moment remains the sequencing ruler: a visible real Parallel research run produces a cited Scout Card with three pathways and activates the social layer.
- Risk-first ordering places durable tasks and the minimum deployed ADK/Parallel slice before the full Scout Card and social breadth.
- Git cadence is one clean commit after each verified checklist item; unrelated root-project changes remain untouched.
- Slate View and Grafana remain gated until the complete deployed core and judge journey pass.
- Draft contains 12 dependency-ordered implementation items and awaits the participant's workload gut-check before it is locked.

## 2026-08-26 — Build Checklist Approved

- Tarik confirmed the 12-item plan “feels like the right amount of work.”
- Clarified that the core MVP lets signed-in fans add their own overlooked project picks by nominating public films, potential series, short films, documentaries, web series, trailers, or Kickstarter projects.
- Locked Scout Profile labels: **My Picks** for nominations, **Following** for championed projects, and **My Takes** for published opinions. This uses the already-approved nomination/follow/Take data rather than adding a separate watchlist system.
- Checklist deepening rounds completed: 0. The hand-off path used the participant's final workload gut-check.
- The checklist is now the approved execution contract for `$build-project`.

## 2026-08-26 — Build Item 1 Complete

- Created the isolated `audience-take/` Git repository on branch `codex/build-mvp`; the unrelated workspace application remains untouched.
- Copied the full approved planning packet and social-layer idea documents into the new product repository.
- Established the Next.js web workspace, Python 3.12 Google ADK service environment, infrastructure/test directories, environment template, and product README.
- Added `PRODUCT.md` through the Impeccable workflow using the already-approved users, product truth, visual commitments, and evidence boundaries.
- Added six canonical JSON Schemas and Junichiro fixtures validated in both JavaScript and Python.
- Verification passed: web lint, TypeScript, Vitest, JSON contract validation, Ruff, mypy, and Pytest.
- Created a clean Git revert point: `chore: establish Audience Take foundation`.

## 2026-08-26 — Build Item 2 Complete

- Added Firebase browser/Admin initialization, Google and email authentication helpers, emulator routing, production-enforced App Check verification, safe same-origin `returnTo`, unique public profile creation, private role assignments, and project-scoped creator authorization.
- Added Firestore and Storage rules that expose only published, non-moderated public records, derive Public Activity from the profile toggle, hide run/claim/report/admin internals, and deny direct client writes to trusted collections.
- Added the required Firestore indexes, a guarded demo-profile seeder with explicit demo labels, Firebase emulator configuration, and reproducible local setup documentation.
- Closed two verification-environment gaps: installed OpenJDK 21 for Firebase emulators and declared `firebase-tools` as a project dev dependency.
- Verification passed: lint, TypeScript, 16 web unit tests, six shared contract fixtures, JSON/config validation, and nine Firestore/Storage emulator allow/deny tests.
- Residual deployment work is intentionally deferred to later checklist items: real provider enablement, production App Check keys, cloud IAM, and deployed Firebase configuration.

## 2026-08-26 — Build Item 3 Complete

- Built the responsive landing hierarchy, contact-sheet mission field, URL-first nomination ticket, authorized Junichiro source preview, compact research workflow, and uneven editorial Selects rail in the approved film-festival × underground-magazine world.
- Built the full fan/creator nomination form with required and optional fields, up to five supporting links, public-URL validation, creator verification-pending labeling, review state, accessible errors/loading, and preserved input.
- Added a locally hosted OFL-licensed League Gothic display face, real paper/ink texture, authored SVG primitives, keyboard focus treatment, reduced-motion behavior, and the URL → Research → Scout Card handoff motion.
- Completed the Impeccable workflow: approved contact-sheet comp, surface brief, asset manifest, one detector pass, two screenshot rounds, fresh finish review, final `disposition: ship`, and portable `DESIGN.md` plus `.impeccable/design.json`.
- Verification passed: lint, TypeScript, production build, 20 unit/component tests, responsive browser inspection, invalid-input preservation, creator-mode switching, and the five-link cap.
- Tarik approved visual pause 1 on 2026-08-26.

## 2026-08-26 — Build Item 4 Complete

- Added the authenticated `POST /api/nominations` command using the canonical nomination contract and existing Firebase ID-token/App Check verification.
- Added HTTPS-first source intake with explicit HTTP allowlisting, credential/local/private/reserved-address rejection, DNS verification, pinned-address HEAD probes, bounded redirect revalidation, response-size and MIME limits, and safe public error envelopes.
- Added stable URL canonicalization and SHA-256 fingerprints that remove fragments and trackers while preserving content identifiers and meaningful query parameters.
- Added a `sourceFingerprints/{fingerprint}` transaction contention point that atomically creates exactly one project shell, nomination, queued research run, and first event; duplicates route to the canonical Scout Card.
- Added post-transaction dispatch with durable dispatched/retryable-failure states so queue failure never loses a nomination.
- Updated the nomination client to send canonical fields plus Firebase ID and App Check tokens while preserving entered text on failure.
- Verification passed: web lint, TypeScript, 38 unit/route tests, and 10 Firebase emulator tests including concurrent Junichiro submissions that produced one fingerprint, project, nomination, run, and first event.
