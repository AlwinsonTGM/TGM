# TGM: six-prototype UX and design audit

**Date:** 6 November 2026
**Scope:** Six Gemini 3.8 Flash UX branches at the commits listed below. This is an audit of disposable, synthetic prototypes, not production software or a test of actual AGY, FlowState, Obsidian, persistence, or security. The user asked for separate visual-design and usability grades. Those grades are the reviewer's judgment, not the user's own rating.

## Recommendation

Use **Discovered Skills** as the leading *starting point for another design iteration*, pending the user's preference. Its compact Home presents an independent focus action, three small steps, recent context and a clear path into the workspace. Borrow the clean evidence/proposal separation from **Impeccable**, consider **Open Design's** side-by-side inspector and command palette after fixing their behavior, and consider **UX Pro Max's** optional “Pick for me” idea. None of the prototypes is ready to ship or should be copied without reviewing its defects.

All six share the Loki-inspired green/gold visual seed, familiar sidebar, synthetic content, and an explicit preview banner. The experiment therefore compares these particular variations, not whether a skill or the model universally produces better design.

## Grades

Visual: hierarchy, typography, consistency, personality, and fit to the chosen Loki direction. Usability: ease of starting, clarity of focus/stop/complete, capture, review, keyboard use and tested state behavior. Scores are subjective /10, assessed for this user's desktop-first workflow. Integration omissions and intentionally resettable sample data were not scored as production defects.

| Variation | Commit | Visual /10 | Usability /10 | Main takeaway |
|---|---|---:|---:|---|
| [Discovered Skills](../work/ux-variations/ux-discovered-skills/outputs/tgm-ux-prototype/index.html) | `6e8f83c` | **8** | **7.5** | Best balance of compact Home, direct focus and review concepts; fix hover contrast and unsupported “verified” sample claims. |
| [Impeccable](../work/ux-variations/ux-impeccable/outputs/tgm-ux-prototype/index.html) | `7f080e6` | **8** | **7** | Restrained and readable, with the clearest evidence/proposal modal; completion disappears after stopping focus. |
| [Taste + Motion](../work/ux-variations/ux-taste-motion/outputs/tgm-ux-prototype/index.html) | `b9a76c0` | **7.5** | **7** | Helpful independent-focus card and capture placement; more dashboard density and persistent animation. |
| [Open Design Benchmark](../work/ux-variations/ux-open-design-benchmark/outputs/tgm-ux-prototype/index.html) | `4233a40` | **7.5** | **6.5** | Promising side-by-side review and shortcuts; task state conflicts, command search behavior, and keyboard focus need work. |
| [Baseline / no skills](../work/ux-variations/ux-baseline-noskills/outputs/tgm-ux-prototype/index.html) | `d895cca` | **7** | **7** | Independent focus is easy to understand; layout is long and demo text presents canned results as verified. |
| [UX Pro Max](../work/ux-variations/ux-pro-max/outputs/tgm-ux-prototype/index.html) | `a8b5d50` | **8** | **6.5** | Most decorative treatment and useful “Pick for me”; oversized cards and duplicated controls bury content. |

The [comparison arena](ux-arena/index.html) lets the user make their own judgment; its [setup notes](ux-arena/README.md) explain how to recreate the worktrees after cloning. These prototype links depend on the local worktrees being present.

## Technical health snapshot

Impeccable audit dimensions are scored **0–4, provisional**: A = accessibility, P = performance, T = theming, R = responsive layout, I = implementation integrity. These indicate review priority and are not a WCAG conformance determination. Performance scores are source-based estimates only; no frame-rate, memory, startup or low-end-device benchmarks were run. No light theme was required or assumed.

| Variation | A | P | T | R | I | Total /20 | Strongest evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Impeccable | 2 | 3 | 3 | 2 | 2 | **12** | Native review dialog and focus styles; completion unavailable after stopping. |
| UX Pro Max | 2 | 2 | 3 | 2 | 2 | **11** | Labeled controls; heavier blur, layered cards and external font requests; long Home and retained scroll position. |
| Taste + Motion | 2 | 2 | 2 | 2 | 2 | **10** | Review separates evidence; continuous decorative animations and pointer-driven effects merit profiling. |
| Discovered Skills | 1 | 3 | 3 | 2 | 2 | **11** | Token structure and useful simulated conflict handling; contrast failure in a hover rule. |
| Open Design Benchmark | 1 | 3 | 2 | 2 | 1 | **9** | Keyboard-first concept; modal focus escapes and task state becomes contradictory. |
| Baseline / no skills | 2 | 2 | 2 | 2 | 2 | **10** | Native review dialog; several continuous animations, a long Home and prefilled “verified” content. |

Technical scores are not averages of the two user-facing grades: they answer a different question and are based on limited checks.

## Priority findings

Severity counts below refer to **grouped findings**, not every occurrence: **P0 0 · P1 4 · P2 4 · P3 1**. A P1 is a significant workflow or accessibility problem to resolve before release; the current artifacts are prototypes.

1. **[P1] Impeccable: completing after stopping is unavailable.** Start focus in a workspace, stop the session, then look for Complete task: the control is hidden and disabled. [The state logic](../work/ux-variations/ux-impeccable/outputs/tgm-ux-prototype/prototype.js#L146) sets completion visibility from whether focus is active; [the handler](../work/ux-variations/ux-impeccable/outputs/tgm-ux-prototype/prototype.js#L677) also requires running or paused focus. This conflates task state with timer state. Make completion independently available for an open task, including after stopping. Suggested: `$impeccable harden`.
2. **[P1] Open Design: contradictory task status.** Start focus → stop → Complete task: the header says “Task status: Completed” while the FlowState bar still says “Task remains open.” The [status logic](../work/ux-variations/ux-open-design-benchmark/outputs/tgm-ux-prototype/prototype.js#L207) derives those messages differently. Render both from the same task state. Suggested: `$impeccable harden`.
3. **[P1] Open Design: focus escapes the command palette.** With the palette open, tabbing through its controls eventually moves focus to the background page while the overlay is still open. Its [dialog markup](../work/ux-variations/ux-open-design-benchmark/outputs/tgm-ux-prototype/index.html#L418) declares a modal; its keyboard behavior must keep focus inside and restore it on close. Suggested: `$impeccable harden`.
4. **[P1] Discovered Skills: primary mini-button hover contrast.** The primary mini-button has dark text, but [the generic hover rule](../work/ux-variations/ux-discovered-skills/outputs/tgm-ux-prototype/styles.css#L1676) turns its background dark. The detector calculated approximately **1.4:1** for `#04241d` on `#194133`, including the Home focus and terminal Run controls; this is below the 4.5:1 normal-text target. Verify the final rendered hover states and use a contrasting color pair. Suggested: `$impeccable colorize`.
5. **[P2] Narrow desktop navigation loses visual labels across all six.** At 800 CSS px the sidebar collapses to icon-only session links. Functions and Objects use the same visual icon; their labels remain available to accessibility APIs but the tested links have no hover `title`. Offer a labeled expanded sidebar or visible tooltips on hover and focus. Example: [Discovered Skills breakpoint](../work/ux-variations/ux-discovered-skills/outputs/tgm-ux-prototype/styles.css#L1739). Suggested: `$impeccable adapt`.
6. **[P2] Home-to-workspace can retain an unhelpful scroll position.** At 800×720, opening the first step left the workspace heading above the viewport in UX Pro Max and Baseline; at 1280×720 both also opened with the document scrolled down. Reset or manage the workspace scroll/focus on navigation. Suggested: `$impeccable harden`.
7. **[P2] Open Design command search gives capture priority over navigation.** Typing “Review study notes” displays both capture and the matching session; pressing Enter captures the words instead of opening the session. [The filter](../work/ux-variations/ux-open-design-benchmark/outputs/tgm-ux-prototype/prototype.js#L680) always retains capture first and [Enter chooses the first visible result](../work/ux-variations/ux-open-design-benchmark/outputs/tgm-ux-prototype/prototype.js#L908). Provide explicit selection and arrow-key navigation, and make the current Enter action clear. Suggested: `$impeccable harden`.
8. **[P2] Sample evidence can look more authoritative than it is.** Discovered Skills shows “Verified Concept” and `#status/reviewed` before an actual study/review action; Baseline's initial simulated terminal shows “All checks passed” and its draft can say a concept was verified; Open Design starts with “Verified context” and “3 verified notes.” The global sample banners help, but preserve the user's distinction between real observations and suggested or illustrative content in the final design. Examples: [Discovered Skills](../work/ux-variations/ux-discovered-skills/outputs/tgm-ux-prototype/index.html#L429), [Baseline](../work/ux-variations/ux-baseline-noskills/outputs/tgm-ux-prototype/prototype.js#L18), [Open Design](../work/ux-variations/ux-open-design-benchmark/outputs/tgm-ux-prototype/index.html#L337). Suggested: `$impeccable clarify`.
9. **[P3] UX Pro Max spends too much space on ornament and duplicated choices.** At 1024×768, only the first full suggested step fits in the initial view; quick time pills repeat a time dropdown and nested bezels make the list heavier. Keep the distinctive material treatment, reduce borders and repeated filters, and reserve space for the next action. Suggested: `$impeccable distill`.

## Notes on each option

- **Discovered Skills:** Home shows a task-selectable independent focus card and compact step rows. Its Obsidian-inspired review has an editable proposal, evidence strip, Reading/Markdown tabs and a simulated external-edit conflict. In the test, simulating a conflict disabled approval and offered refresh. That is useful behavior to design for, not proof of a safe real-vault integration. It lists only three sample sessions in its sidebar, omitting the Portfolio session present in the other variations.
- **Impeccable:** The strongest clear two-column review modal labels session evidence separately from an editable AI proposal; at normal view the actions are visible together. The calm Home is spacious, but Continue and the full capture input sit below the initial 1280×720 viewport. The completion defect above is a priority.
- **Taste + Motion:** Its Home pairs suggested work with a separate FlowState panel and a capture panel near the first viewport. Review presents verified facts and selectable AI suggestions in separate columns. At 1280×720 its tall dialog needs scrolling to reach all controls; pointer-driven spotlight and several infinite animations need a real performance and motion-sensitivity check.
- **Open Design Benchmark:** Compact suggestion rows, keyboard hints, an always-accessible command trigger and a non-blocking split inspector suit a CLI user. At 1280×720 the inspector reduces terminal width; verify at the user's actual window size. Its keyboard and status defects mean the concept should be revised before being relied on.
- **Baseline / no skills:** A simple independent-focus card lets the user enter a task without AGY, and stop/complete are separate. The full screen is longer, has duplicate time-filter controls, and its canned terminal and memory copy need much clearer sample/evidence labeling.
- **UX Pro Max:** The green/gold material and top capture shortcut are visually distinctive; the optional “Pick for me” is well suited to an overwhelmed user. Large double-bezel cards, an energy row, time chips and another dropdown compete for space. Its [HTML](../work/ux-variations/ux-pro-max/outputs/tgm-ux-prototype/index.html#L7) requests Google Fonts; test fallbacks and consider local fonts for offline use. No runtime performance claim has been established.

## What was checked

- Viewed all six Home and workspace screens at 1280×720, and inspected layout at 1024×768 and 800×720 CSS pixels in the in-app browser. At those tested narrow Home widths no page-level horizontal overflow was observed. This is not a complete responsive or physical-device audit.
- Opened a suggested session in each; started and stopped sample focus in each; checked stop-then-complete behavior; switched sessions while a sample focus timer was running; captured a synthetic note in the workspace and saw it on Home in all six. Once its initial transition had finished, Impeccable's focus and review controls worked; a very rapid interaction during the transition initially produced no action.
- Opened each memory review and checked Escape. The native dialogs closed and focus returned to their trigger; Open Design's inspector also closed. Tested the Open Design command palette separately and confirmed its keyboard issues. Tested Discovered Skills' simulated vault conflict. No real data or external integrations were touched.
- Ran the bundled Impeccable detector once per prototype. Its source-target scan returned `[]` for Impeccable and findings for the other five. The detector's “flat type hierarchy” warning is not accepted automatically: the rendered Home headings were visibly larger than body text, so its role-size sampling is not reliable for this comparison. Detector flags about glow, fonts, or side borders are style signals, not automatic defects; the user specifically chose a Loki-inspired palette. The verified contrast rule and selected small-label findings were checked in context. A clean scan is not accessibility certification.
- Checked source for reduced-motion rules: all six contain them. Most use a broad near-zero animation-duration override; Discovered Skills also defines a gentle fade. Reduced motion was not exercised with an actual OS setting; real screen-reader, high-contrast, browser zoom, offline font, sustained performance, and production Electron tests remain open.

## Next design iteration

1. Agree on the preferred visual base with the user; do not treat these scores as their preference.
2. Refine the Home around a visible small-step choice, optional independent focus, and reachable Continue/Capture without decorative overload.
3. Keep task and timer as separate states; fix the concrete state, contrast, palette, keyboard, and navigation problems above in a disposable iteration.
4. Test the actual user's start-to-study journey and reduced-motion/keyboard behavior, then run `$impeccable audit` again. Finish the chosen UI with `$impeccable polish` when appropriate.
