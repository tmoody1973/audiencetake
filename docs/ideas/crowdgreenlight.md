# Audience Take

Status: Product name, Scout Card, multi-format scope, dual destination signals, visual direction, and Google-first stack locked  
Hackathon track: Agentic Cinema — Parallel

## Concept

Audience Take is an audience-intelligence, discovery, and release-pathway network for creator-led screen projects. It helps YouTube-native and independent creators translate online fandom into evidence-backed theatrical, festival, television, streaming, hybrid, and creator-direct strategies.

The lead concept includes two complementary inputs: YouTube-native storytelling and Kickstarter campaigns. Eligible projects include potential series, feature films, short films, documentaries, and expandable web-native concepts. It also includes a fan-scout mode that lets fans surface promising creator-led projects for creators, producers, exhibitors, and distributors.

## Product framing

Audience Take is an agentic scouting network for internet-born screen stories. A creator can analyze their own project, or a fan can submit a public YouTube video, channel, trailer, short, web-series episode, documentary sample, or Kickstarter campaign as a discovery lead. The platform turns that lead into a cited Scout Card, a community-engagement surface, and a testable next-format and release-path hypothesis.

The Scout Card is the central social and analytical object. Discovery, agent research, community reactions, native discussion, creator updates, format recommendations, and release experiments all attach to the project card rather than being scattered across creator profiles or dashboards.

**Tagline:** The audience's take on what should be made next.

### Product vocabulary

- **Scout Card:** the central public object for each nominated or creator-claimed project.
- **Audience Pulse:** the structured summary of voluntary Audience Take reactions and discussion.
- **Slate View:** the professional research workspace for producers, distributors, exhibitors, and other industry users.
- **Studio Monitor:** the agent-observability view, with Grafana considered as supporting infrastructure pending partner-track rules review.
- **The Selects:** a curated collection of promising projects surfaced by scouts and evidence.

## Participants

- **Creator:** submits or claims a project and uses the resulting audience evidence, format recommendation, and launch package.
- **Fan scout:** nominates a promising public project, explains why the story should grow, and signals how they would support its next chapter.
- **Producer, exhibitor, or distributor:** reviews evidence-backed Scout Cards, format potential, voluntary audience intent, city-level interest, and proposed launch experiments.

## Social product thesis

Audience Take is a purpose-built social scouting network, not a general entertainment feed. Its clearest shorthand is **Letterboxd for stories that are still becoming films, series, shorts, documentaries, events, or creator-owned franchises**. The social layer lives around the Scout Card and helps people discover, champion, validate, and follow a project's progress before a traditional greenlight or distribution decision.

The primary social action is a meaningful **take**, not a generic like. A take explains why a project should grow, which form or pathway fits it, and who may care. Commitment reactions add explicit first-party intent such as **Would Watch**, **Buy a Ticket**, **Bring It to My City**, **Would Back**, **Want the Feature**, or **Want the Series**. Each signal is labeled as self-reported intent rather than guaranteed demand.

Fans may follow projects and scouts, nominate public projects, publish structured takes, join project discussion, and participate in creator-authorized validation experiments. Creators may claim nominated cards, correct factual details, post updates, respond to the audience, and launch a bounded test. Scout profiles show nominations, picks, and eventual outcomes so that reputation is earned through a transparent history of useful early discovery rather than raw follower count.

The initial social experience includes public shareable Scout Cards, structured takes, a small commitment-reaction set, project discussion, creator updates, Scout Profiles, a curated **The Selects** feed, and one high-friction validation action such as a city-interest signup or early-access waitlist. Direct messages, broad groups, influencer-style feeds, and an endless engagement-ranked timeline are explicitly outside the MVP because they increase moderation and cold-start risk without proving the scouting thesis.

Detailed requirements and safety boundaries are captured in `docs/ideas/audience-take-social-layer.md` and will be promoted into the formal hackathon PRD after the MVP scope is approved.

## Fan-scout permission boundary

A fan may nominate a public project, explain why it deserves a larger audience, select a preferred release category or destination, participate in voluntary demand tests, share the Scout Card, and invite others to support it. A fan does not represent the creator, cannot claim that a platform is interested, and cannot send a creator-facing pitch in the creator's name. Until the project is claimed, the card is labeled **Fan nomination — unclaimed by creator**.

Exact services such as Netflix, HBO/Max, Adult Swim, or Crunchyroll may appear as clearly labeled fan destination preferences. Agent recommendations use neutral pathway language such as premium streaming, adult-animation network, theatrical distributor, or creator-direct release unless supported by cited public evidence. A creator must claim the card before exporting or sending an official pitch package.

The two destination signals appear together but are never conflated:

- **Fan wish:** a first-party poll answering “Where do fans want to watch it?” with specific services and release choices.
- **Agent pathway:** a cited recommendation answering “What kind of destination and next experiment best fit the project?” using platform-neutral categories, evidence, risks, confidence, and unresolved questions.

## Visual direction

Audience Take uses a **cinematic neo-zine hybrid** built with Neobrutalism.com components and patterns. Public discovery, Scout Cards, reactions, nominations, and agent activity are bold, colorful, poster-like, and tactile. Evidence, citations, long-form analysis, and creator action materials use calmer paper-like surfaces and restrained typography while retaining the same borders, spacing, and hard-shadow system.

The interface uses warm paper and near-black ink as its foundation, with acid yellow for scouting, electric blue for agent intelligence, coral for community activity, and green for verified evidence. Meaning is never communicated by color alone. Body text, citations, focus states, motion preferences, and contrast must remain accessible. Pro registry credentials stay outside the repository, and the product must not function as a redistribution vehicle for the component kit.

## Locked implementation stack

- **Web application:** Next.js with Neobrutalism.com components and patterns
- **Authentication:** Firebase Authentication with public browsing and sign-in required for participation
- **Social and project data:** Cloud Firestore
- **Creator-provided assets:** Cloud Storage for Firebase
- **Web hosting:** Firebase App Hosting
- **Agent runtime:** Google ADK deployed to Vertex AI Agent Engine or Cloud Run
- **Model capabilities:** Gemini multimodal analysis, synthesis, and action-package generation
- **Public-web research:** Parallel Search and Extract invoked at runtime by the server-side agent workflow
- **Secrets:** Google Cloud Secret Manager; credentials and Pro registry tokens never enter the public repository

The client never calls Gemini, Parallel, or privileged Google Cloud services directly. Authenticated server endpoints validate Firebase identity, invoke the agent workflow, and write durable results and progress receipts to Firestore.

## Release pathway map

The Scout Card may compare episodic-series development, feature expansion, short-form continuation, documentary development, event theatrical, festival-first, hybrid, creator-direct, and streaming-oriented pathways. It may identify public evidence about platform slates, comparable acquisitions, audiences, intermediaries, and timing, but it does not claim to submit directly to closed platforms or guarantee acquisition. For Netflix specifically, official guidance requires pitches to pass through an appropriately connected licensed agent, producer, attorney, manager, or industry executive.

## YouTube API boundary

The YouTube Data API can retrieve published top-level comment threads in paginated batches and can retrieve the complete available reply list for a thread through the comments endpoint. Comments that are disabled, deleted, private, held for review, or otherwise inaccessible are not part of the public result. Creator-authorized YouTube Analytics can provide metrics such as watch time, traffic sources, geography, and audience retention through OAuth.

YouTube's current developer policies materially constrain Audience Take's use of this data. They restrict custom channel scoring, audience or satisfaction inference, combining YouTube API data with outside data, surveillance, and long-term storage without refresh or authorization. The safe MVP therefore uses YouTube API data only for compliant metadata or creator-facing analytics kept separate from the scouting assessment. Audience Take's own voluntary fan signals and Parallel's research of the external public web power the evidence-backed Scout Card.

## Scout Card

A Scout Card contains the project hook, source material, creator history, current format, expandable storyworld, campaign status, public fandom evidence, Audience Take-native reactions, comparable projects, potential next formats, release hypotheses, confidence, and unresolved questions. Every external claim links to its source. The card supports meaningful reactions such as Would Watch, Buy a Ticket, Stream It, Bring It to My City, Would Back, and Scout's Pick.

## Kickstarter role

Kickstarter is treated as an early proof-of-demand surface, not merely a fundraising link. Parallel can research public campaign pages, updates, coverage, comparable campaigns, reward strategies, communities, and related creators. Private backer identities, private analytics, and reliable backer geography require creator-provided or authorized data and must not be inferred from public search.

## Parallel capability boundary

Parallel Search is suited to finding and ranking current public pages, narrowing results by domain, geography, or date, and returning URLs with relevant excerpts. Search results can be followed by Parallel Extract for detailed public-page content. It does not promise complete access to YouTube comments, private channel analytics, Kickstarter backer records, or content behind authentication. Audience Take must combine public-web evidence with voluntary first-party demand signals such as scout nominations, city interest, petitions, or reservations.

## User problem

Online engagement does not automatically reveal which stories can grow, which format fits them, or where audiences will take meaningful action. Creators, producers, independent distributors, platforms, and theaters lack a clear bridge between fragmented public fandom signals and concrete decisions about development format, markets, venues, partners, timing, and campaign hooks.

## Core workflow

1. A creator or fan submits a public YouTube, trailer, episode, short, documentary sample, or Kickstarter URL.
2. Gemini analyzes the work to extract storyworld, themes, characters, visual language, audience hooks, and expansion potential.
3. Parallel Search researches the submitted project, current public conversations, communities, coverage, comparable campaigns and releases, local venues, and cultural events.
4. ADK agents assemble the evidence into format and release-path hypotheses with confidence and unresolved questions.
5. The system generates a Scout Card and recommends potential series, feature, documentary, short-form, theatrical, streaming, hybrid, or creator-direct pathways.
6. It generates a creator-facing action plan and an evidence package for an appropriate producer, platform intermediary, festival, exhibitor, distributor, or audience test.

## Hackathon MVP

- One public YouTube, trailer, episode, short, documentary sample, or Kickstarter URL
- Story and audience-hook extraction
- Runtime Parallel Search calls
- One evidence-backed Scout Card
- A focused comparison of three plausible next-format or release paths
- Native Audience Take reactions and discussion kept separate from a clearly labeled YouTube source-comments panel
- One Audience Pulse generated only from Audience Take-native participation
- One structured take answering why the project should grow, what form fits it, and who it is for
- A minimal Scout Profile showing nominations and picks without follower-based ranking
- One high-friction validation action such as city interest or an early-access waitlist
- Cited evidence and confidence per recommendation
- One generated next-step package for the selected pathway

## Demo hook

“A fan found the next breakout screen story before the industry did.” A fan submits a public creator project or Kickstarter link. Audience Take builds a cited Scout Card, the community signals how it should grow, and the agents recommend whether its strongest next step is a series, feature, documentary, theatrical event, streaming pitch, or creator-direct continuation. The system then generates a concrete, evidence-backed test for that pathway.

## Why it fits

- Gemini analyzes creator video and feature-film material.
- Parallel supplies fresh public audience, community, venue, event, and market evidence.
- ADK coordinates research, segmentation, market selection, and campaign generation.
- The output leads to a measurable business action rather than a generic marketing report.

## Main risks

- Public conversation is not the same as verified ticket-buying intent.
- Geographic signals may be sparse or biased toward highly visible online communities.
- The product must use public aggregate evidence and avoid profiling individuals or inferring sensitive attributes.
- Recommendations must show their evidence and uncertainty rather than presenting demand estimates as facts.
- Social ranking can become a popularity contest unless commitment quality, evidence, recency, and provenance are visible.
- Fan nominations must never imply creator endorsement; creator claim, corrections, moderation, and reporting are required safeguards.
- Public discussion and project pages require spam, abuse, copyright, impersonation, and brigading controls even in a small MVP.
