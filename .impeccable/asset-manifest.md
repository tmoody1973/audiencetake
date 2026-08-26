# Landing + Nomination Asset-Fidelity Manifest

<!-- impeccable:asset-manifest 1 -->

**Authority:** `PRODUCT.md`, `apps/web/.impeccable/surfaces/apps-web-app-page-tsx.md`, and the approved 1536 x 1024 comp `.impeccable/mocks/landing-contact-sheet.png` plus its JSON sidecar. The comp is a design reference, not a source of production photography, project facts, IDs, dates, or endorsements.

**Asset posture:** reproduce the comp's tactile contact-sheet world with semantic HTML/CSS/SVG plus one nonrepresentational raster texture. No generated people, project stills, audience evidence, creator endorsement, or purported Junichiro Jackson media is approved.

## Required asset ledger

| ID | Required visual role | Status / source | Production delivery and crop | Fidelity and truth rule |
|---|---|---|---|---|
| `REF-01` | Approved landing/nomination composition | **Reference only.** `.impeccable/mocks/landing-contact-sheet.png`; 1536 x 1024 PNG, RGB. | Do not ship or crop into the UI. Compare implementation screenshots at 1536 x 1024. | Generated people, stills, issue/date/location metadata, barcode IDs, and project details in the comp are illustrative and must not be literalized. The form must be URL-first despite the comp's title-first field. |
| `TEX-01` | Subtle paper fiber / offset-ink grain across large color fields | **Produced.** `.impeccable/assets/paper-ink-grain.webp`; project-bound, AI-generated, nonrepresentational. | 640 x 640 WebP, RGB, 54,282 bytes; no crop; apply as a decorative overlay at 4–7% opacity. Prefer a broad `cover`/large-tile treatment; the prompt requested seamless output, but mathematical edge continuity has not been certified. | Must never lower text/control contrast below WCAG 2.2 AA. No alt text; expose it only through an `aria-hidden` pseudo-element or equivalent decorative layer with `pointer-events: none`. |
| `JJ-01` | Featured Junichiro Jackson source preview in the black contact-sheet band | **Evidence-gated; not produced.** The repository supplies the participant-provided public YouTube URL `https://www.youtube.com/watch?v=M2djoKmnOTY`, but no creator-owned image file or redistribution license. | Prefer an authorized YouTube embed or source thumbnail loaded under the source platform's permitted mechanism. Preserve a native 16:9 source at a minimum displayed-source size equivalent to 640 x 360; use one content-aware `object-position` and do not upscale a low-resolution fallback. On narrow screens retain 16:9 rather than slicing into multiple false frames. | A public URL is evidence, not a license to extract/rehost frames. Do not turn the comp's six generated stills into Junichiro imagery, repeat one thumbnail as if it were six different scenes, or imply creator participation. Always render the exact visible label `Fan nomination — unclaimed by creator` until an independently approved creator state exists. |
| `JJ-02` | Accessible fallback when the Junichiro source preview is unavailable | **Semantic fallback; no raster needed.** | Code-built warm-paper/black title card using live project title, source-platform name, and the visible label `EDITORIAL FALLBACK — SOURCE PREVIEW UNAVAILABLE`; 16:9 region. | Do not add a face, scene, synopsis, date, location, verification badge, or invented project fact. The fallback must link to the public source when available and explain unavailable playback to assistive technology. |
| `SEL-01` | The Selects project thumbnails | **Missing / content-dependent; not produced.** No approved project-image library is present. | For real or clearly labeled demo entries, request creator-provided, licensed, or source-permitted 16:9 images, preferably 1280 x 720 master, with a safe center crop and per-image focal point. Mobile preserves 16:9. | The comp's six project stills and titles are not proof of real projects. Do not present generated thumbnails as factual projects. A synthetic editorial poster is acceptable only when its card is visibly marked `Demo`, `Sample`, or `Editorial fallback`, and the label cannot be image-only. |
| `TYPE-01` | Ultra-compressed display face, sturdy reading sans, restrained mono metadata | **License-dependent; no font binaries supplied.** | Deliver self-hosted WOFF2 only after license review; variable files preferred where permitted. Keep all copy live text with robust system fallbacks. | Do not rasterize headlines or embed an unlicensed font. Neobrutalism.com Pro ownership does not make private font/component files available to this repository. |
| `ICON-01` | Search, arrows, crop marks, star, globe, lock, hand/ticket, research lens, and megaphone | **Author in code.** | Inline SVG with `currentColor`, crisp 3 px visual strokes at comp scale, square view boxes, and no bitmap exports. Decorative marks are hidden from assistive technology; actionable icons have an accessible name on their control. | Use product-specific line drawings. Do not use AI-orb imagery or an unrelated stock icon family. |
| `MARK-01` | Audience Take wordmark and section numbering | **Semantic text.** | Live text/CSS; no logo raster. The product name and navigation labels remain selectable and responsive. | Do not add festival affiliations, laurels, issue numbers, passes, or verification marks unless they are real and documented. |
| `UI-01` | Ticket edges, perforations, black contact-sheet frames, hard rules, offset shadows, status tabs, decorative barcode | **Author in code.** | HTML/CSS plus SVG details where geometry requires it. A decorative barcode may be abstract and `aria-hidden`; it must not encode an invented identifier. | These are interface construction, not assets. State/status copy remains live DOM text and must come from real data or carry a visible Demo/Sample label. |

## Produced set

### `TEX-01` — `paper-ink-grain.webp`

- Built-in image generation output, generated 2026-08-26; downsampled to 640 x 640 WebP at quality 72 for production use.
- SHA-256: `1f29efb2a32c2493e278f0c6c82e11e05da63ebadf80d7e01eb78acc71b18c57`
- Visual inspection: neutral, low-contrast, edge-to-edge grain; no text, people, object, logo, or representational project content.
- Source-generation provenance is recorded here because the optimized WebP does not preserve the source PNG's full generation metadata.

Final prompt:

> Use case: stylized-concept  
> Asset type: seamless square raster overlay texture for a film-festival / underground-magazine web interface  
> Primary request: create a neutral, extremely subtle uncoated paper fiber and imperfect offset-print ink grain texture that can be composited at 4–7% opacity over warm paper, acid yellow, electric blue, coral, black, and green CSS color fields  
> Scene/backdrop: edge-to-edge flat texture only  
> Subject: fine irregular paper fibers, tiny ink speckling, faint roller pressure variation, sparse dust flecks  
> Style/medium: scanned analog paper and offset-print grain, matte, tactile, restrained, nonrepresentational  
> Composition/framing: seamless/tileable square, even density across the frame, no focal point, no border, no vignette  
> Lighting/mood: flat scanner light, no directional light  
> Color palette: neutral grayscale only, midgray-balanced for blend modes  
> Constraints: no people, no faces, no objects, no photographs, no text, no letters, no numbers, no logos, no watermark, no project facts, no recognizable imagery; no gradients; must remain low-contrast enough that body text stays legible when used at very low opacity  
> Avoid: paper sheet edges, shadows, stains, tears, folds, coffee marks, dramatic scratches, large blotches, halftone portraits, newsprint content

No other raster was produced. The approved comp's representational frames cannot be made truthful through generation, and all remaining visual ingredients are more faithful, accessible, and responsive as semantic code.

## Semantic-code boundary

The following must remain HTML/CSS/SVG/React rather than flattened imagery:

- masthead, navigation, sign-in state, headings, project labels, metadata, citations, status, and all action copy;
- URL-first nomination form, fan/creator modes, supporting-link controls, validation, focus, error recovery, and preserved input;
- mission field, nomination ticket, contact-sheet frame, The Selects grid/list structures, workflow numbering, rules, shadows, perforations, crop marks, and responsive reflow;
- workflow illustrations and all interactive icons;
- contact-sheet/research handoff motion, including a discrete reduced-motion state;
- evidence, Demo/Sample, claim, source-platform, and availability labels.

Raster media may supply texture or permitted project imagery only. It must not carry critical instructions, status, proof, or the only indication of state.

## Legal, provenance, and truth constraints

1. Use authorized embeds, source-platform thumbnails under permitted use, creator-provided media with recorded permission, or clearly labeled nonrepresentational editorial fallbacks. Do not silently download and rehost protected media.
2. The supplied Junichiro URL does not establish creator endorsement, image redistribution rights, verification, platform interest, or approval. Keep the project visibly unclaimed except in a separately approved demonstration state.
3. Never derive native Audience Take counts from YouTube comments, campaign figures, public-web discussion, or the comp. Zero/sparse participation stays zero/sparse and receives the product's honest empty or early-signal state.
4. Do not manufacture festival dates, locations, season/issue numbers, accession/pass IDs, audience volume, customers, awards, testimonials, acquisition likelihood, or commercial outcomes.
5. Any Demo/Sample/Editorial-fallback disclosure must be adjacent live text, readable without opening image alt text, and preserved at every breakpoint.
6. Generated assets must be nonrepresentational or explicitly disclosed. This manifest approves only `TEX-01`; it does not authorize generated Junichiro imagery or faux documentary evidence.
7. Re-check licensing before adding fonts, Neobrutalism.com Pro files, stock photography, creator art, or externally sourced icon packs. No such files were available to this asset pass.

## Handoff risks

- The approved visual fidelity still depends on one real, permitted Junichiro preview source; the repository currently has a URL, not a licensed local master.
- The Selects image library and content truth are unresolved. Code fallbacks can preserve layout but cannot reproduce the comp's photographic density without approved media.
- Exact display-font fidelity is unresolved until a licensed compressed face is supplied.
- `TEX-01` is visually even but was not mathematically seam-tested; use it as a large, low-opacity overlay and inspect one desktop plus one mobile capture for repetition or contrast loss.
