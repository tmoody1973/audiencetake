# Audience Take — Product Requirements Document

Status: Approved product requirements for technical specification  
Product: Audience Take  
Hackathon: Agentic Cinema — Parallel track  
Target: Responsive web MVP by September 9, 2026

## Product Summary

Audience Take is a social scouting platform for screen stories that have not yet received a traditional industry greenlight. Fans nominate overlooked public projects, visible agents analyze the source and research the public web, and the platform publishes a cited Scout Card with three realistic development or release pathways.

The Scout Card then becomes a living social object. Fans follow it, make defined commitments, vote on pathways, publish structured Takes, and suggest evidence. A creator can request to claim the card and publish creator updates. An industry professional can open the Industry Lens inside the same card to inspect comparisons, confidence, risks, evidence, and a recommended validation experiment.

The primary demonstration uses Junichiro Jackson and presents it as a fan nomination that is unclaimed by the creator unless real verification is obtained.

## Product Promise

**The audience's take on what should be made next.**

Audience Take helps a fan say, “This story deserves more,” and turns that conviction into something a creator or industry professional can inspect without confusing enthusiasm with verified demand.

## Product Goals

1. Make it easy and exciting for a fan to nominate an overlooked screen project.
2. Make agent work visible, credible, and understandable rather than hiding it behind a loading spinner.
3. Produce a Scout Card that is useful even when community participation is sparse.
4. Transform the completed card into a focused social surface centered on meaningful action.
5. Give creators a safe route to claim, correct, and develop their project without rewriting fan or agent history.
6. Demonstrate credible professional value through an Industry Lens inside every Scout Card.
7. Show real runtime use of Gemini, Google Cloud, and Parallel during the hackathon demonstration.

## Non-Goals

- Predicting guaranteed demand, revenue, acquisition, distribution, or greenlight success
- Acting as an authorized representative for an unclaimed creator
- Sending pitches or outreach in a creator's name
- Building a general-purpose social network or infinite feed
- Building direct messages, groups, or a creator marketplace
- Processing payments, tickets, crowdfunding, or escrow
- Building a complete identity-verification department
- Building an advanced moderation operation or appeals system
- Scoring individual creators, fans, or scouts with one opaque number
- Building taste-matching, recommendation, badge, or notification systems for the hackathon MVP
- Building a separate professional dashboard before the public experience is deployed and polished

## Target Users

### Fan scout

Someone who discovers an overlooked public project and wants to help it reach the right people. The fan should feel like a curator or early scout rather than a passive reviewer.

Primary desired outcome: create or find a Scout Card, follow the project, and leave one meaningful signal.

### Creator

Someone who owns or represents a project already nominated by a fan, or who wants to submit their own public project.

Primary desired outcome: request ownership, understand the evidence and audience response, publish an update, and choose a next validation step.

### Industry professional

A producer, studio researcher, distributor, exhibitor, or streaming-platform researcher assessing emerging projects.

Primary desired outcome: understand the opportunity, evidence, risks, claim status, and most plausible next experiment without interpreting fan enthusiasm as guaranteed commercial demand.

### Public visitor

Someone who is not signed in but arrives through the landing page or a shared Scout Card.

Primary desired outcome: understand the product, browse public Scout Cards, and know exactly what signing in would allow them to do.

## Product Vocabulary

- **Scout Card:** the central public home for one project.
- **Take:** a structured fan argument explaining why a project should grow, the preferred pathway, and optionally who it is for.
- **Commitment:** a voluntary, explicitly defined statement of intent such as Would Watch or Would Back the Next Chapter.
- **Pathway vote:** a fan's preference among the three agent-recommended next forms.
- **Audience Pulse:** a transparent summary of Audience Take-native commitments, votes, and Takes.
- **Industry Lens:** an expandable evidence-forward view inside a Scout Card.
- **The Selects:** an editorially curated collection of promising Scout Cards.
- **Community Lead:** a public supporting source suggested by a fan but not yet accepted as verified evidence.
- **Creator update:** a post published from an approved claimed-creator account and visually distinguished from fan and agent content.
- **Slate View:** a gated stretch-goal workspace for professional project comparison and watchlists.

## Product Principles

1. **Project-centered:** Scout Cards, not people or feeds, are the center of the experience.
2. **Commitment over likes:** every visible action has a defined meaning.
3. **Evidence stays inspectable:** claims link to sources and show provenance.
4. **Intent is not demand:** voluntary participation never becomes a guaranteed forecast.
5. **Fans scout; creators represent:** an unclaimed fan nomination never implies creator authorization.
6. **Useful when quiet:** a card remains valuable with zero or few social signals.
7. **Partial truth beats false certainty:** incomplete research is labeled rather than concealed or invented.
8. **Cultural outside, analytical inside:** public surfaces feel energetic; expanded evidence remains calm and legible.
9. **Demo data is honest:** seeded activity is visibly identified as sample or demonstration activity.

## Experience and Visual Direction

Audience Take should feel like a hybrid of a film-festival environment and an underground culture magazine, influenced by Letterboxd, Sundance, and a touch of Are.na.

The public product uses warm paper, near-black ink, acid yellow, electric blue, coral, and verified-evidence green. Typography is bold and editorial. Cards are tactile and poster-like. Expanded evidence, citations, and Industry Lens panels use calmer paper surfaces and denser but readable information hierarchy.

Meaning cannot depend on color alone. Statuses use text labels and icons. Motion explains agent progress but respects reduced-motion preferences. The experience must remain readable and navigable on mobile and desktop.

## Information Architecture

### Public navigation

- Home
- The Selects
- Nominate
- Scout Card
- Scout Profile
- Sign in or account menu

### Signed-in additions

- My Profile
- My Nominations
- Followed Projects
- Creator claim status, when applicable

### Scout Card sections

1. Project hero and media
2. Claim and provenance status
3. Follow and commitments
4. Short agent summary
5. Three pathway cards and pathway vote
6. Audience-signal snapshot
7. Expanded evidence and sources
8. Industry Lens
9. Takes and one-level replies
10. Creator updates
11. Suggested Evidence and Community Leads
12. Report action and update history

## Role Capabilities

| Action | Public visitor | Signed-in fan | Claim-pending creator | Approved creator | Industry professional |
|---|---:|---:|---:|---:|---:|
| Browse public Scout Cards | Yes | Yes | Yes | Yes | Yes |
| Open evidence and Industry Lens | Yes | Yes | Yes | Yes | Yes |
| Nominate a project | Sign-in prompt | Yes | Yes | Yes | Yes |
| Follow or commit | Sign-in prompt | Yes | Yes | Yes | Yes |
| Publish a Take or reply | Sign-in prompt | Yes | Yes | Yes | Yes |
| Suggest Evidence | Sign-in prompt | Yes | Yes | Yes | Yes |
| Request creator claim | Sign-in prompt | Yes | Pending | Already approved | Yes |
| Edit creator-provided project details | No | No | No | Yes | No |
| Publish creator update | No | No | No | Yes | No |
| Edit agent evidence or fan history | No | No | No | No | No |
| Report content | Sign-in prompt | Yes | Yes | Yes | Yes |

Industry professional is an audience role rather than a special permission tier in the core MVP. The Industry Lens is public and evidence-forward. Special professional permissions belong to later Slate View research.

## Core User Journey

1. A visitor opens the landing page and immediately understands that fans can help find the next great screen story.
2. The visitor sees a bold Nominate a Project action, a featured Scout Card, a three-step explanation, and The Selects.
3. The visitor signs in and submits a public project URL plus a short reason the project should grow.
4. Audience Take checks for an existing Scout Card.
5. A new nomination begins a visible six-stage research run.
6. Source receipts and status updates appear as useful work completes.
7. The finished or partial Scout Card opens automatically.
8. The fan follows the project, makes a commitment, votes on a pathway, or publishes a Take.
9. The fan may suggest evidence the agent missed.
10. The creator may request to claim the card.
11. An industry professional opens the Industry Lens to evaluate the opportunity and next experiment.

## Epic 1: Discover and Nominate

### User story 1.1 — Understand the mission

As a public visitor, I want to understand Audience Take immediately so that I know why nominating a project matters.

Acceptance criteria:

- The first screen states that fans can help find the next great screen story.
- A primary **Nominate a Project** action appears without scrolling on common desktop and mobile layouts.
- The page shows one featured Scout Card or credible project example.
- The page explains the sequence **Nominate → Agents Scout → Audience Takes Action**.
- The page shows The Selects below the explanation.
- A public visitor can browse Scout Cards without signing in.
- Any participation action clearly explains that sign-in is required.

### User story 1.2 — Nominate an overlooked project

As a fan, I want a short nomination flow so that I can surface a project without completing a lengthy application.

Required fields:

- Public project URL
- Why should this grow?

Optional fields:

- What could it become?
- Who is it for?
- Up to five supporting public links

Acceptance criteria:

- A signed-out visitor who begins nomination is returned to the nomination after successful sign-in.
- The form clearly distinguishes required and optional fields.
- The project URL is validated before research begins.
- A clear error appears for malformed, unsupported, private, deleted, or unreachable URLs.
- Supporting links are labeled fan-supplied and do not enter verified evidence automatically.
- The user sees a final review state before starting the agent run.
- Successful submission creates a visible nomination state and begins research.

### User story 1.3 — Avoid duplicate cards

As a fan, I want to be routed to an existing Scout Card so that community activity and evidence are not fragmented.

Acceptance criteria:

- When a matching canonical source already has a Scout Card, the app does not create a second card.
- The user is taken to the existing Scout Card.
- The original nomination and nominator remain credited.
- The arriving user is invited to Follow, commit, vote, publish a Take, or Suggest Evidence.
- The duplicate event is not displayed as a new organic nomination.

### User story 1.4 — Submit as a creator

As a creator, I want to identify that I am submitting my own project so that the card begins the appropriate claim process.

Acceptance criteria:

- The nomination flow offers **Nominate a Project** and **Submit My Project**.
- A creator submission uses the same URL-first project intake.
- The creator declares their connection to the project and begins a claim request.
- Until approved, the card says **Creator-submitted — verification pending**.
- The creator cannot use pending status to edit agent evidence or suppress fan activity.

## Epic 2: Watch the Agents Scout

### User story 2.1 — Understand what the agents are doing

As a nominator, I want visible, truthful progress so that I trust the resulting Scout Card.

The six stages are:

1. Reading the source
2. Mapping the story and creator
3. Searching the public web with Parallel
4. Checking evidence and comparables
5. Building three pathways
6. Publishing the Scout Card

Acceptance criteria:

- The active stage, completed stages, and remaining stages are visually distinct.
- Every stage has a plain-language description.
- Source receipts appear when a real source is discovered or processed.
- The interface does not display fabricated chain-of-thought or fake source activity.
- Parallel is visibly named when its runtime search stage occurs.
- Users may open source receipts without losing run progress.
- Reduced-motion users receive equivalent status updates without required animation.

### User story 2.2 — Leave and return during research

As a nominator, I want research progress to persist so that refreshing or closing the page does not lose the run.

Acceptance criteria:

- Refreshing the research page restores the current known run state.
- Returning later shows the active stage, completed receipts, finished card, or partial card.
- A completed run does not start again unless the user explicitly requests a refresh.
- Two tabs viewing the same run do not create duplicate cards.

### User story 2.3 — Receive an honest partial card

As a user, I want useful completed research even if one step fails so that the platform remains resilient without hiding uncertainty.

Acceptance criteria:

- If sufficient useful work completed, the app publishes a **Partial Scout Card**.
- The card names incomplete sections and the failed or unavailable stage in plain language.
- Completed sources and evidence remain accessible.
- Missing sections never contain invented placeholders presented as findings.
- The card offers **Retry Missing Research**.
- A successful retry updates the card and records what changed.
- If no useful result exists, the app shows a recoverable failed-run state instead of an empty card.

### User story 2.4 — Refresh research deliberately

As a creator or fan, I want to request updated research so that a card can incorporate newer public evidence.

Acceptance criteria:

- A refresh action explains that recommendations may change.
- Existing evidence and social activity remain visible while refresh runs.
- The updated card records the refresh date.
- Material recommendation changes are summarized.
- A refresh never erases creator updates, Takes, follows, commitments, or prior provenance.

## Epic 3: Explore the Scout Card

### User story 3.1 — Understand the project quickly

As any visitor, I want the collapsed Scout Card to communicate the opportunity without overwhelming me.

The initial card view shows:

- Title and concise hook
- Project thumbnail or hero artwork
- Embedded public trailer, episode, or source video when permitted
- Source-platform attribution
- Creator and claim status
- Follow Project action
- Four commitment actions
- Short agent summary
- Three pathway cards
- Audience-signal snapshot

Acceptance criteria:

- The project hook, claim status, and primary actions are visible before deep evidence.
- Media uses authorized embeds, source thumbnails, creator-provided assets, or a fallback editorial poster.
- The app does not silently copy and rehost protected media.
- Unavailable media has an accessible fallback.
- The card has a stable, shareable public URL.
- Shared links open the same canonical Scout Card.

### User story 3.2 — Expand details progressively

As a curious visitor, I want to expand deeper analysis without leaving the Scout Card.

Expandable sections include:

- Storyworld and themes
- Creator and project history
- Audience hooks
- Evidence and source list
- Comparable projects
- Full pathway reasoning
- Industry Lens
- Takes and replies
- Creator updates
- Suggested Evidence
- Update and provenance history

Acceptance criteria:

- Each section can be opened independently.
- Opening a section does not reset social-action state or media playback unnecessarily.
- Evidence claims link to their supporting sources.
- The interface distinguishes source facts, fan opinion, creator-provided information, agent inference, and demo data.
- A user can return to the concise summary without losing their place.

### User story 3.3 — Compare three plausible pathways

As a fan, creator, or professional, I want three distinct pathways so that I can evaluate alternatives rather than accept one deterministic answer.

For Junichiro Jackson, the demonstration pathways are:

1. Premium adult animated series
2. Independent animated feature
3. Creator-direct serialized franchise combining animation and publishing

Acceptance criteria:

- Exactly three primary pathways appear in the hackathon Scout Card.
- Each pathway includes a short rationale, supporting evidence, major risk, confidence label, and next experiment.
- Pathways are written as hypotheses, not predictions or guarantees.
- Fans can vote for one preferred pathway and later change or withdraw that vote.
- Pathway-vote totals are separate from agent confidence.

## Epic 4: Use the Industry Lens

### User story 4.1 — Evaluate professional relevance

As an industry professional, I want an evidence-forward view inside the Scout Card so that I can decide whether deeper investigation is warranted.

The Industry Lens includes:

- Side-by-side three-pathway comparison
- Evidence and citations for each pathway
- Confidence labels and explanation
- Risks and unresolved questions
- Comparable projects
- Creator claim status
- Definitions and limitations of audience signals
- Recommended next validation experiment

Acceptance criteria:

- Industry Lens is accessible from every complete or partial Scout Card.
- The view remains useful when there are zero native audience signals.
- Agent confidence is not displayed as a probability of commercial success.
- Fan commitments are labeled voluntary self-reported intent.
- Demo/sample participation is visibly marked.
- Public-web evidence, native signals, creator information, and inference have distinct labels.
- Every externally verifiable claim has a usable citation or an explicit insufficient-evidence state.

### User story 4.2 — Understand the next experiment

As a creator or professional, I want one bounded validation recommendation so that the analysis leads to action.

Acceptance criteria:

- The card recommends one next validation experiment tied to the selected or strongest pathway.
- The experiment states its purpose, participant action, and what outcome would be learned.
- The experiment does not claim to guarantee acquisition or demand.
- The experiment does not charge money in the MVP.
- If evidence is insufficient, the recommendation says what must be learned first.

## Epic 5: Follow and Champion

### User story 5.1 — Follow a project

As a fan, I want to follow a project so that it becomes part of my scouting identity and I can return to it.

Acceptance criteria:

- Follow Project is the primary relationship action on the Scout Card.
- A signed-out user receives a sign-in prompt and returns to the same card afterward.
- Following updates the button state immediately.
- The followed project appears on the user's profile or followed-projects view according to their public-activity choice.
- A user can unfollow without removing earlier Takes or commitments.
- Seeded follows are labeled as demo activity where displayed.

### User story 5.2 — Make a meaningful commitment

As a fan, I want to state how I would support a project so that my action has more meaning than a generic like.

The four commitments are:

- **Would Watch**
- **Would Pay to Watch**
- **Bring It to My City**
- **Would Back the Next Chapter**

Acceptance criteria:

- Each commitment includes a short definition available before confirmation.
- A user may select multiple different commitments but only once per commitment type.
- A user may change or withdraw a commitment.
- Bring It to My City asks for an explicit city before recording the action.
- No commitment is presented as a verified purchase, reservation, or payment.
- Counts update after a successful action.
- Audience Pulse shows definitions, sample size, time window, and demo-data labeling.

### User story 5.3 — Publish a structured Take

As a fan, I want to explain my reasoning so that the project receives useful context rather than a star rating.

Take fields:

- Required: Why should this grow?
- Required: Preferred pathway
- Optional: Who is it for?
- Combined maximum: 600 characters

Acceptance criteria:

- A user can publish one primary Take per Scout Card.
- The user can edit or withdraw their Take.
- Edited Takes show an edited state.
- A withdrawn Take no longer appears publicly or in Audience Pulse summaries.
- A Take is labeled fan opinion and is never presented as an agent finding.
- The preferred pathway updates the separate fan pathway-vote summary.

### User story 5.4 — Reply without creating a complex thread

As a signed-in user, I want to respond briefly to a Take so that a small amount of conversation can occur around useful scouting opinions.

Acceptance criteria:

- Each signed-in user may publish one reply to a Take.
- Replies do not nest beneath other replies.
- Reply authors can edit or withdraw their own reply.
- Creator replies carry an Approved Creator label only when the creator claim is approved.
- Reporting is available on every Take and reply.
- The MVP does not expose sorting, reactions on replies, or deep thread controls.

### User story 5.5 — See an honest Audience Pulse

As any visitor, I want a concise summary of native participation so that I understand what the current community has actually said.

Acceptance criteria:

- Audience Pulse uses only Audience Take-native follows, commitments, pathway votes, Takes, and explicit city interest.
- YouTube comments, Kickstarter information, and public-web discussion never enter native counts.
- External commentary, if shown, appears in a separately labeled source-analysis area.
- Sparse data produces an **Early signal — limited participation** state.
- Zero participation produces an inviting empty state rather than an invented summary.
- Demo activity is included only with a clear Demo or Sample label.

## Epic 6: Suggest Evidence

### User story 6.1 — Add a source the agents missed

As a fan, I want to suggest relevant public evidence so that local or niche knowledge can improve the Scout Card.

Entry points:

- Up to five optional supporting links during nomination
- **Suggest Evidence** on an existing Scout Card

Acceptance criteria:

- Only signed-in users can submit a source.
- The submission asks for a public URL and a short explanation of relevance.
- The source first appears as a **Community-submitted lead**.
- The card records submitter, submission time, and review status.
- The source cannot alter evidence or confidence before review.
- Duplicate, private, unsafe, irrelevant, or inaccessible links receive a clear result.

### User story 6.2 — Understand source review status

As a source contributor, I want to know how the platform handled my suggestion so that the evidence process feels transparent.

Allowed statuses:

- Verified and incorporated
- Relevant supporting source
- Conflicts with existing evidence
- Could not verify
- Rejected: unrelated, unsafe, private, or duplicate

Acceptance criteria:

- Every submitted source receives one visible status.
- Accepted sources show which claim or section they support.
- Conflicting sources appear as unresolved evidence rather than being silently discarded.
- Could not verify does not influence pathway confidence.
- If incorporation materially changes a pathway, the card records what changed.
- A creator may dispute a source but cannot delete it without review.

## Epic 7: Claim and Develop

### User story 7.1 — Request a creator claim

As a creator or representative, I want to request control of creator-specific fields so that I can participate without rewriting the card's public history.

Claim request asks for:

- Role or relationship to the project
- Project-connected email or public professional link
- Short optional context

Acceptance criteria:

- An unclaimed card prominently shows **Fan nomination — unclaimed by creator**.
- Request to Claim requires sign-in.
- A submitted request changes the requesting user's view to **Claim pending**.
- Pending status does not grant edit or creator-post permissions.
- The public card does not imply the creator is verified while the request is pending.
- The demo can switch to a separately prepared approved-creator account without falsely approving the nominating fan.

### User story 7.2 — Use approved creator controls

As an approved creator, I want to correct creator-provided information and post updates so that the card can reflect current project activity.

Acceptance criteria:

- Approved creator status is clearly visible.
- Creators may edit creator-provided description, official links, and authorized media.
- Creator edits are labeled creator-provided.
- Creators may publish, edit, and withdraw creator updates.
- Creator updates are visually distinct from agent findings and fan Takes.
- Creators cannot overwrite citations, agent evidence, prior provenance, fan activity, or nomination history.
- Material creator corrections may prompt a new research refresh rather than silently altering conclusions.

## Epic 8: Build a Scout Identity

### User story 8.1 — View a Scout Profile

As a fan, I want a public record of my scouting activity so that my taste and early discoveries have a durable home.

Profile includes:

- Display name
- Optional short bio
- Nominations
- Takes
- Followed projects and commitments when Public Activity is enabled

Acceptance criteria:

- Every nomination and Take links back to its Scout Card.
- Profile content uses reverse-chronological order within each section.
- The profile does not show an opaque scout score.
- Follower count is not used as the primary credibility signal.
- Demo accounts are visibly labeled where their activity could be mistaken for organic participation.

### User story 8.2 — Control public activity

As a fan, I want a simple privacy choice so that I can scout without exposing every follow or commitment publicly.

Acceptance criteria:

- Nominations and Takes are public by default because they are deliberate public contributions.
- One **Public Activity** toggle controls whether follows and commitments appear on the profile.
- Turning the toggle off removes follows and commitments from the public profile without deleting them.
- The user can still see their own private activity.
- Aggregate Scout Card counts remain accurate without exposing the user's identity.

## Epic 9: Trust the Platform

### User story 9.1 — Report harmful or misleading content

As a signed-in user, I want to report a card or contribution so that abuse and misleading claims can be reviewed.

Report reasons:

- Spam
- Impersonation
- Copyright or privacy
- Harassment
- Misleading claim
- Other

Acceptance criteria:

- Report is available on Scout Cards, Takes, replies, creator updates, and suggested sources.
- The user must select a reason before submitting.
- A successful report shows confirmation and a review status.
- Reporting does not falsely promise immediate removal.
- Content remains visible unless obvious spam is automatically blocked or the content is manually removed.
- A user cannot repeatedly report the same target without new context.

### User story 9.2 — Understand demo activity

As a judge or visitor, I want to distinguish seeded demonstration data from organic participation so that I am not misled.

Acceptance criteria:

- Seeded projects, accounts, follows, commitments, and Takes carry Demo or Sample labels where displayed.
- The demo performs at least one new social action live.
- Audience Pulse explains whether demo activity is included.
- Submission copy never presents seeded counts as independent market demand.
- Live agent research and cached fallback results are labeled accurately.

### User story 9.3 — Handle unavailable original media

As a visitor, I want a clear status when the original project source disappears so that I understand what can and cannot still be trusted.

Acceptance criteria:

- The card remains available as a historical research object.
- A prominent **Original source unavailable** banner appears.
- Embedded playback is disabled and replaced with an explanatory state.
- Claims dependent on the unavailable source show reduced or unavailable verification.
- Surviving public citations remain accessible.
- The app does not imply the creator requested removal unless that is known.

### User story 9.4 — Preserve provenance and corrections

As any visitor, I want to understand where information came from and what changed so that I can assess credibility.

Acceptance criteria:

- Material card sections label their provenance as public source, agent inference, fan opinion, creator-provided, or demo data.
- Research refreshes and material corrections are timestamped.
- The card shows a concise update history.
- Removed public contributions no longer influence Audience Pulse summaries.
- Corrections do not silently erase the previous basis for a recommendation.

## Epic 10: Curate The Selects

### User story 10.1 — Discover promising projects

As a visitor, I want a small, curated collection so that I can understand the breadth of Audience Take and open a Scout Card quickly.

Allowed selection reasons include:

- Strong evidence
- Early audience commitments
- Distinctive storyworld
- Creator responding
- Editorial scout pick

Acceptance criteria:

- The Selects is an editorial collection, not a numerical leaderboard.
- Every displayed project includes a visible reason it was surfaced.
- Demo or sample projects are labeled.
- No opaque ranking score is displayed.
- Search, advanced filters, and infinite scrolling are absent from the critical MVP.
- Junichiro Jackson is the complete demonstration card; other seeded cards may be lighter examples.

## Cross-Feature Behavioral Rules

### Sign-in return behavior

- When a signed-out user chooses Follow, commit, Take, reply, Suggest Evidence, report, nominate, or claim, the app explains the sign-in requirement.
- After sign-in, the user returns to the same Scout Card and intended action whenever possible.

### Counts and withdrawal

- Withdrawn follows, commitments, votes, Takes, and replies update their public presentation.
- Aggregate counts do not expose the identity of users with private activity.
- Changes must not create duplicate events or inflate totals.

### Sparse data

- Zero participation never produces an artificial Audience Pulse narrative.
- Small samples use explicit early-signal language.
- Agent recommendations remain grounded in public evidence and clearly separate from social sample size.

### Labels

Required visible status labels include:

- Fan nomination — unclaimed by creator
- Creator-submitted — verification pending
- Claim pending
- Approved creator
- Complete Scout Card
- Partial Scout Card
- Original source unavailable
- Community-submitted lead
- Verified and incorporated
- Could not verify
- Demo or Sample activity
- Early signal — limited participation

## Edge Cases and Expected Behavior

| Situation | Expected user-visible behavior |
|---|---|
| First visit with no account | Public browsing works; participation actions explain sign-in. |
| No projects in The Selects | Mission and nomination remain usable; empty state invites the first nomination. |
| Malformed URL | Inline error explains the required public URL format. |
| Unsupported or private source | Recoverable error; no research run starts. |
| Existing Scout Card | Route to canonical card and offer social/evidence actions. |
| Two people nominate simultaneously | One canonical card; both users can participate, original creation event remains singular. |
| Agent run partially fails | Publish Partial Scout Card if useful work exists; show missing sections and retry. |
| Agent run yields no usable evidence | Failed-run state explains why and allows correction or retry; no empty Scout Card. |
| User refreshes during research | Restore run progress and receipts. |
| User commits twice | Existing commitment state is reused; count does not increment twice. |
| User changes city | Bring It to My City updates the prior city rather than creating duplicate intent. |
| User withdraws a Take | Remove it from public view and future Audience Pulse summaries. |
| Suggested source conflicts | Mark unresolved conflict; do not silently choose the preferred narrative. |
| Creator disputes a source | Record dispute and review state; creator cannot erase it directly. |
| Creator claim is disputed | Keep claim pending; do not grant creator controls. |
| Original media disappears | Preserve card with unavailable-source banner and adjusted verification. |
| Project has only demo activity | Show Demo labels and avoid organic-demand language. |
| Report is submitted | Confirm receipt; do not promise immediate removal. |
| Content is removed | Exclude it from public views and native summaries while retaining necessary audit history. |

## Accessibility and Product Quality Requirements

- All essential actions are keyboard accessible.
- Focus states are clearly visible.
- Text, status, and evidence remain understandable without relying on color.
- Embedded media includes a meaningful title and available captions from the source platform.
- Images include useful alternative text or are marked decorative.
- Motion can be reduced without hiding agent stage progress.
- Loading, success, partial, empty, failure, and retry states are announced accessibly.
- Mobile layouts preserve the project hook, claim status, and social actions without horizontal overflow.
- Evidence links are distinguishable and provide meaningful labels.
- Destructive personal actions such as withdrawing a Take require a clear confirmation or undo.

## What We Are Building

- Landing page and The Selects
- Authentication-gated participation
- Fan nomination and creator submission
- Visible six-stage agent research
- Persistent run state and partial Scout Cards
- Bold, expandable Scout Card with authorized media
- Three pathways and separate fan pathway voting
- Industry Lens inside every card
- Follow Project
- Four defined commitments
- Structured Takes and one-level replies
- Audience Pulse
- Suggest Evidence and transparent review statuses
- Creator claim request and pre-approved creator state
- Creator updates and edit boundaries
- Basic Scout Profile and Public Activity toggle
- Report flow and essential trust states
- Clearly labeled seeded demonstration activity

## What We Would Add With More Time

### Slate View — first gated stretch goal

Slate View begins only when the complete critical MVP is deployed, tested, visually polished, and recordable.

Stretch scope:

- Professional watchlist
- Format, genre, pathway, and claim-status filters
- Side-by-side project comparison
- Evidence-forward project summaries
- Navigation to public Scout Cards

### Later social roadmap

- Reverse-chronological followed-activity feed
- Scout-to-scout following
- Notification inbox and digests
- Taste tags and affinity matching
- Badges and outcome-based scouting history
- Advanced moderation queue, appeals, and trust levels
- Creator-controlled validation campaigns
- Professional notes, exports, and organization workspaces

## Product Success Measures

### Hackathon success

- A judge understands the value proposition from the landing page without explanation.
- The three-minute demo completes the fan nomination → agent research → Scout Card → Industry Lens → live social action loop.
- The UI visibly proves runtime Parallel usage.
- At least one real social action changes the deployed product during the demonstration.
- No seeded signal is presented as organic demand.
- The product looks and behaves like a coherent application rather than a prompt wrapper.

### MVP behavioral signals

- A signed-in tester can complete nomination without assistance.
- A tester can identify the difference between agent confidence and fan pathway preference.
- A tester can identify whether a project is fan-nominated, claim-pending, or creator-approved.
- A tester can explain the meaning of each commitment before selecting it.
- A tester can locate citations, Industry Lens, Suggest Evidence, and report controls.
- A tester can complete one follow, commitment, Take, evidence suggestion, and claim request without ambiguous outcomes.

## Submission Proof Points

The deployed demo and video should visibly prove:

1. A user can nominate a real public project.
2. The agent workflow exposes six truthful stages.
3. Parallel performs current public-web research at runtime.
4. Gemini and Google Cloud transform source material and evidence into a Scout Card.
5. The card provides three cited pathways, not one generic answer.
6. The Industry Lens makes professional value legible.
7. The social layer records a real Follow or commitment.
8. Creator claim states respect authorization boundaries.
9. Suggested Evidence improves the evidence loop without bypassing verification.
10. Partial, demo-data, and sparse-data labels demonstrate trustworthy failure handling.

## PRD Definition of Done

This PRD is ready for the technical specification when:

- Every critical scope feature has user-visible behavior and testable acceptance criteria.
- Role permissions and creator-edit boundaries are explicit.
- Agent success, partial, failure, retry, refresh, and persistence behavior is explicit.
- Scout Card collapsed and expanded information hierarchy is explicit.
- Four commitments and Take behavior are fixed.
- Suggest Evidence states are fixed.
- Demo data, provenance, source availability, duplicates, reports, and sparse data are covered.
- Slate View is clearly gated behind the deployed critical path.

## Remaining Content Decisions for Build-Time Polish

These do not block technical specification:

- Final landing-page copy beyond the approved hierarchy
- Final names and artwork for the lighter seeded The Selects cards
- Exact demonstration-account display names and bios
- Final editorial copy for status explanations
- Whether the three-minute video shows The Selects before or after the creator-approved state
