# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router and TypeScript on Firebase App Hosting; Firebase Authentication, Cloud Firestore, and Cloud Storage; a private Python Google ADK service on Cloud Run; Gemini on Vertex AI; Cloud Tasks for durable work; Parallel Search for current public-web research. The stack was selected and approved during the guided hackathon planning process.

## Users

- **Fan scout:** Finds an overlooked film, potential series, short film, documentary, web series, trailer, or crowdfunding project and wants to help it grow.
- **Creator:** Claims or directly submits a project, adds creator-owned context and updates, and learns which next experiment could strengthen it.
- **Industry professional:** A producer, studio researcher, distributor, exhibitor, or streaming researcher evaluating emerging creator-led projects.
- **Public visitor:** Discovers projects and evidence before deciding whether to sign in and champion one.

## Product Purpose

Audience Take lets people surface screen stories before the mainstream discovers them. A fan or creator submits a public project URL, visible agents research it through Gemini and Parallel, and a cited Scout Card helps the audience and industry understand what the project is, what it could become, and how to test the next step.

Success means the product makes discovery participatory without confusing popularity with proof: fans can nominate and champion projects; creators can claim and develop them; professionals can inspect evidence, pathways, risks, and next experiments.

## Positioning

Audience Take turns a fan's overlooked-project nomination into a durable, cited, socially active Scout Card. Unlike a watchlist, raw engagement dashboard, crowdfunding page, or generic AI report, it keeps public-web evidence, agent inference, native audience commitments, creator-owned information, and professional evaluation visibly separate on one shared object.

## Operating Context

1. A fan encounters a public YouTube video, trailer, web-series episode, short, documentary sample, Instagram project post, creator site, or Kickstarter campaign.
2. They submit the public URL and explain why it should grow.
3. Six visible research stages continue in the background and show truthful tool/source receipts.
4. A complete or honestly Partial Scout Card appears with citations and three realistic pathways.
5. People Follow Project, make non-transactional commitments, vote for a pathway, publish a Take, or suggest missing evidence.
6. The creator may request to claim the card; industry professionals inspect the same evidence through the embedded Industry Lens.

The primary demonstration project is Junichiro Jackson. It remains labeled “Fan nomination — unclaimed by creator” except in a separately labeled pre-approved creator demonstration state.

## Capabilities and Constraints

- The Scout Card is the central public object.
- Eligible picks include potential series, films, short films, documentaries, web-native stories, trailers, and public crowdfunding projects.
- Fans' nominations appear as **My Picks**; championed projects appear as **Following**; published opinions appear as **My Takes**.
- Native commitments are Would Watch, Would Pay to Watch, Bring It to My City, and Would Back the Next Chapter. They are expressions of intent, never purchases or reservations.
- Parallel must perform a real runtime public-web search during the hackathon demonstration.
- External comments, campaign data, and web discussion never enter native Audience Take counts.
- The product does not claim complete YouTube comments, private analytics, private backer data, platform access, acquisition likelihood, or commercial prediction.
- Creator permissions are project-scoped and cannot rewrite agent evidence, nomination history, or fan activity.
- A Community-submitted evidence lead cannot affect confidence until reviewed.
- Partial results and previously generated fallback content are explicitly labeled.
- Slate View and Grafana Studio Monitor are gated stretch features after the public core is stable.

## Brand Commitments

- Name: **Audience Take**.
- Tagline: **The audience's take on what should be made next.**
- Voice: culturally fluent, direct, curious, evidence-aware, and optimistic without hype.
- Public experience: a hybrid of a film festival and an underground culture magazine, influenced by Letterboxd, Sundance, and a touch of Are.na.
- Interface character: bold editorial hierarchy with neobrutalist construction; the Industry Lens becomes calmer and more analytical without becoming a separate visual identity.
- The first viewport must make nomination obvious and communicate that ordinary fans can help find the next great story.
- The agent flow must feel alive because real work is happening, not because fabricated reasoning is animated.

## Evidence on Hand

- Approved planning packet: `docs/hackathon-build/`.
- Social-layer/product research: `docs/ideas/`.
- Primary public project video supplied by the participant: `https://www.youtube.com/watch?v=M2djoKmnOTY`.
- Additional public Junichiro Jackson references are recorded in the planning documents and nomination fixture.
- Seed data is demonstration material and must be labeled.
- No creator endorsement, platform interest, customer testimonial, revenue claim, or verified acquisition outcome is available and none may be fabricated.
- The participant owns a Neobrutalism.com Pro subscription, but private licensed component files have not yet been supplied to this repository. Original project primitives may be built now; licensed assets can be integrated once provided.

## Product Principles

1. Make discovery participatory, but make evidence inspectable.
2. Show receipts instead of hidden reasoning or unexplained scores.
3. Publish honest partial truth rather than synthetic completeness.
4. Keep fan energy and professional credibility on the same Scout Card.
5. Optimize the critical live nomination-to-card journey before adding breadth.

## Accessibility & Inclusion

The web experience targets WCAG 2.2 AA. Bold borders, shadows, color, and motion cannot be the only carriers of state. All critical flows must work by keyboard, support visible focus, preserve readable contrast and zoom, respect reduced motion, and provide labeled alternatives for embedded media.
