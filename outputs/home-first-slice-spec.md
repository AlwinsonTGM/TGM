# TGM Home: first implementation slice

**Status: Ready for planning.** This spec describes the first implementation slice, not the complete first usable release. The Home behavior and test boundary were confirmed on 7 November 2026.

## Problem Statement

Starting a work or study session can be difficult when there are many goals and no obvious next action. A useful starting screen should help the user return to prior work, choose a manageable step, and capture a thought without first organizing it. The current design concept uses disposable sample data and does not provide durable local records or real integrations.

## Solution

Build the first Home experience as a Windows-first desktop application using the selected Codex-inspired design direction. Let the user create a goal and optionally add its first next step in a short Home form, save uncategorized quick captures, see suggestions derived from saved active goals and steps, and open a suggested step's details to review or edit it. Save these records locally and restore them after restart.

Design Home to give Continue prominence when a genuine previous session is available. This first slice does not connect a real session provider, so it must honestly report that session continuation is unavailable rather than simulate a working resume. FlowState, terminal, and Obsidian integration will follow as part of the broader first release.

## User Stories

1. As a user, I want Home to make my available next actions easy to scan, so that I can begin without sorting through a large backlog.
2. As a user, I want a short form on Home to create a goal, so that recording something I want to do feels approachable.
3. As a user, I want to add an optional first next step when creating a goal, so that I can identify a concrete way to start.
4. As a user, I want to create a goal without supplying a first step, so that I can decide on an action later.
5. As a user, I want my saved goals and steps to remain after the application restarts, so that I can return to them.
6. As a user, I want Home to suggest steps drawn from my available active goals, so that suggestions reflect things I actually recorded.
7. As a user, I want each suggested step associated with its goal and its reason grounded in saved information, so that I can understand where it came from.
8. As a user, I want to select a suggested step and see its goal and step details, so that I can decide what to do.
9. As a user, I want to review and edit the selected step's details, so that I can adjust the action before working on it.
10. As a user, I want selecting or viewing a suggestion to leave my records unchanged, so that exploration is safe.
11. As a user, I want the application to avoid inventing actions, estimates, AI output, or completion, so that I can trust what it shows.
12. As a user, I want a helpful empty state when no suggested steps exist, so that I know how to add one.
13. As a user, I want archived goals excluded from ordinary suggestions when archival is supported, so that inactive work does not crowd my choices.
14. As a user, I want to quickly capture a thought without assigning a goal or project, so that I can get it out of my head.
15. As a user, I want saved captures to remain after restarting the application, so that I can return to them.
16. As a user, I want clear confirmation after a goal, step, or capture is persisted, so that I know it was saved.
17. As a user, I want unsaved text preserved when validation or a write fails, so that I can correct it or retry without retyping.
18. As a user, I want an understandable error if local data cannot be loaded, so that the application does not imply that my records were erased.
19. As a user, I want local goals and capture to remain available without a network or harness, so that I can work independently.
20. As a user, I want a real previous session prioritized when one is available in a future connected version, so that I can return to work quickly.
21. As a user, I want a missing session distinguished from an unavailable session source, so that I understand why Continue cannot be used.
22. As a user, I want an unavailable integration clearly indicated, so that I do not mistake a preview for a working focus timer, terminal, or reviewer.
23. As a user, I want the interface to retain a session's original harness identity when a supported integration supplies one, so that sessions are not presented as interchangeable.
24. As a user, I want the interface to report an actual resume result rather than assume success, so that a failed connection is visible.
25. As a user, I want familiar controls, visible keyboard focus, and legible information, so that using Home feels straightforward.
26. As a user, I want the Home layout to remain usable at relevant Windows window sizes, so that it works in my normal desktop setup.

## Implementation Decisions

- Use the accepted React, TypeScript, Vite, Electron, and SQLite direction. The dashboard owns its local goals, next steps, and captures; a separate local-data layer validates and persists operations for the Home UI.
- Use the selected visual direction: calm, restrained controls; dark-green surfaces; warm-gold details; and teal accents. The concept provides visual guidance, not production-ready implementation or proof of accessibility.
- Home offers a short goal form with an optional initial step and a category-free quick-capture input. Opening a suggestion reveals its goal and step details for review or editing; opening it does not create a session, mark work complete, or silently save changes.
- Generate first-slice suggestions from available user-provided active-goal steps. Do not rely on an AI service or fabricate details. Exact ordering is an implementation choice subject to the confirmed behavior.
- Treat successful persistence, validation failure, write failure, and load failure as distinct outcomes. Report success only after durable saving, and retain input on failure.
- Model real session availability separately from absence of sessions and unavailable session sources. A future session provider must retain the original harness identity when applicable and report actual resume outcomes. The first slice does not connect the terminal foundation or provide real resume.
- Make unavailable integrations honest and nonblocking for local goals and capture. Do not imply that FlowState, an installed harness, or Obsidian is connected.
- Keep app and test data isolated. The database location, SQLite binding, migrations, backup and recovery, and platform packaging remain implementation decisions to investigate and verify.
- Preserve the distinction between stopping a focus session and completing a task in later integration work.

## Testing Decisions

- Exercise user-visible Home behavior through the application boundary with isolated local persistence and a controlled session-provider fixture. Verify observable behavior and persisted outcomes rather than implementation details.
- Exercise creation of a goal with and without a first step, suggestion review and editing, quick capture, and restart persistence against disposable data.
- Exercise empty results, unavailable session source, a representative existing-session fixture, validation or write failure with retained input, and load failure. Fixture-driven session display must not claim real resume support.
- Verify that local behavior remains usable with external integrations unavailable, that accessible keyboard focus and relevant window sizes are usable, and that production UI states accurately report availability.
- Test actual AGY and OpenCode launch and resume, FlowState behavior, and Obsidian writes separately when those integrations are implemented. Existing terminal and focus experiments are feasibility evidence, not prior tests of this dashboard slice.

## Out of Scope

For this slice: real harness terminal connection and resume, a real FlowState connection, Obsidian reviewer writes, AI-generated suggestions, project memory, learning history, and practice modes. Their absence here does not remove them from the broader first usable release.

## Further Notes

- Continue's prominent placement applies when a genuine session source can supply a session. Until then, Home leads with available next steps and clearly explains unavailable session continuation.
- The broader first release still requires both installed harnesses, independent and harness-assisted FlowState focus, approved Obsidian reviewers, goal and session access, learning history, and multiple-choice, interview, and hands-on practice.
- Implementation must verify data ownership, recovery, and external integration behavior before real user data is relied on.
