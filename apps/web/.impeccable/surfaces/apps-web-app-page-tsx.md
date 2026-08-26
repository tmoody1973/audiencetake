---
version: 1
slug: "apps-web-app-page-tsx"
primary_target: "apps/web/app/page.tsx"
related_targets: ["apps/web/app/nominate/page.tsx"]
---

# Landing + Nomination surface

- **Scope / mode:** `/` is Persuade; `/nominate` is Operate. Shared product shell and tokens span both.
- **Audience / job:** A fan who found an overlooked public screen project must understand the mission, trust the evidence boundary, and start a URL-first nomination immediately.
- **Primary action:** Nominate a Project. Public browsing remains available; participation explains sign-in without creating an action automatically.
- **Proof/content:** Junichiro Jackson preview labeled `Fan nomination — unclaimed by creator`; the truthful three-step sequence; editorial The Selects; no invented audience volume, endorsement, verification, customers, or commercial outcomes.
- **Chosen direction:** Contact-sheet scouting wall within the approved film-festival × underground-magazine world. Approved comp: `.impeccable/mocks/landing-contact-sheet.png`.
- **Memorable moment:** The first viewport behaves like a living scouting contact sheet: an oversized cultural invitation sits directly beside a tactile nomination ticket, and the featured project strip proves that a nomination becomes a cited public object.
- **Constraints:** WCAG 2.2 AA, keyboard/focus, mobile reflow, reduced motion, no gradient/glass/AI-orb language, URL-first nomination, up to five supporting links, fan/creator modes, preserved input on error.

## Fidelity inventory

| Ingredient | Commitment | Medium |
|---|---|---|
| Masthead | Compact festival-program nav with numbered sections and visible sign-in state | Semantic HTML/CSS |
| Mission field | Acid-yellow page-scale region; compressed black headline dominates roughly half the first desktop viewport | Semantic HTML/CSS |
| Nomination ticket | Warm-paper ticket geometry, 3px ink rules, perforation/crop details, unmistakable primary action | Semantic form HTML/CSS/SVG detail |
| Junichiro strip | Black contact-sheet band; real supplied source thumbnail/authorized embed when available, otherwise explicitly editorial fallback | Existing/public embed metadata or authored fallback asset |
| Workflow | Three numbered steps with product-specific line icons and truthful copy | Semantic HTML + authored SVG |
| The Selects | Editorial program entries with varied density, not floating bento cards | Semantic HTML/CSS |
| Type | Ultra-compressed display silhouette; sturdy sans reading face; restrained mono metadata | Web fonts with robust fallbacks |
| Lines/elevation | 3px borders; 6px hard offset shadow only on actionable or lifted objects; square-to-small-radius corners | CSS tokens |
| Texture | Subtle paper/ink grain at low opacity across large fields, never reducing contrast | Small generated or sourced raster texture |
| Motion | One orchestrated contact-sheet advance / research handoff; reduced-motion switches to discrete state change | CSS/React state |

## Direction contract seed

- **THESIS:** A fan nomination becomes a public scouting object; refuse the generic centered AI hero and floating feature-card grid.
- **OWN-WORLD:** Warm paper, near-black ink, acid yellow, electric blue, coral, evidence green; contact-sheet seams, program numbers, ticket edges, crop marks, hard rules and controlled offset shadows.
- **STORY:** Understand that fans find projects first, begin a nomination, see agents scout truthfully, and recognize the Scout Card as the social object.
- **FIRST VIEWPORT:** Masthead above a two-field composition: giant mission on the left, URL-first nomination ticket on the right; Junichiro contact strip anchors the fold.
- **FORM:** Contact-sheet scouting wall, grounded candidate 3, seed `2ca41c25`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
