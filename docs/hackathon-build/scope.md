# Audience Take — Hackathon Project Scope

Status: Approved scope for PRD development  
Hackathon: Agentic Cinema — Parallel track  
Target deadline: September 9, 2026 at 2:00 PM Pacific

## Project Name

**Audience Take**

Tagline: **The audience's take on what should be made next.**

## One-Line Summary

Audience Take is a social scouting platform where fans nominate overlooked screen projects, visible agents research them through Gemini and Parallel, and an evidence-backed Scout Card helps fans, creators, and industry professionals understand what the project could become and how to validate its next step.

## Product Thesis

Promising screen stories often emerge on YouTube, Kickstarter, and creator communities long before the film industry has a reliable way to evaluate them. Audience Take turns an overlooked public project into a shared, cited object that people can follow, champion, discuss, and evaluate.

The product is best understood as **Letterboxd for stories that are still becoming films, series, shorts, documentaries, events, or creator-owned franchises**. Unlike a generic social feed, participation is organized around the Scout Card. Unlike a generic research report, the card becomes a living social surface after the agent run completes.

## Scope Ruler

Tarik plans to work daily, including weekends, through the submission deadline. The practical delivery window is approximately two weeks.

The working allocation is:

- 10 days for the complete critical-path implementation
- 2 days for testing, accessibility, resilience, and visual polish
- 2 days for deployment, demonstration recording, repository preparation, and Devpost submission

The target is a polished, complete product loop rather than a broad but partially functioning social network. A feature may enter the hackathon MVP only if it strengthens the live demonstration and can be tested end to end.

## Target Users

### Primary: Fan scout

A fan who discovers an overlooked creator-led screen project and wants to help more people find it. The fan nominates the project, follows its progress, publishes a structured Take, and expresses meaningful support.

### Secondary: Creator

A creator who submits a project directly or discovers a fan-nominated Scout Card, requests to claim it, corrects project details, posts an update, and uses the evidence and pathways to plan a next experiment.

### Tertiary: Industry professional

A producer, studio researcher, distributor, exhibitor, or streaming research professional who reviews the same public Scout Card through its Industry Lens. A dedicated professional workspace is a stretch goal until real industry discovery clarifies the workflow.

## Problem

Online attention is fragmented and weakly defined. Views, likes, comments, and campaign activity do not automatically reveal:

- Which creator-led stories deserve deeper investigation
- Which format best fits an expandable project
- Whether people would watch, attend, back, or champion a next version
- What evidence supports a development or release hypothesis
- How a creator can turn attention into a bounded validation experiment
- How professionals can discover projects earlier without relying only on existing networks

Audience Take connects current public-web evidence with voluntary first-party audience commitments while keeping source data, audience opinion, creator-provided information, and agent inference visibly separate.

## Core Workflow

1. A public visitor lands on a bold mission-driven page explaining how fans can help find the next great screen story.
2. The visitor signs in and submits a supported public project URL through a prominent, simple nomination flow.
3. Audience Take checks for an existing Scout Card and labels the nomination as fan-submitted and unclaimed when appropriate.
4. An animated agent workflow shows meaningful progress while Gemini analyzes the source and Parallel researches the current public web.
5. The workflow reveals source discoveries and agent handoffs rather than displaying an unexplained loading spinner.
6. A bold, concise Scout Card appears with a project hook, source material, evidence, confidence, and three realistic next pathways.
7. The visitor can expand deeper research, citations, risks, comparable projects, and the Industry Lens without losing the card's approachable public summary.
8. The social layer activates: users follow the project, make meaningful commitments, publish a structured Take, and see existing demonstration participation.
9. The creator can request to claim the card; the demo also includes a pre-approved claimed-creator state that shows creator updates and controls.
10. An industry professional can inspect the Industry Lens on the same Scout Card and understand why the project merits further research.

## Primary Demonstration Project

**Junichiro Jackson** is the primary demonstration project.

The card must be presented as **Fan nomination — unclaimed by creator** unless actual creator verification is obtained. Audience Take must not imply creator endorsement, platform interest, acquisition interest, or rights ownership. Public sources are cited and linked; protected media is embedded or excerpted only where permitted.

The demonstration recommends three plausible pathways:

1. Premium adult animated series
2. Independent animated feature
3. Creator-direct serialized franchise combining animation and publishing

The recommendation is a research hypothesis, not a prediction or promise.

## What We Are Building

### 1. Mission-driven landing page

- Clear explanation of Audience Take and the fan-scout role
- Bold nomination call to action
- A small The Selects collection that makes the product feel inhabited
- Visual language combining a film-festival environment with an underground magazine

### 2. Authentication and nomination

- Public browsing
- Sign-in required for participation
- Clear, short nomination form for a supported public URL
- Structured questions: why it should grow, what it could become, and who it is for
- Duplicate detection and recoverable unsupported-link states

### 3. Visible agent research

- Animated progress with named phases and plain-language explanations
- Gemini source/story analysis
- Parallel Search used at runtime for current public-web research
- Inspectable source discoveries and citations
- Clear partial-failure and retry states
- No mocked partner integration presented as live research

### 4. Scout Card

- Bold project identity and concise hook
- Source and creator information with claim status
- Storyworld, themes, audience hooks, and expansion potential
- Current public-web evidence with citations
- Three pathway recommendations
- Confidence, risks, unresolved questions, and evidence provenance
- Expandable details that keep the default card engaging rather than overwhelming
- Shareable public URL

### 5. Industry Lens inside the Scout Card

The Industry Lens is a core MVP requirement, not a stretch goal. It includes:

- Three-pathway comparison
- Evidence and citations supporting each pathway
- Confidence, risks, and unresolved questions
- Comparable projects
- Creator claim status
- Audience-signal definitions and limitations
- Recommended next validation experiment
- As the final MVP slice, an approved bounded sample of public YouTube comments
  summarized as independently calculated sentiment, themes, constructive
  feedback, and common questions, with sample, date, coverage, and limitation
  labels. It remains disabled until YouTube explicitly approves the Analytics &
  Reporting derived-metrics use case.

It demonstrates B2B value without requiring a separate professional dashboard.

### 6. Focused social layer

- **Follow Project** as the primary relationship action
- Four meaningful commitment actions selected during PRD development
- Structured Take: why it should grow, what form fits it, and who it is for
- Audience Take-native activity visibly separated from external comments and public-web research
- Counts and labels that describe voluntary intent without claiming verified demand
- Seeded demonstration accounts and activity clearly identified as demonstration data
- At least one new Follow or commitment performed live during the demo

### 7. Basic Scout Profile

- Display name and optional bio
- Nominations
- Structured Takes
- Commitments or followed projects, subject to privacy choices finalized in the PRD
- No opaque influence score or follower-count hierarchy

### 8. Creator claim experience

- Working sign-in
- Real Request to Claim action and request state
- No promise of instant identity verification
- Pre-approved claimed-creator demonstration state
- Claimed creator can post or display at least one clearly labeled creator update

### 9. The Selects

- Small curated collection of seeded Scout Cards
- Clear explanation of why each project is surfaced
- Ranking must not claim to represent organic popularity
- The primary Junichiro Jackson card remains the complete demonstration

### 10. Essential trust and safety

- Report action for a Scout Card or public user contribution
- Visible creator-claim and demonstration-data labels
- Basic spam/rate-limit protections
- Empty, insufficient-data, unsupported-source, duplicate, and removed-content states
- No advanced moderation operation in the hackathon scope

## Gated Stretch Goal: Slate View

Slate View may be built only after every critical-path feature above is deployed, tested, visually polished, and ready to record.

The stretch version may include:

- Professional watchlist
- Filters by format, genre, pathway, and claim status
- Side-by-side Scout Card comparison
- Evidence-forward project summaries
- Navigation back to the full public Scout Card

Slate View must not delay submission readiness, partner-integration proof, testing, or the three-minute demo. If it is not built, the Industry Lens still provides the complete B2B story.

## What We Are Not Building

- General-purpose or infinite social feed — it distracts from the project-centered loop and adds cold-start pressure.
- Scout affinity matching — it requires real interaction volume and is not necessary to prove the core thesis.
- Notification center, digests, or email automation — useful for retention but not for the primary demo.
- Badges, hit-rate scoring, or reputation algorithms — outcomes do not yet exist, and premature scoring could mislead users.
- Full creator identity-verification operation — the MVP records requests and demonstrates a pre-approved state.
- Advanced moderation queue, appeals, trust tiers, or AI moderation — the MVP provides reporting and basic prevention only.
- Direct messages or broad groups — high safety cost with no benefit to the critical path.
- Payments, ticketing, reservations, escrow, or crowdfunding transactions — commitments are non-transactional intent signals.
- Complete YouTube comment ingestion or a general audience-scoring system built from YouTube data. The MVP includes only the bounded, approval-gated Industry Lens analysis defined above.
- Automated outreach or pitch submission in a creator's name.
- Claims of guaranteed demand, revenue, acquisition, distribution, or greenlight success.
- Dedicated mobile applications — the submission is a responsive web product.
- Grafana partner-track functionality as a second core integration — Parallel remains the selected track; optional observability cannot displace the critical runtime research workflow.

## Inspiration and References

- **Letterboxd:** project-centered social identity, following, and cultural conversation
- **Sundance:** discovery, curation, filmmaker possibility, and festival energy
- **Are.na:** calm exploration, collections, and visual curiosity
- **Kickstarter:** clear project storytelling followed by a meaningful commitment
- **Underground culture magazines:** bold typography, confident editorial hierarchy, and a feeling of finding something before the mainstream

The experience uses a cinematic neo-zine visual system: warm paper, near-black ink, acid yellow, electric blue, coral, and green. Public views feel cultural and energetic. Expanded evidence and the Industry Lens feel calmer and analytical while remaining recognizably part of the same product.

## Demo Data Policy

- Demonstration accounts may be created with separate test identities.
- Seeded follows, commitments, Takes, and projects are labeled as demo or sample activity.
- Seeded data must never be described as organic demand or an external community response.
- At least one user action is performed live to prove that the social layer is functional.
- Agent research presented as live must actually invoke the required runtime services; cached fallback data must be labeled when used.

## Demo Path

1. Open the landing page and state the mission: fans can help find the next great screen story.
2. Sign in as a fan scout and nominate Junichiro Jackson.
3. Watch the animated agent workflow analyze the project and call Parallel.
4. Reveal source discoveries as the Scout Card forms.
5. Land on the completed bold Scout Card.
6. Show the three pathway recommendations and expand their evidence.
7. Open the Industry Lens and show comparable projects, risks, confidence, and next experiment.
8. Follow the project and make one meaningful commitment live.
9. Show a structured Take and basic Scout Profile.
10. Show the creator claim request, then switch to the pre-approved claimed-creator state and reveal a creator update.
11. Return to The Selects or, only if completed, briefly show Slate View.

## Definition of Done

The MVP is ready when:

- A judge can complete the primary path in the deployed web product without developer intervention.
- The demo visibly calls Gemini/Google Cloud and Parallel at runtime.
- Every external research claim has a usable source link.
- The Scout Card remains valuable when the social sample is small.
- Native commitments are visibly distinct from public-web research and external commentary.
- Fan nomination and creator claim states cannot be confused.
- At least one live social action updates the card and profile correctly.
- Errors and sparse-data states do not fabricate a confident result.
- The experience is accessible, responsive, and coherent enough to feel like a product rather than a technical proof of concept.
- The public repository, license, hosted app, setup instructions, and three-minute demo can be completed without rebuilding core features.

## Submission Story

**A fan found the next breakout screen story before the industry did.**

The fan submits an overlooked project. Audience Take's agents visibly analyze it and use Parallel to research the current public web. A cited Scout Card emerges with three realistic pathways. Fans then follow and make meaningful commitments, the creator can claim the project, and professionals can inspect the same evidence through the Industry Lens.

The judge takeaway should be: **“Damn, this could be something the industry could use to find the next filmmaker.”**
