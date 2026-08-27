# Audience Take — Build Checklist

Status: Approved build contract  
Hackathon: Agentic Cinema — Parallel track  
Primary demonstration project: Junichiro Jackson

## Build Preferences

- **Plan ownership:** Codex sequences and executes the implementation from the approved documents.
- **Build mode:** Autonomous. This locks when `$build-project` begins.
- **Comprehension checks:** N/A; Tarik is an experienced AI-assisted product builder.
- **Git:** Create an initial Audience Take branch and commit after every completed, verified checklist item. Never include secrets or unrelated workspace changes.
- **Verification:** Automated checks after every item plus manual visual review at the three approved pauses.
- **Visual pauses:** After item 3 (landing/nomination), item 8 (live research and Scout Card reveal), and item 11 (deployed judge journey).
- **Check-in cadence:** Milestone-only. Pause for visual review, a decision that materially changes scope, a destructive/external action requiring authority, or a genuine blocker.
- **Scope gate:** Slate View and Grafana Studio Monitor remain closed until item 11 passes. They are optional and cannot delay the submission-ready core.
- **Wow moment:** A fan nomination visibly triggers real Parallel-powered agent research; a cited Scout Card emerges with three realistic pathways and immediately becomes a social object.
- **Working directory:** All implementation belongs under the isolated `audience-take/` directory.

## Definition Of Core Complete

The core is complete only when a public deployed build can perform the judge journey with a real Gemini/Parallel research run, publish a complete or honestly Partial Scout Card, show the Industry Lens, accept one fresh authenticated social action, and demonstrate the creator-claim bridge. A polished mock without the runtime partner call does not satisfy this gate.

## Checklist

- [x] **1. Create the isolated application foundation and shared contracts**
  Spec ref: `spec.md > Repository And File Structure`; `spec.md > Shared contract rule`
  What to build: Create the `audience-take/` monorepo with the Next.js web app, Python ADK service, contracts, Firebase, infrastructure, test, and documentation directories. Add canonical JSON Schemas and representative Junichiro fixtures for nomination, source, evidence claim, pathway, research event, and Scout Card. Add formatting, linting, type-checking, and contract-validation scripts without touching the unrelated root application.
  Acceptance: The repository structure matches the approved architecture; TypeScript and Python can validate the same fixtures; no credentials or generated secrets are committed; the application has a documented local setup path.
  Verify: From `audience-take/`, run the workspace install, lint, TypeScript type check, Python lint/type check, and shared contract tests. Confirm `git status` contains only Audience Take files before committing.

- [x] **2. Establish Firebase identity, data rules, and local emulation**
  Spec ref: `spec.md > Authentication, Authorization, And Rules`; `spec.md > Core Data Model`; `spec.md > Required Firestore Indexes`
  What to build: Configure Firebase Authentication, Firestore, Storage, Admin SDK access, App Check integration points, emulator configuration, initial collections/indexes, and server authorization helpers. Support Google and email sign-in, safe `returnTo`, profile creation, public/private field boundaries, and project-scoped role checks. Seed clearly labeled fan, creator, and industry/demo profiles without real credentials in source control.
  Acceptance: Public published records are readable; private claim/report/run internals are not; direct client writes to trusted collections are denied; multiple test accounts can sign in; creators cannot edit agent evidence or social history.
  Verify: Run Firebase Emulator Suite rule tests covering anonymous reads, denied writes, Public Activity privacy, creator boundaries, and admin-only operations. Run route-guard tests with missing, invalid, and valid identity/App Check states.

- [x] **3. Build the visual foundation, landing page, and nomination experience**
  Spec ref: `spec.md > Screen And Route Specification > / — Landing page`; `spec.md > /nominate — Nomination form`; `prd.md > Epic 1`
  What to build: Implement the film-festival/underground-magazine design system using licensed Neobrutalism.com Pro primitives and product-specific components. Build the responsive landing hierarchy, mission hero, bold nomination entry, featured Junichiro preview, three-step explanation, and editorial The Selects preview. Build the full nomination form with required/optional fields, up to five supporting links, fan/creator submission modes, validation, and accessible loading/error states.
  Acceptance: A first-time visitor understands the mission and can begin a nomination immediately; the form preserves input on errors; creator submissions receive the approved verification-pending label; keyboard, contrast, focus, reduced-motion, and mobile behavior meet the quality requirements.
  Verify: Run component/accessibility tests and responsive browser checks. Manually inspect desktop and mobile landing/nomination screens with real typography, labels, empty/error states, and Junichiro imagery. **Visual pause 1: Tarik approves the landing page and nomination flow before autonomous work continues.**

- [x] **4. Implement nomination persistence, canonical deduplication, and safe source intake**
  Spec ref: `spec.md > Server Command API > Nomination and research`; `spec.md > Research Run Data Flow > Accept and deduplicate`; `spec.md > URL, Embed, And Media Policy`
  What to build: Implement the authenticated nomination endpoint, shared validation, safe URL normalization, source fingerprinting, supporting-link handling, duplicate routing, project shell creation, nomination provenance, queued research run creation, and first progress event. Enforce public HTTP(S) sources, safe redirects, SSRF protections, response limits, and consistent error envelopes.
  Acceptance: A new valid URL creates exactly one project/run; repeat and concurrent submissions route to the canonical Scout Card; unsafe/private URLs are rejected; fan and creator provenance is preserved; queue-dispatch failure does not lose the nomination.
  Verify: Run URL security/canonicalization fixtures, concurrent duplicate tests, endpoint validation/authorization tests, and a Firebase emulator integration test that submits Junichiro twice and confirms one canonical project.

- [x] **5. Make research runs durable with Cloud Tasks, Cloud Run, and realtime receipts**
  Spec ref: `spec.md > Research Run Data Flow > Dispatch durable work`; `spec.md > Acquire a run lease`; `spec.md > /research/[runId] — Live research progress`
  What to build: Configure the Cloud Tasks queue contract, private OIDC-authenticated Cloud Run task endpoint, least-privilege service identities, run leases, heartbeats, attempt/version tracking, idempotent retry behavior, and ordered Firestore events. Build the research progress screen with the six approved stages, real event subscriptions, truthful receipts, refresh/leave-and-return persistence, failure states, and reduced-motion behavior.
  Acceptance: A queued run continues without an open browser; unauthorized Cloud Run invocation fails; duplicate task delivery does not duplicate stage output; refresh restores the correct stage; the UI never displays fabricated internal reasoning.
  Verify: Run local handler/event tests and a staging task invocation. Force duplicate delivery and an expired lease, then confirm only one valid run version proceeds. Refresh the progress screen mid-run and compare visible events with stored events/logs.

- [x] **6. Deploy the minimum live ADK and Parallel research slice**
  Spec ref: `spec.md > Agent Responsibilities And Contracts > Orchestrator, Source Analyst, Web Researcher`; `spec.md > Parallel Integration Contract`
  What to build: Implement the ADK orchestrator, Source Analyst, source reader, Web Researcher, and the single server-side Parallel Search tool. Generate structured source analysis and story/creator mapping, form bounded research objectives and two or three diverse queries, call Parallel at runtime, normalize/deduplicate returned sources, persist citations, and publish safe tool receipts. Store the Parallel key in Secret Manager.
  Acceptance: A deployed Junichiro run invokes Gemini and Parallel from Cloud Run; only the Web Researcher can call Parallel; sources retain URL/title/date/excerpt/query provenance; user-supplied sources are not mislabeled as Parallel discoveries; unsupported private data is never claimed.
  Verify: Run fixture-based agent/tool tests, then one deployed smoke run. Confirm the Firestore run records a nonzero Parallel request/source count and that stored citations open to the expected public pages. Preserve the run ID for submission proof.

- [x] **7. Add evidence editing, three pathways, atomic publication, and partial recovery**
  Spec ref: `spec.md > Agent Responsibilities And Contracts > Evidence Editor`; `spec.md > Pathway Strategist`; `spec.md > Scout Card Assembly Contract`; `spec.md > Research Run Data Flow > Recover honestly`
  What to build: Implement the Evidence Editor, Pathway Strategist, evidence ledger, claim/source relationships, comparables, confidence/limitations, three-pathway contract, recommended next experiments, schema validation, versioned atomic card publication, retry endpoint, and complete/partial/failed recovery. Implement the visibly labeled previously generated Junichiro fallback without allowing it to masquerade as the live run.
  Acceptance: A complete Junichiro card contains the approved series, feature, and creator-direct pathways with citations, risks, questions, and experiments; a source/tool failure publishes an honest Partial Scout Card only when useful evidence exists; no-useful-evidence runs fail safely; named platforms are not presented as interested without proof.
  Verify: Run contract and fixture tests for supported, conflicting, missing, and overstated evidence. Force each stage to fail and verify complete/partial/failed decisions, missing-section labels, idempotent retry, immutable prior versions, and the exact fallback label.

- [x] **8. Build the bold Scout Card and embedded Industry Lens**
  Spec ref: `spec.md > /projects/[slug] — Scout Card`; `spec.md > Scout Card Assembly Contract`; `spec.md > Industry Lens`
  What to build: Implement the shareable server-rendered Scout Card with bold collapsed hierarchy, embedded trailer/poster fallback, project/provenance/claim labels, story and creator context, evidence ledger and citations, separately labeled external-signal analysis, pathway comparison, source ledger, confidence, corrections, and unavailable-media state. Build the calmer expandable Industry Lens with comparables, risks, signal limitations, and next experiment.
  Acceptance: Someone can understand the project and why it matters from the collapsed card, then inspect professional evidence without leaving the card; citations are reachable; partial/missing/unavailable states are explicit; the interface never merges external commentary into native counts.
  Verify: Run complete/partial/unavailable/fallback rendering tests, metadata/share checks, accessibility checks, and mobile/desktop visual review using the deployed Junichiro run. **Visual pause 2: Tarik approves the live agent-to-Scout-Card reveal and Industry Lens before autonomous work continues.**

- [x] **9. Activate the native social layer and Scout Profiles**
  Spec ref: `spec.md > Native Social Behavior`; `spec.md > /scouts/[handle] — Scout Profile`; `prd.md > Epic 5`; `prd.md > Epic 8`
  What to build: Add transactional Follow Project, four commitments, one pathway vote, one structured Take per user, edit/withdraw, one non-nested reply per user per Take, realtime counters, sign-in return behavior, and public Scout Profiles with the Public Activity toggle. Organize profiles into **My Picks** for projects the fan nominated, **Following** for projects they champion, and **My Takes** for their published opinions. Keep seeded activity visibly labeled and third-party commentary separate.
  Acceptance: Deterministic IDs and transactions prevent duplicate counts; moving a vote changes both pathway totals correctly; withdrawn actions disappear from eligible public counts; follows/commitments respect Public Activity while My Picks and My Takes remain public; one fresh action updates the card live.
  Verify: Run route, concurrency, counter-reconciliation, uniqueness, privacy, and emulator rule tests. Execute the multi-account social journey and confirm one live Follow/commitment changes the deployed Scout Card without reload.

- [ ] **10. Complete Suggest Evidence, creator claiming, updates, and trust controls**
  Spec ref: `spec.md > Suggest Evidence Workflow`; `spec.md > Creator Claim And Ownership`; `spec.md > Rate Limits And Abuse Controls`; `prd.md > Epics 6, 7, 9`
  What to build: Implement supporting-link intake during nomination, post-card Suggest Evidence, Community Lead provenance, all five review outcomes, real Request to Claim, pending/rejected/approved states, the pre-approved demo creator, project-scoped creator updates/media, report reasons/states, rate limits, demo labels, and audit-preserving corrections.
  Acceptance: Suggested evidence cannot affect confidence before review; incorporated sources retain provenance; claim requests store real pending actions; approved creators can edit only creator-owned fields; reports and source/media changes preserve historical integrity; uploads use server-selected safe paths.
  Verify: Run evidence state-machine tests, creator/admin authorization tests, upload validation tests, report/rate-limit tests, and a manual three-role walkthrough showing fan, pending claimant, and pre-approved creator states.

- [ ] **11. Deploy, harden, polish, and rehearse the complete judge journey**
  Spec ref: `spec.md > Testing Strategy`; `spec.md > Deployment Specification`; `spec.md > Demo And Submission Flow`; `prd.md > PRD Definition of Done`
  What to build: Deploy Firestore rules/indexes, Storage rules, the private ADK Cloud Run service, Cloud Tasks queue, Secret Manager binding, and Next.js application on Firebase App Hosting. Add structured logs, production App Check, security headers, accessible responsive polish, share metadata, demo seeding, automated Playwright coverage, a demo runbook, and the labeled fallback. Reconcile all counters and manually audit Junichiro citations and wording. As the final MVP implementation slice, complete the YouTube Analytics & Reporting compliance application and, only after explicit derived-metrics approval, add bounded public-comment sentiment, themes, feedback, and questions to the Industry Lens with the PRD's provenance, retention, privacy, and separation rules.
  Acceptance: The public build completes the critical fan → agents → card → Industry Lens → social → claim story; a real deployed Parallel call is proven; approved YouTube comment analysis is independently labeled and never merged into native signals; seed/demo activity is labeled; failures are honest; automated tests pass; no secrets, broken citations, dead controls, placeholder copy, or unrelated files remain. If YouTube approval is pending, the integration stays disabled and the submission materials disclose the pending external gate.
  Verify: Run the full lint/type/unit/contract/emulator/Python/Playwright suite, dependency/security checks, production smoke test, accessibility/performance review, and the timed three-minute demo twice—once live and once with an intentionally triggered fallback. Add comment pagination, quota, disabled-comments, empty-sample, retention/deletion, provenance-label, and native-signal-separation tests before enabling the YouTube slice. **Visual pause 3: Tarik approves the deployed judge journey and submission screenshots.**

- [ ] **12. Prepare the Devpost handoff**
  Spec ref: `spec.md > Demo And Submission Flow`; `prd.md > Submission Proof Points`
  What to build: Gather the product story, architecture explanation, AI/Parallel proof, primary screenshots, public application URL, public repository and open-source license, setup instructions, data-policy notes, test evidence, live/fallback demo instructions, three-minute video plan, Junichiro attribution/labels, and the planning documents needed for submission preparation. Explain what is truly live, seeded, partial, pre-approved, and deferred.
  Acceptance: The handoff proves originality, runtime Google/Parallel integration, product impact, technical execution, and responsible data boundaries; every required link works; Slate View/Grafana are described only if actually completed; the participant has everything needed to run `$prepare-submission`.
  Verify: Review the handoff against the current official Devpost submission requirements, open every public link in a clean session, confirm the video is within the required duration, and confirm the next command is `$prepare-submission`.

## Stretch-Gate Decision

After item 11 passes, estimate remaining time and risk. Open at most one stretch slice:

1. **Slate View** if it strengthens the industry-research story without changing permissions or data models.
2. **Grafana Studio Monitor** if it can be added from existing structured telemetry without destabilizing the core.
3. Otherwise spend the time on demo clarity, citation review, accessibility, performance, and submission assets.

The default decision is no stretch feature. Passing the public judge journey is more important than broader feature count.
