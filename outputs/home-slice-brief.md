# TGM Home — first-slice brief

**Confirmed:** 7 November 2026.  
**Visual reference:** [Selected Codex concept](tgm-ux-prototype/index.html). Its data and integrations are simulated.

## Purpose

Help the user resume meaningful work quickly while keeping a few possible next steps visible. Use the chosen Codex concept as the starting point for a familiar, compact desktop workspace.

## Home hierarchy

1. **Continue last session** is the first prominent action when a session exists. Show enough context to recognize the project and retain the original harness identity where applicable.
2. **Suggested next steps** remain visible. Base them on available local goals and saved steps; the user chooses what to open.
3. **Quick capture** is easy to reach and saves a thought without requiring a category.
4. **Independent focus** remains visible as part of the product direction. Its control accurately reflects whether a real FlowState connection is available.

## First-slice behavior and states

- Goals and quick captures persist locally. Home uses available local data for suggestions and Continue.
- Add a goal through a short form on Home, with its first next step optional.
- Selecting a suggested step opens its goal and step details for review or editing. This does not start a focus or harness session.
- When there is no previous session, lead with the available next steps. A new user sees useful empty states for adding a goal or capture.
- Show clear feedback for failed saves and unavailable session actions; do not claim success when an action did not succeed.
- Continue is prioritized over the first suggestion, changing the hierarchy shown in the current prototype.

## Boundary

This slice establishes the Home experience and its local basics. The existing terminal foundation, FlowState, and Obsidian require separate integration work. Do not present simulated integrations as working ones.
