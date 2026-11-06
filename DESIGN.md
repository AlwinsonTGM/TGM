---
name: "TGM — Personal Command Center"
description: "Calm, Loki-inspired desktop command center and multi-harness study workspace"
colors:
  primary: "#61d8b8"
  primary-hover: "#8ae8ce"
  primary-ink: "#09251b"
  secondary: "#d9bf80"
  secondary-muted: "#a88e58"
  tertiary: "#dec889"
  tertiary-ink: "#173124"
  neutral-bg: "#071a15"
  neutral-sidebar: "#081712"
  neutral-surface: "#0e2920"
  neutral-surface-raised: "#10291f"
  neutral-surface-active: "#153c2c"
  neutral-surface-hover: "#17382b"
  neutral-terminal: "#061511"
  neutral-input: "#0b231b"
  neutral-border: "#2b493a"
  neutral-border-strong: "#4e715e"
  neutral-border-brass: "#5b6442"
  neutral-text: "#e9eee5"
  neutral-text-bright: "#f3f1e6"
  neutral-text-muted: "#a8bdad"
  focus-ring: "#77e5c9"
  danger-bg: "#291616"
  danger-border: "#8a4b4b"
  danger-text: "#f5c6c0"
  backdrop: "rgba(7, 26, 21, 0.78)"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "'Segoe UI', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "'Segoe UI', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Segoe UI', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Consolas, 'JetBrains Mono', monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  xs: "4px"
  sm: "6px"
  md: "7px"
  lg: "9px"
  xl: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  xxl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "body"
    rounded: "{rounded.md}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "10px 15px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    typography: "body"
    rounded: "{rounded.md}"
    padding: "10px 13px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text-muted}"
    typography: "body"
    rounded: "{rounded.md}"
    padding: "12px"
  nav-item-active:
    backgroundColor: "{colors.neutral-surface-active}"
    textColor: "{colors.neutral-text-bright}"
    typography: "body"
    rounded: "{rounded.md}"
    padding: "12px"
  input-field:
    backgroundColor: "{colors.neutral-input}"
    textColor: "{colors.neutral-text}"
    typography: "body"
    rounded: "{rounded.md}"
    padding: "11px 12px"
  surface-card:
    backgroundColor: "{colors.neutral-surface-raised}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "18px"
---

# Design System: TGM — Personal Command Center

## Overview

**Creative North Star: "The Gilded Study Desk"**

TGM is a calm, grounded, and deliberate Windows-first desktop environment built to help its owner start one meaningful work or study session without friction. Inspired by a Loki-tinted world of deep evergreen timber, tarnished brass, and luminous mint signals, the interface treats the screen as a quiet, well-lit study desk rather than a high-pressure productivity dashboard. Every surface pairs familiar developer affordances from AGY, OpenCode, Obsidian, Google Keep, and Codex with warm editorial anchors that reduce overwhelm at the start of a session.

Density is calibrated to the user's immediate state of mind. The Home view brings suggested next steps, per-step CLI harness selection, last-session continuation, and independent FlowState focus together; uncategorized quick capture follows below and may require scrolling on a standard desktop viewport. Moving into a session workspace shifts the center of gravity to the active CLI terminal (`AGY CLI` or `OpenCode`) and an honest, non-intrusive focus bar, while relegating memory and Obsidian reviewer proposals to explicit review dialogs where verified session evidence is visually separated from editable AI drafts.

The visual system explicitly rejects noisy multi-widget dashboards, gamified streaks, decorative glassmorphism, neon glow halos, and unreviewed AI automation that obscures whether an action actually succeeded.

**Key Characteristics:**
- **Loki-Tinted Botanical Ground:** Deep forest surfaces layered tonally with crisp 1px structural borders and antique brass identity accents.
- **Serif Invites, Sans Operates, Mono Measures:** Warm Georgia headings welcome the user into a session, workhorse Windows UI sans-serif drives controls and copy, and tabular monospace reports timers, CLI commands, and harness badges.
- **One Primary Commitment Per View:** Solid Bifrost Mint fill is reserved for the single leading commitment on screen (the top suggested step or the active focus trigger).
- **Explicit Harness & Evidence Provenance:** Every session visibly carries its bound CLI harness (`AGY` or `OpenCode`) and separates verified focus/session facts from editable AI proposals.

## Colors

The palette pairs deep evergreen nocturnal surfaces with warm brass wayfinding and high-contrast mint action fills so long desktop study sessions stay low-glare and legible.

### Primary
- **Bifrost Mint** (`#61d8b8`): Primary commitment fill used for the leading suggested step button, the primary focus trigger, active terminal prompts, and text carets.
- **Luminous Mint** (`#8ae8ce`): Hover state for primary mint buttons.
- **Deep Pine Ink** (`#09251b`): High-contrast dark ink set inside Bifrost Mint primary buttons (`10.2:1` contrast ratio).

### Secondary
- **Horned Brass** (`#d9bf80`): Brand crest stroke, section labels, SVG navigation icons, elapsed timer numerals, and AGY harness badges.
- **Tarnished Brass** (`#a88e58`): Fine line-art stroke for the Home header ornament and subtle brass dividers.

### Tertiary
- **Preview Gold Banner** (`#dec889` with `#173124` ink): High-visibility top status strip used when running synthetic preview or diagnostic modes.
- **Astral Focus Ring** (`#77e5c9`): Dedicated 2px `:focus-visible` outline color across all interactive controls.
- **Diagnostic Crimson** (`#291616` background, `#8a4b4b` border, `#f5c6c0` text): Honest error and unavailable-CLI banner palette inside the terminal shell.

### Neutral
- **Asgardian Pine** (`#071a15`): Primary application canvas background.
- **Deep Sanctum** (`#081712`): Persistent left navigation sidebar background.
- **Sanctum Canopy** (`#0e2920`): Base card and grouped container surface.
- **Elevated Canopy** (`#10291f`): Independent focus aside card, terminal header, and modal dialog surface.
- **Active Bough** (`#153c2c`) & **Hovered Bough** (`#17382b`): Selected navigation item and interactive hover highlight.
- **Terminal Void** (`#061511`) & **Input Well** (`#0b231b`): Recessed inset grounds for the interactive CLI viewport, text inputs, and badges.
- **Botanical Hairline** (`#2b493a`), **Interactive Stem** (`#4e715e`), & **Brass-Olive Frame** (`#5b6442`): 1px structural dividers, control borders, and elevated card/dialog frames.
- **Parchment Mist** (`#e9eee5`), **Gilded Vellum** (`#f3f1e6`), & **Lichen Sage** (`#a8bdad`): Default body copy, high-emphasis display headings, and secondary descriptions (`7.8:1` contrast on `#071a15`).

### Named Rules
**The Mint-For-Commitment Rule.** Solid Bifrost Mint (`#61d8b8`) appears on at most one primary call-to-action per region (the first suggested step on Home, the Start Focus button in the aside, or the Approve button in a review dialog). Sibling actions use bordered outline buttons so the eye always knows where to begin.

**The Brass-Signals-Identity Rule.** Horned Brass (`#d9bf80`) marks brand identity, structural wayfinding, and tabular timer readouts; never use it as a full card background or body text color.

**The Tinted-Neutral Rule.** Every surface, border, and muted label is tinted toward evergreen and sage (`#071a15` to `#a8bdad`); pure neutral grays (`#888888`, `#cccccc`) are forbidden.

## Typography

**Display Font:** Georgia (with `'Times New Roman', serif` fallback)
**Body Font:** `'Segoe UI'` (with `Arial, sans-serif` fallback)
**Label/Mono Font:** Consolas (with `'JetBrains Mono', monospace` fallback)

**Character:** Literary serif headings establish a calm, reflective threshold at the top of each view, while native Windows sans-serif and tabular monospace keep dense task controls, project trees, and terminal transcripts effortless to scan.

### Hierarchy
- **Display** (`600`, `2rem / 32px`, line-height `1.15`, tracking `-0.02em`): Primary view headings on Home (`Let’s make a little progress.`) and active Workspace titles.
- **Headline** (`600`, `1.5rem / 24px`, line-height `1.2`): Review dialog titles, TGM brand title, and the Independent Focus aside heading.
- **Title** (`700`, `1rem / 16px`, line-height `1.35`): Section headers (`Suggested next steps`, `Quick capture`).
- **Body** (`400`, `0.875rem / 14px`, line-height `1.5`, max measure `68ch`): Default interface copy, inputs, buttons, and session notes.
- **Label** (`700`, `0.75rem / 12px`, line-height `1.2`, tracking `0.06em`, `uppercase`): Sidebar section headers, step metadata (`TYPESCRIPT LEARNING · 15 MIN · AGY CLI`), harness badges, and dialog status badges.
- **Mono** (`400`, `0.8125rem / 13px`, line-height `1.65`, `tabular-nums`): Embedded CLI terminal transcript, command prompt, and live FlowState timer readouts (`00:00`).

### Named Rules
**The Serif-Invites-Sans-Operates Rule.** Reserve Georgia for view-level headings, the TGM brand mark, and modal titles. Never set buttons, form controls, navigation links, or terminal output in serif type.

**The Tabular-Time Rule.** Every elapsed duration, countdown, note count, and harness badge must set `font-variant-numeric: tabular-nums` so ticking timers and updated counts never jitter adjacent layout elements.

## Layout

The application uses a persistent two-column desktop shell (`grid-template-columns: 246px minmax(0, 1fr)`) below the optional 34px preview strip.
- **Left Sidebar (`246px` wide, `22px 16px` padding):** Houses the TGM crest, primary section navigation (`Home`, `Workspace`, `Learning`), and collapsible `<details class="project-group">` trees listing sessions and their bound harness badges.
- **Topbar (`70px` min-height, `12px 40px` padding):** Anchors wayfinding breadcrumbs on the left and persistent Quick Capture jump + live FlowState status HUD (`Focus ready 00:00` with contextual Pause/Stop controls) on the right.
- **Main Content Container (`max-width: 1480px`, `28px 40px 60px` padding):**
  - **Home View:** Opens with a compact intro header (`padding-bottom: 18px`) followed by a two-column asymmetric grid (`grid-template-columns: minmax(0, 1fr) 288px`, `gap: 28px`). The main column stacks three hairlined step rows and the `Continue last session` bar; the `288px` right rail holds the `Independent focus` card. Quick Capture sits immediately below, separated by a 1px hairline (`margin-top: 31px; padding-top: 20px`).
  - **Workspace View:** Replaces the Home section in-place (resetting scroll to `0, 0`) with a back button, session title, harness binding summary, review action buttons (`Save to memory`, `Create reviewer`), the full-width FlowState bar, and the interactive CLI terminal container.
- **Responsive Breakpoints:**
  - `851px–1100px`: Sidebar narrows to `200px`, content horizontal padding tightens to `28px`, and the Home aside flexes between `220px` and `260px`.
  - `721px–850px`: Sidebar narrows to `190px`, content padding tightens to `24px`, the Home grid stacks into a single column (`1fr`), and the decorative header ornament hides.
  - `≤720px`: Sidebar converts into a compact horizontal top wrap with inline session pills so project sessions remain reachable without a hidden hamburger drawer.

## Elevation & Depth

TGM relies on **flat tonal layering and crisp 1px borders** rather than drop shadows. Depth is communicated by stepping surface lightness across four evergreen tiers: Terminal Void (`#061511`) for recessed code/CLI regions, Deep Sanctum (`#081712`) for the sidebar, Asgardian Pine (`#071a15`) for the main canvas, and Sanctum/Elevated Canopy (`#0e2920` / `#10291f`) for raised cards and bars. The only ambient dimming occurs when a native `<dialog>` opens over a `rgba(7, 26, 21, 0.78)` backdrop with a muted brass-olive border (`1px solid #5b6442`).

### Named Rules
**The Flat-Canopy Rule.** Cards, buttons, and bars rest flat on the canvas with `1px solid` borders and zero `box-shadow`. State changes are communicated through background color shifts (`140ms ease`) and crisp focus outlines (`2px solid #77e5c9` with `3px` offset), never glowing neon shadows.

## Shapes

- **Corner Radius Scale:** Tight and utilitarian across controls—`4px` (`xs`) for compact harness badges and inline code pills, `6px` (`sm`) for select menus, sidebar session buttons, and dialog badges, `7px` (`md`) for primary/outline buttons, nav items, and text inputs, `9px` (`lg`) for the Continue card, Independent Focus aside, Focus bar, and Terminal shell, and `12px` (`xl`) for modal review dialogs.
- **Dividers & Borders:** Structural hairlines use `1px solid #2b493a`. Interactive controls use `1px solid #4e715e` at rest, shifting to `#17382b` fill on hover. Left-indented session lists under each project use a vertical `1px solid #2b493a` guide line (`margin-left: 26px; padding-left: 7px`).
- **Iconography & Ornament:** All icons are authored inline SVGs drawn with `stroke: currentColor`, `stroke-width: 1.55`, `stroke-linecap: round`, and `stroke-linejoin: round` at `15px–18px` scale. Unicode symbol characters and emoji are never substituted for icons.

## Components

### Buttons
- **Shape:** Gently rounded (`7px` radius), inline-flex with `10px` internal icon gap and `white-space: nowrap`.
- **Primary (`button.primary`, first `.open-step`):** Solid Bifrost Mint (`#61d8b8`) background, Deep Pine Ink (`#09251b`) bold text (`700`), `10px 15px` padding. Hover shifts to `#8ae8ce`; active applies `filter: brightness(0.9)`.
- **Outline (`button.outline`, secondary `.open-step`):** Transparent background, `#4e715e` 1px border, `#e9eee5` text, `9px 13px` to `10px 13px` padding. Hover fills with `#17382b`.
- **Quiet (`button.quiet`):** Borderless ghost button in `#a8bdad`, `6px 8px` padding, `6px` radius, shifting to `#17382b` background and `#f3f1e6` text on hover.

### Chips
- **Harness Badges (`.harness-badge`):** Compact monospace pills (`12px`, weight `700`, `4px` radius, `2px 6px` padding, `#0b231b` background, `1px solid #4e715e`) displayed inside sidebar session items. `AGY` badges use Horned Brass (`#d9bf80`) text; `OC` (OpenCode) badges use Bifrost Mint (`#61d8b8`) text.
- **Dialog & Terminal Status Badges (`.dialog-badge`, `.terminal-label`):** Uppercase `12px` bold labels in `#d9bf80` with `0.06em` tracking that explicitly distinguish simulated or preview states from committed writes.

### Cards / Containers
- **Independent Focus Aside (`.home-aside`):** `9px` radius, `18px` padding, `#10291f` background, `1px solid #5b6442` brass-tinted border.
- **Continue Last Session Bar (`.continue`):** Full-width interactive card (`9px` radius, `14px 16px` padding, `#0e2920` background, `1px solid #4e715e`) pairing a `20px` mint arrow icon, session title, project + harness subtitle, and right-aligned brass arrow.
- **Focus Bar (`.focus-bar`):** Horizontal status and control strip (`9px` radius, `13px 16px` padding, `#0e2920` background, `1px solid #2b493a`) keeping `Start focus`, `Pause`, `Stop session`, and `Complete task` visually distinct.

### Inputs / Fields
- **Text Inputs & Textareas:** `#0b231b` background, `1px solid #4e715e` border, `7px` radius, `11px 12px` padding, `#e9eee5` text, `#a8bdad` placeholder (`6.8:1` contrast).
- **Select Dropdowns (`select`):** `#10291f` background, `1px solid #4e715e` border, `6px` radius, `8px 10px` padding, `#e9eee5` text.
- **Focus & Disabled States:** `:focus-visible` renders a `2px solid #77e5c9` outline at `3px` offset; `:disabled` reduces opacity to `0.48` with `cursor: not-allowed`.

### Navigation
- **Primary Nav (`.nav`):** Full-width vertical buttons (`7px` radius, `12px` padding, `13px` icon gap) in `#a8bdad` with `18px` Horned Brass SVG icons. Active route uses `#153c2c` background and `#f3f1e6` text (`aria-current="page"`).
- **Project Disclosure Groups (`.project-group`):** Native `<details>` elements with custom `<summary>` rows (`6px` radius, `9px 8px` padding, `12px` bold `#e9eee5` text) and a rotating `14px` chevron. Child `.session` buttons sit along a left vertical hairline and highlight in `#153c2c` when active.

### Multi-Harness Terminal & Evidence Review
- **Multi-Harness Terminal Shell (`.terminal`):** `9px` radius container in `#061511` with a `#10291f` header bar (`11px 16px` padding) displaying the prompt indicator (`›_`), active harness title (`AGY Terminal` or `OpenCode Terminal`), executable command badge (`agy` or `opencode --standalone`), session-harness selector, and diagnostic state toggle. When a CLI is unavailable or session resume fails, an inline `.terminal-alert` banner (`#291616` background, `#8a4b4b` bottom border, `#f5c6c0` text) explains the failure while keeping FlowState focus and Quick Capture operational.
- **Evidence-First Review Dialog (`dialog#review-dialog`):** Native modal (`max-width: 680px`, `12px` radius, `24px` padding) structured into three strict zones: header with preview badge, a hairlined `.evidence` definition list (`Session`, `Harness`, `Focus`, `Captured notes`) reporting verified session facts, and an editable `<textarea>` draft for the proposed memory or Obsidian reviewer update.

## Do's and Don'ts

### Do:
- **Do** keep `Stop session` and `Complete task` as separate buttons and state transitions so stopping focus for the day never marks an unfinished task complete.
- **Do** display the bound CLI harness (`AGY CLI` or `OpenCode`) on every session in the sidebar, workspace header, terminal bar, and review dialog.
- **Do** preserve independent FlowState focus and Quick Capture usability when the selected CLI harness is offline or fails to resume.
- **Do** pair wide letter-spacing (`0.06em`) strictly with `text-transform: uppercase` on short `12px` labels and badges.
- **Do** use authored `1.55px`-stroke inline SVGs for all icons and directional arrows.

### Don't:
- **Don't** place uppercase kicker or eyebrow labels above `<h1>`, `<h2>`, or `<h3>` headings; let the heading hierarchy speak directly and place status badges beside actions or in metadata rows.
- **Don't** present AI-generated summaries, memory drafts, or reviewer notes as verified facts; always separate factual session evidence from editable AI proposals.
- **Don't** use Unicode symbols (`↗`, `→`, `✧`, `×`) or emoji in place of consistent SVG icons.
- **Don't** introduce glassmorphic blur cards, multi-stop neon gradients, or decorative glow shadows that compete with the terminal and reading surfaces.
