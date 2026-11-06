---
name: TGM
description: A calm desktop workspace for returning to meaningful work.
colors:
  background: "#071a15"
  sidebar: "#081712"
  surface: "#0e2920"
  divider: "#2b493a"
  text: "#e9eee5"
  muted: "#a8bdad"
  gold: "#d9bf80"
  teal: "#61d8b8"
  action-ink: "#09251b"
  focus-ring: "#77e5c9"
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
rounded:
  small: "6px"
  control: "7px"
  panel: "9px"
  dialog: "12px"
spacing:
  small: "8px"
  medium: "12px"
  large: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
---

# Design System: TGM

## Overview

**Creative North Star: "A Calm Workspace"**

TGM is focused, welcoming, and practical. Its controls feel familiar and restrained, with clear feedback and a compact desktop layout. Use the selected Codex concept as the visual reference, and prioritize clear tasks over decoration.

This is a record of a **disposable prototype**, not a claim that production components or complete accessibility states exist. The palette and flat, layered character are confirmed; exact values below are extracted from the prototype and should be validated as the real application is built.

**Key Characteristics:**
- Deep forest-green surfaces with warm gold details and mint-teal actions.
- Clear navigation, restrained controls, and compact project context.
- Thin borders and tonal layering rather than prominent shadows.
- Serif headings paired with familiar, readable sans-serif controls.

## Colors

### Primary

- **Mint teal** marks prominent actions and useful state accents. Deep action ink keeps text legible on filled teal controls.
- **Warm gold** carries brand details, icons, and small supporting accents.

### Neutral

- **Deep forest** is the main background; the darker sidebar and slightly lighter green surfaces separate regions.
- **Soft light text** and **muted sage text** distinguish primary content from supporting information. Green dividers define boundaries without heavy outlines.
- The mint focus ring makes keyboard focus visible; production contrast still needs verification.

## Typography

The prototype pairs Georgia headings with Segoe UI for body text and controls. Consolas is used for terminal and timer data. Home's main heading is the `headline` token above; the prototype uses 14px body text and commonly uses 12px secondary labels. Verify readability at real desktop sizes instead of assuming the prototype's smallest labels are sufficient.

## Layout

The prototype uses a 246px project/session sidebar and a flexible main content area, with content capped at 1480px and 40px horizontal padding on wide screens. Home combines a flexible list with a 288px side panel. At medium widths the sidebar narrows and the content adapts; at 720px and below, navigation moves above the content and session links remain accessible.

The confirmed [Home brief](outputs/home-slice-brief.md) changes the prototype's hierarchy: Continue is the prominent first action when a session exists. Its responsive arrangement and remaining production layouts need implementation and testing.

## Elevation & Depth

Surfaces are mostly flat and layered. The prototype separates regions with nearby dark-green tones, fine borders, and spacing; it does not establish a shadow vocabulary.

## Shapes

Controls use modest rounded corners, typically 6–7px; panels are around 9–10px and the review dialog uses 12px. Borders are thin and low-key. Line icons accompany navigation and project labels.

## Components

- **Buttons:** Mint-teal filled primary actions, outlined secondary actions, and quiet text actions. The prototype uses a 2px focus outline and a 140ms background/border transition; reduced-motion settings remove the transition.
- **Inputs and selects:** Dark surfaces with fine green borders and rounded corners. Capture accepts uncategorized text. Error and disabled states require production design and verification.
- **Navigation:** A sidebar with recognizable icons, a selected-row background, and expandable project groups containing sessions.
- **Panels and lists:** Suggested actions use separated rows; Continue and independent focus have distinct outlined surfaces. Their final order follows the confirmed Home brief.
- **Review dialog:** A bounded, bordered surface with editable proposal content and clear approve/discard controls. Its current interactions are simulated.

## Do's and Don'ts

### Do

- **Do** keep controls familiar, focus indicators visible, and feedback clear.
- **Do** use dark-green tonal layers, warm gold details, and teal selectively for prominent actions.
- **Do** respect reduced-motion preferences and test the real interface at relevant Windows sizes.

### Don't

- **Don't** present simulated integrations or sample data as real activity.
- **Don't** treat prototype measurements or incomplete states as proof of production readiness.
