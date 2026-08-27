---
version: 1
slug: "apps-web-app-research-runid-page-tsx"
primary_target: "apps/web/app/research/[runId]/page.tsx"
related_targets: ["apps/web/app/projects/[slug]/page.tsx"]
---

# Research → Scout Card surfaces

- **Scope / mode:** `/research/[runId]` is Operate; `/projects/[slug]` is Read with an expandable Operate-mode Industry Lens. Shared masthead, tokens, and evidence language inherit the established Audience Take world.
- **Audience / job:** A nominator or curious public viewer must see that real persisted work is happening, understand what is safely public, leave and return without losing state, then read the finished card without mistaking hypotheses or external signals for facts.
- **Primary actions:** Watch or leave the durable run; open the Scout Card when publication is complete or partial; expand Industry Lens for professional evidence; retry only when eligible.
- **Proof/content:** Six persisted stages, public-safe source and tool receipts, authorized Junichiro source, explicit submitted/Parallel/inference/external-signal provenance, three approved pathways, citations, risks, questions, confidence, bounded next experiments, and exact partial/fallback labels. Never show chain-of-thought, invented counts, endorsements, or verification.
- **Chosen structure:** Six-frame scouting gatefold, grounded candidate 7, surface seed `b3b1d94a`. Approved research comp: `.impeccable/mocks/research-gatefold.png`. Approved card continuation: `.impeccable/mocks/scout-card-tearoff.png`; it preserves the film-strip handoff and gives the Scout Card and Industry Lens the clearest public-product hierarchy.
- **Card alternatives considered:** `.impeccable/mocks/scout-card-centerfold.png` tests a calmer unequal-column festival program; `.impeccable/mocks/scout-card-evidence-sheet.png` tests provenance-first contact-sheet density. Both remain evidence, while the tear-off is the implementation target.
- **Memorable moment:** Each durable stage advances one film frame; the active Parallel frame runs a bounded query-chase marker; publication releases the Scout Card tear-off, which visually continues into the card header rather than becoming a generic success screen.
- **Motion thesis:** One focal contact-strip advance explains persisted progress. Routine receipt/state updates use 150–300ms color/stamp changes; no waiting choreography. CSS transforms/clip and color only, capped to the active frame. Reduced motion renders the same state as a discrete stamp and static progress marker.
- **Responsive translation:** Desktop keeps six frames in one unbroken strip beside a receipt ledger. Mobile keeps the stage order as a horizontal snap filmstrip with the active frame fully visible and receipts below; it never hides status or requires motion.
- **Constraints:** Refresh/two-tab restoration, keyboard/focus, live-region announcements, reduced motion, public receipts only, source links validated, complete/partial/failed/unavailable/fallback states, no gradients/glass/pills/rounded cards/generic dashboard chrome.
