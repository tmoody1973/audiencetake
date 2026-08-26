---
name: Audience Take
description: "The audience's take on what should be made next."
colors:
  ink: "#11100d"
  paper: "#f4eedf"
  acid-yellow: "#f5d800"
  electric-blue: "#1539d6"
  signal-coral: "#f05037"
  white: "#ffffff"
  field-paper: "#fffdf7"
  evidence-mint: "#cbe9d9"
  error-red: "#951c13"
  muted-ink: "#4f4a42"
typography:
  display:
    fontFamily: '"League Gothic AT", "Arial Narrow", sans-serif'
    fontSize: "clamp(4.6rem, 9vw, 8.6rem)"
    fontWeight: 400
    lineHeight: 0.73
    letterSpacing: "-0.015em"
  headline:
    fontFamily: '"League Gothic AT", "Arial Narrow", sans-serif'
    fontSize: "clamp(3.2rem, 5vw, 5.2rem)"
    fontWeight: 400
    lineHeight: 0.78
    letterSpacing: "-0.01em"
  title:
    fontFamily: '"League Gothic AT", "Arial Narrow", sans-serif'
    fontSize: "2.15rem"
    fontWeight: 400
    lineHeight: 0.82
  body:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "0.72rem"
    fontWeight: 800
rounded:
  square: "0"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  2xl: "24px"
  3xl: "28px"
  4xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal-coral}"
    textColor: "{colors.white}"
    typography: "{typography.display}"
    rounded: "{rounded.square}"
    padding: "0 22px"
    height: "62px"
  button-primary-hover:
    backgroundColor: "{colors.electric-blue}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 22px"
    height: "62px"
  field:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "14px"
    height: "56px"
  mode-choice-selected:
    backgroundColor: "{colors.acid-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "16px"
    height: "100px"
  nomination-ticket:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "clamp(42px, 5vw, 74px) clamp(48px, 6vw, 92px) clamp(42px, 5vw, 74px) clamp(56px, 6vw, 94px)"
---

# Design System: Audience Take

## Overview

**Creative North Star: "The Public Scouting Program"**

The Public Scouting Program treats every screen-story nomination as a physical piece of cultural evidence: a festival handbill, an open-call ticket, a contact sheet, or a research receipt. The atmosphere is energetic, tactile, and editorial—acid color fields and compressed headlines bring underground-magazine conviction, while explicit labels, program numbers, and visible rules keep the experience evidence-aware.

The system joins Letterboxd-like cultural fluency, Sundance-like programming authority, Are.na-like collected context, and neobrutalist construction without mimicking any one reference. Warm paper, near-black ink, square geometry, hard seams, restrained grain, and controlled offset shadows form one public identity; analytical surfaces become calmer through density and color restraint, not through a separate visual language. Generic centered AI heroes, floating glass cards, gradients, and decorative AI-orb imagery are outside this world.

**Key Characteristics:**

- Compressed, all-caps display type paired with sturdy sans-serif reading copy and monospaced evidence labels.
- Warm paper and near-black ink interrupted by acid yellow, electric blue, and signal coral.
- Contact-sheet grids, ticket cuts, program numbers, hard rules, and selectively lifted actions.
- Explicit status language and semantic structure carry meaning alongside color, border, and motion.
- One low-opacity paper-and-ink grain adds tactility without competing with content.

## Colors

The palette behaves like a limited-run festival program: warm stock and black ink establish the field, then a few saturated inks signal invitation, process, and action.

### Primary

- **Electric Blue:** Carries mission emphasis, nomination-page fields, active links, focus visibility, and the research handoff band.

### Secondary

- **Acid Yellow:** Marks the public invitation, editorial programming, selected choices, step numbers, and high-energy information fields.

### Tertiary

- **Signal Coral:** Identifies the main nomination action, ticket headline, and review-stage accents.

### Neutral

- **Near-Black Ink:** The default text, rule, frame, footer, and hard-shadow color.
- **Warm Program Paper:** The page ground and physical-ticket surface.
- **Clean White:** High-contrast copy on saturated and ink-dark fields.
- **Field Paper:** A slightly cleaner writing surface inside form controls.
- **Evidence Mint:** Separates evidence notes and creator declarations from promotional color.
- **Error Red:** Marks validation and submission failure without relying on border color alone.
- **Muted Ink:** Supports help text and secondary form metadata.

### Named Rules

**The Ink Has a Job Rule.** Electric blue indicates mission or process, acid yellow indicates public programming or selection, and signal coral indicates nomination action; do not scatter the accents as interchangeable decoration.

**The Paper Stays Warm Rule.** Warm program paper is the default canvas. Clean white is reserved for contrast and field clarity rather than used as a generic page background.

## Typography

**Display Font:** League Gothic AT (with Arial Narrow and sans-serif fallbacks)  
**Body Font:** Helvetica Neue (with Helvetica, Arial, and sans-serif fallbacks)  
**Label/Mono Font:** SFMono-Regular (with Consolas, Liberation Mono, and monospace fallbacks)

**Character:** League Gothic supplies the tall, condensed pressure of a festival poster. The neutral reading face keeps explanations direct, while restrained mono labels make sources, steps, and status feel logged rather than embellished.

### Hierarchy

- **Display** (400, fluid oversized scale, 0.73 line-height): First-view mission statements and page-scale editorial declarations; uppercase and tightly stacked.
- **Headline** (400, fluid section scale, 0.78 line-height): Program, workflow, form, and ticket headings.
- **Title** (400, compact card scale, 0.82 line-height): Select entries and other short editorial titles.
- **Body** (400 by default, 1rem, 1.45 line-height): Explanations and form support copy; important lead copy may rise to 650–750 weight.
- **Label** (800–900, compact mono scale, uppercase): Evidence status, field labels, navigation numbers, steps, and receipts.

### Named Rules

**The Poster Leads, the Receipt Proves Rule.** Use the compressed face for cultural invitation and hierarchy; use mono for metadata and evidence; keep explanatory prose in the reading face.

## Layout

Desktop composition uses bordered grid fields rather than floating card collections. The masthead is a three-part festival-program strip; the first viewport is a 1.08fr/0.92fr mission-and-ticket split; evidence and workflow bands use asymmetric grids; editorial selections vary their internal column widths while sharing one continuous rail.

The reusable rhythm clusters around compact 8–14px metadata spacing, 18–24px control and card spacing, 28–32px structural spacing, and fluid section padding for large fields. Copy lines are deliberately constrained where implemented: mission text reaches 63ch, ticket copy 46ch, and supporting explanations generally stay between 36ch and 60ch.

At the implemented wide breakpoint (1100px), the masthead wraps its navigation, the hero becomes one column, evidence becomes a two-column band, and The Selects becomes a vertical rail. At the implemented mobile breakpoint (760px), major grids become single-column, the sign-in link yields to the nomination action, the ticket loses its lifted shadow, media preserves 16:9, and form controls stack. Motion uses one stepped 3.6-second URL → Research → Scout Card handoff with 1.2-second offsets; reduced-motion preferences disable it and smooth scrolling.

**The Continuous Program Rule.** Build sections as adjacent fields joined by rules; use white space inside the fields, not floating rounded containers between them.

## Elevation & Depth

The system is flat by default and uses structural contrast, seams, and tonal blocks for most depth. Hard, ink-colored offset shadows appear only on lifted or selectable objects: the standard action shadow, the larger nomination-ticket shadow, and the compact selected-control shadow. A blue focus halo sits outside a white outline so keyboard focus remains visible on every field color.

### Shadow Vocabulary

- **Action lift** (`box-shadow: 6px 7px 0 var(--ink)`): Primary actions at rest.
- **Ticket lift** (`box-shadow: 8px 9px 0 var(--ink)`): The desktop nomination ticket.
- **Selected lift** (`box-shadow: 5px 5px 0 var(--ink)`): Selected mode choices and the emphasized primary field.
- **Evidence inset** (`box-shadow: inset 0 3px 0 var(--yellow)`): The featured nomination detail strip.
- **Focus halo** (`box-shadow: 0 0 0 7px var(--blue)`): The outer layer of the global focus treatment.

### Named Rules

**The Flat Until Lifted Rule.** A surface earns an offset shadow only when it is an action, a selected control, or the signature nomination ticket.

## Shapes

Controls, panels, fields, program bands, and editorial entries use square corners. Form is created through 1–3px rules, ticket perforations, crop marks, notches, circular punches, inline geometric icons, and deliberate clipping. The only recurring full circles are functional ticket or icon details; there is no soft-radius card family.

**The Paper Is Cut, Not Cushioned Rule.** Keep primary UI geometry square and use print-production details for character; rounded rectangles and pill-shaped containers do not belong in the implemented system.

## Components

Components feel tactile and declarative: large enough to operate, visibly bounded, and explicit about state.

### Buttons

- **Shape:** Square, bordered construction with no radius.
- **Primary:** Signal-coral field, clean-white compressed display label, 3px ink border, 62px minimum height, 22px horizontal padding, and the action-lift shadow.
- **Hover / Focus:** Hover changes the field to electric blue; global focus adds a 4px white outline and 7px electric-blue halo. Disabled buttons lower opacity and remove the shadow.
- **Secondary / Ghost:** Transparent field, 3px ink border, sturdy sans label, and the same 62px minimum height.

### Chips

- **Style:** Status stamps use square 1–2px ink borders, compact uppercase mono labels, and tight 8–14px padding.
- **State:** Selected submission-mode choices expand the pattern into acid-yellow fields with a compact offset shadow and a two-line explanatory label.

### Cards / Containers

- **Corner Style:** Square corners; circular notches and punches belong only to ticket construction.
- **Background:** Warm paper for the ticket and selection rail, near-black ink for evidence bands, and role-specific accent fields for program moments.
- **Shadow Strategy:** Flat by default; only signature lifted objects use the vocabulary above.
- **Border:** Continuous 3px ink rules define primary structures, with 1–2px internal dividers.
- **Internal Padding:** Compact entries use 14–24px; large editorial fields use fluid viewport-aware padding.

### Inputs / Fields

- **Style:** Square 2px ink stroke, field-paper background, 14px internal padding, and a 56px minimum single-line height.
- **Focus:** The global white-outline and electric-blue-halo treatment remains visible against every surrounding color.
- **Error / Disabled:** Invalid fields use an error-red stroke, pale error field, and adjacent error copy. Disabled action controls retain their label, lower opacity, and remove lift.

### Navigation

The desktop masthead uses live-text wordmark typography, numbered uppercase links separated by ink rules, and a right-aligned action group. Hover fills navigation links with acid yellow; the nomination action is electric blue and turns near-black on hover. At 1100px the nav becomes its own full-width row, and at 760px its numbers and the secondary sign-in action are hidden while the main nomination action remains.

### Nomination Ticket

The signature ticket pairs a warm-paper body with a 3px frame, larger hard shadow, coral heading, vertical accession-style label, perforation, crop marks, circular punch, and edge notches. It contains the URL-first field and the clearest primary action in the first viewport; its construction simplifies on mobile without changing the task.

### Editorial Selection Entry

Selection entries share one ruled rail but vary poster width, avoiding a uniform dashboard-card grid. Each combines a live-text geometric poster, compressed title, plain-language reason, and a visible Sample, Demo, or editorial-fallback status.

**The State Must Speak Rule.** Pair visual state with live labels, semantic attributes, and adjacent explanation; color, shadow, and motion are never the only carriers of meaning.

## Do's and Don'ts

### Do:

- **Do** use compressed headlines, plain reading copy, and mono metadata for distinct rhetorical jobs.
- **Do** build continuous program fields with exact rules, deliberate asymmetry, and square corners.
- **Do** reserve hard shadows for actions, selections, and the signature nomination ticket.
- **Do** keep evidence, source, claim, Demo, Sample, and error labels visible in live text.
- **Do** preserve the stepped handoff as the single recurring motion and honor reduced-motion preferences.

### Don't:

- **Don't** introduce gradients, glass panels, AI orbs, soft floating cards, or generic dashboard bento grids.
- **Don't** turn saturated accents into decoration; each ink has an implemented semantic role.
- **Don't** soften the system with pill controls or a family of rounded rectangles.
- **Don't** use texture, imagery, borders, shadows, or motion as the sole carrier of status or evidence.
- **Don't** imply festival affiliation, creator endorsement, verification, or audience proof through decorative program language.
