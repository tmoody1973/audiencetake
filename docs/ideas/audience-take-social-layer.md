# Audience Take — Social Layer Requirements

Status: Product requirements input; formal PRD pending approved hackathon scope

## Purpose

Audience Take is the social scouting network where fans help internet-born screen stories find their next audience, format, and release path. It occupies the participatory period before a conventional greenlight, acquisition, or release decision.

The social layer is not an add-on. It creates consent-based, first-party evidence of who cares enough to take a meaningful action, organized around projects rather than generalized sentiment or individual profiling.

## Product principles

1. **The Scout Card is the public home.** Research, takes, commitments, discussion, creator updates, experiments, and outcomes attach to one durable project object.
2. **Commitment beats engagement.** The interface favors actions with declared meaning over generic likes or passive view counts.
3. **Intent is not demand.** Every reaction is presented as voluntary self-reported intent, never a guaranteed sale, view, acquisition, or turnout.
4. **Evidence remains inspectable.** Agent claims link to sources; native audience signals show their definitions, counts, dates, and relevant limitations.
5. **Fans scout; creators represent.** An unclaimed nomination never implies creator participation, consent, endorsement, or platform interest.
6. **Reputation comes from a record.** Scout credibility develops through transparent nominations, useful takes, community validation, and later outcomes—not follower count alone.
7. **Social and source commentary stay separate.** Audience Take discussion and Audience Pulse never masquerade as YouTube, Kickstarter, or other third-party comments.

## Primary participants

### Fan scout

- Discovers or nominates an emerging public screen project.
- Explains why it deserves to grow.
- Expresses a preferred next format or viewing destination.
- Makes bounded commitments such as watching, attending, backing, or sharing.
- Builds a public scouting history through nominations and picks.

### Creator

- Submits a project directly or claims a fan-nominated Scout Card.
- Corrects factual project information without erasing sourced history.
- Posts updates and responds to discussion.
- Chooses which validation experiment, if any, to activate.
- Controls creator-provided assets and exports creator-facing materials.

### Industry researcher

- Reviews Scout Cards and Audience Pulse through Slate View.
- Separates public-web evidence, native commitments, creator-supplied information, and agent inference.
- Compares plausible next formats and pathways without treating community activity as a prediction.

## Central object: Scout Card

Each Scout Card contains:

- Project title, hook, creator, source links, and current format
- **Fan nomination — unclaimed by creator** or verified creator-claim status
- Cited agent research and confidence
- Structured takes
- Commitment reactions
- Audience Pulse
- Fan destination preference and separate agent pathway recommendation
- Project discussion and creator updates
- Active validation experiment
- Material corrections, moderation status, and provenance
- Outcome history when the project advances

## Social actions

### Nominate

A signed-in fan submits a public project URL and a structured nomination:

- Why should this project grow?
- What could it become?
- Who is it for?
- How did the scout discover it?

The app checks for an existing Scout Card before creating a duplicate. A nomination remains clearly unclaimed until the creator verifies control.

### Publish a take

A take is concise, project-specific, and structured around:

- Why the project deserves attention
- The most plausible next format or release path
- The audience or community likely to care
- Optional evidence or personal context

A take is an opinion, not an agent-generated research claim. Edited takes show an edited state. Deleted takes leave aggregate counts consistent and auditable.

### Make a commitment

The MVP supports a deliberately small reaction set:

- **Would Watch**
- **Buy a Ticket**
- **Bring It to My City**
- **Would Back**
- **Want the Feature** or **Want the Series**, chosen according to project context
- **Scout's Pick**

Users can change or withdraw a commitment. Location-specific intent requires an explicit city selection and clear consent. Counts must not imply unique verified purchasers unless verification actually exists.

### Follow and save

Users may follow projects and save Scout Cards. Following a person is optional for the MVP; if included, it should support discovery without producing a follower-count popularity hierarchy.

### Discuss and update

Every Scout Card may have project-specific discussion. Claimed creators can publish updates that are visually distinct from fan discussion and agent analysis. Reporting, blocking, and moderator removal must be available wherever user-generated text is public.

### Validate

The hackathon MVP demonstrates one higher-intent action:

- City-interest signup, or
- Early-access waitlist

The action states exactly what the user is agreeing to. It does not charge money or guarantee a screening, release, or creator response.

## Audience Pulse

Audience Pulse summarizes only Audience Take-native participation. It may show:

- Commitment mix and definitions
- Preferred next formats
- Fan destination wishes
- Opt-in city interest
- Common themes from native takes and discussion
- Participation volume and time window
- Data sufficiency and known limitations

It must not merge YouTube comments, Kickstarter backer data, or public-web commentary into the native signal. External commentary belongs in a separately labeled source-analysis section.

## Scout Profile

The MVP profile contains:

- Display name and optional short bio
- Projects nominated
- Scout's Picks
- Structured takes
- Observable project outcomes
- Basic contribution and moderation status

It does not include direct messaging, private contact information, a monetized influence score, or a single opaque scout score.

## The Selects

The Selects is a curated discovery surface for promising Scout Cards. It should consider:

- Completeness and quality of the Scout Card
- Evidence and citation quality
- Meaningful, defined audience commitments
- Recency and continued activity
- Project diversity and anti-brigading checks
- Creator claim or response status, without suppressing worthy unclaimed nominations

Raw views, follower count, and comment volume must not determine rank by themselves. The product should disclose why a project appears in The Selects.

## Core loop

1. A fan discovers and nominates a public project.
2. Audience Take creates an evidence-backed Scout Card.
3. Other users publish takes and make meaningful commitments.
4. The creator may claim the project, correct details, and post updates.
5. The creator activates a bounded validation experiment.
6. Slate View presents separate evidence, intent, inference, and outcomes to professionals.
7. Later project outcomes strengthen the transparent track records of early scouts.

## MVP acceptance criteria

- A public visitor can open and share a Scout Card without signing in.
- A signed-in user can nominate a supported public URL after duplicate checking.
- An unclaimed card visibly states that it is fan-nominated and not creator-endorsed.
- A signed-in user can publish one structured take and edit or delete it.
- A signed-in user can make, change, or withdraw each supported commitment.
- Audience Pulse uses only native Audience Take participation and labels its sample size and limits.
- YouTube or other external comment analysis appears in a separate labeled section.
- A creator can begin a claim flow and, once verified, post a creator update.
- A user can report public text or a Scout Card for review.
- A Scout Profile displays nominations and picks without an opaque influence score.
- The Selects explains why each displayed project was surfaced.
- One city-interest or early-access validation action can be completed and withdrawn.

## Empty, error, and boundary states

- A new project with no commitments explains how to leave the first meaningful signal.
- A duplicate nomination routes the scout to the existing card and lets them add a take.
- An unsupported, private, deleted, or unreachable source URL produces a recoverable error.
- Sparse Audience Pulse data says there is not enough participation instead of generating a confident narrative.
- A disputed creator claim pauses creator-only controls until review.
- Removed content is excluded from public views and agent summaries.
- Sudden coordinated activity is labeled or withheld from ranking pending integrity checks.

## Safety, rights, and integrity

- Do not imply that Netflix, HBO/Max, another platform, or the creator has expressed interest without cited evidence.
- Do not redistribute third-party video, artwork, campaign assets, or comments beyond authorized embeds, links, excerpts, and permitted uses.
- Provide reporting categories for harassment, impersonation, copyright, privacy, spam, and misleading project claims.
- Prevent self-dealing from being hidden: creator or team affiliations should be disclosed on nominations and takes.
- Rate-limit nominations, reactions, and discussion to reduce spam and brigading.
- Do not infer sensitive personal attributes or target individual commenters.
- Keep raw private creator data out of public Scout Cards and observability traces.

## Explicit non-goals for the hackathon MVP

- Direct messages
- Broad interest groups or local chapters
- General-purpose influencer feed
- Endless engagement-optimized timeline
- Paid ticketing, escrow, or crowdfunding transactions
- Automated outreach sent in a creator's name
- Guaranteed demand, revenue, acquisition, or greenlight predictions
- A universal numerical score for creators, projects, fans, or scouts

## PRD promotion checklist

Before this document is promoted into `docs/hackathon-build/prd.md`, the scope step must decide:

- Whether following people is in the MVP or only following projects
- Which four or five commitment reactions ship
- City-interest signup versus early-access waitlist
- Minimum viable creator-claim verification
- Whether project discussion ships or is represented by structured takes only
- How The Selects is curated for the demo without requiring a large active community
