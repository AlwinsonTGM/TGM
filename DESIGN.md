---
name: TGM
description: A calm, familiar workspace for taking the next step.
colors:
  forest-canvas: "#071a15"
  forest-sidebar: "#081712"
  forest-panel: "#10291f"
  forest-active: "#153c2c"
  forest-input: "#0b231b"
  terminal-canvas: "#061511"
  rule-green: "#2b493a"
  control-border: "#4e715e"
  text-primary: "#e9eee5"
  text-muted: "#b1c5b5"
  muted-gold: "#d9bf80"
  soft-mint: "#61d8b8"
  dark-ink: "#09251b"
  focus-mint: "#77e5c9"
typography:
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "14px"
  section:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  supporting:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.5
  terminal:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: "14px"
rounded:
  control: "7px"
  navigation: "8px"
  panel: "9px"
  focus-panel: "10px"
spacing:
  compact: "8px"
  control: "12px"
  panel: "18px"
  section: "28px"
  gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.soft-mint}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "#edf4ea"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  input:
    backgroundColor: "{colors.forest-input}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  navigation-current:
    backgroundColor: "{colors.forest-active}"
    textColor: "#f0f2e8"
    rounded: "{rounded.navigation}"
    padding: "12px"
---

# Design System: TGM

## Overview

**Creative North Star: "The Quiet Workspace"**

TGM is calm, focused, and familiar: a desktop workspace that helps a person find their next action without visual noise. Deep green surfaces, soft mint actions, and muted gold identity details give it a quiet warmth. Serif headings introduce a personal voice; straightforward sans-serif controls keep work easy to scan.

The interface is restrained and practical. It uses open space, fine rules, simple line icons, and a few gently layered panels. Preserve the user-approved Codex direction as new screens and states are added, and give honest, readable feedback when functionality is unavailable or an action fails.

**Key Characteristics:**

- Deep forest surfaces with muted gold identity details and soft mint actions.
- Georgia headings alongside familiar Segoe UI controls and body text.
- Flat, gently layered surfaces, fine borders, and ruled lists.
- Compact navigation, clear labels, and an obvious keyboard focus treatment.

## Colors

The palette combines deep forest neutrals with two deliberate accents. The token values above are the source of truth; the descriptions below explain their current roles. The companion file includes generated tonal ramps for preview only; those ramps are not established app tokens.

### Primary

- **Soft mint** marks primary actions, the terminal cursor, and selected text. Its dark ink keeps filled controls legible.
- **Focus mint** outlines keyboard-focused controls, distinct from hover and selection.

### Secondary

- **Muted gold** identifies TGM, navigation icons, small section labels, and selected supporting details. It is an accent rather than a second primary button color.

### Neutral

- **Deep forest canvas and sidebar** frame the app. Slightly lighter forest panels and active navigation create hierarchy.
- **Forest input and terminal canvas** distinguish editable and terminal surfaces without leaving the dark world.
- **Rule green and control borders** separate regions and define interactive boundaries.
- **Primary and muted text** establish hierarchy without relying only on color to communicate status.

## Typography

Georgia gives major page headings and the TGM wordmark a warm editorial character. Segoe UI with Arial fallback handles everyday interface text; the terminal uses Cascadia Mono with Consolas fallback.

- **Page headline:** Georgia at 32px, weight 600, line height 1.15, and -0.02em tracking; 28px at narrow widths.
- **Section title:** 16px bold sans serif. Standard item titles use 14px bold.
- **Body:** 14px sans serif. Supporting copy is commonly 12px with 1.5 line height.
- **Brand:** 26px bold Georgia with 0.04em tracking; a small spaced sans-serif descriptor sits underneath.
- **Terminal:** 14px monospace, preserving the harness's own output and identity.

## Layout

At desktop widths, a 246px navigation rail sits beside a flexible main area. A 64px minimum-height top bar provides location and utility actions; content is centered with a 1480px maximum width and 40px horizontal gutters. Home uses a single content column; when independent work is active, a 288px focus panel appears beside it with a 28px gap. Dividers and simple list rows establish hierarchy without wrapping every item in a card.

From 851px to 1100px, the rail narrows to 200px and horizontal gutters to 28px. At 850px and below, Home's columns stack. At 720px and below, the sidebar becomes a compact, wrapping top navigation, secondary sidebar content is hidden, gutters reduce to 18px, and the terminal screen changes from 350px to 300px high. At 450px and below, the capture field and action wrap.

## Elevation & Depth

The current app is flat and gently layered: depth comes from dark surface shifts, thin borders, and spacing rather than prominent shadows. The terminal is a darker inset within a bordered frame. Buttons transition their background and border colors over 140ms; reduced-motion preferences disable that transition.

## Shapes

Controls have modest 7px corners; navigation uses 8px corners; framed notes and terminal surfaces use 9px, and the focus panel uses 10px. The custom TGM mark and interface icons are simple, thin strokes. Borders are typically one pixel and never replace clear labels.

## Components

### Buttons

Primary actions use a soft mint fill and dark, bold text. Secondary actions use a transparent background, a green border, and light text; quiet actions are unfilled text that underlines on hover. Disabled buttons use reduced opacity. Keyboard focus uses a 2px mint outline offset by 3px. Small gold line icons can support a label without replacing it.

### Inputs and selectors

Text fields use a dark green fill, light text, a green border, and 7px corners. Labels explain their purpose; placeholder text is supporting guidance. Selectors in Workspace follow the same shape, with a minimum 40px control height. Errors are written in text near the relevant action, and saved drafts remain available when saving fails.

### Navigation

The sidebar combines the gold TGM mark and wordmark with labeled line-icon navigation. Projects is a shortcut to its management section on Home. The current destination receives a lighter green background. Unavailable destinations are identified as such. On narrow screens, navigation wraps above the content rather than disappearing.

### Rows and panels

Suggested steps are simple ruled rows with a title, supporting goal, and an action. Home initially shows up to three suggested steps, with more available on request; a row's chooser and editor appear beside it. Completed steps remain available in a collapsed list. The independent-work panel appears only while it is useful. Empty, loading, success, and error states use concise text.

### Terminal

Workspace places harness and folder controls before a bordered terminal frame. A selected step can be copied or completed without being sent automatically or stopping the terminal. Its heading identifies the selected harness and local session, while the dark terminal canvas uses monospace text. Status and availability are presented as text, including when sessions cannot persist.

## Do's and Don'ts

### Do:

- **Do** extend the approved forest, mint, and gold palette and use existing components as the starting point.
- **Do** pair serif page headings with clear sans-serif labels and readable body text.
- **Do** preserve visible keyboard focus, meaningful labels, and explicit loading, error, and unavailable states.
- **Do** use rules, spacing, and subtle surface changes to organize content.

### Don't:

- **Don't** replace the approved visual identity with an unrelated generated design.
- **Don't** add decorative gradients, neon accents, or collections of ornamental badges.
- **Don't** imply an integration or action is available when it is not connected.
- **Don't** make a panel or color carry information that needs a readable label.
