# TGM Home — UI and logic contract

**Status:** Working draft, 7 November 2026. This defines a small shared boundary for the [confirmed Home brief](home-slice-brief.md); it is not an implemented API or a specification for the entire first release.

## Scope and ownership

The dashboard owns its locally saved goals, explicit next steps, and uncategorized quick captures. The Home UI presents those records and asks the logic layer to save changes; the logic layer validates and persists them, then reports the result. Local data remains usable without a harness or network.

The selected [Codex concept](tgm-ux-prototype/index.html) supplies the visual starting point; it uses simulated data. FlowState, the standalone terminal, and Obsidian are separate integrations and are not made operational by this contract.

## Information Home needs

| Information | Minimum supplied to the UI | Rules |
|---|---|---|
| Goals and next steps | Stable local IDs, user-entered goal titles, active/archived state where available, and any explicit saved next steps. | Show only available, active-goal material as suggested steps. Keep each suggestion traceable to its goal and give a reason grounded in that source. Never fabricate an action, estimate, AI output, or completion. If no usable steps exist, show a useful empty state. |
| Quick captures | Stable local IDs and user-entered text. A capture need not have a category, goal, or project. | A successful save means the record is persisted locally, including after restart. The UI must retain unsaved text if saving fails and allow retry. |
| Last session | When a real, available session source supplies one: session identity, display title, project context when available, and original harness identity when applicable. | When a session is present, Continue is the prominent action. An absent session and an unavailable session source are different states. Do not fabricate a session or claim it resumed. The current standalone terminal does not preserve sessions across app restarts. |
| Integration availability | An honest status for each integration the screen exposes, such as available, unavailable, or not yet connected. | Disable or explain actions that cannot work. Do not present a simulated focus timer, terminal, or vault write as a real integration. |

Suggestions for this slice are derived from saved user-provided information, not an AI service. Displaying them does not change a goal or start a session. Selecting a suggestion opens its goal and step details for review or editing without starting a session. Exact ranking remains an implementation detail.

## Operations and feedback

- **Load Home:** request local goals, next steps, and captures, along with whatever session and integration information is genuinely available. Show loading, data, empty, and error states; unavailable integration data must not prevent access to successfully loaded local data.
- **Save a goal or next step:** submit user-entered content to the logic layer. Show a saved result only after persistence succeeds. On validation or storage failure, show a useful error and preserve the input for correction or retry.
- **Add a goal:** provide a short form from Home; the first next step is optional.
- **Save a quick capture:** submit its text without requiring classification. On success, show it as saved; on failure, preserve the text and provide a retry path.
- **Continue:** request the selected real session through its supported integration, retaining its original harness when applicable. Show the actual result or an understandable unavailable/failure state; do not equate a click with a successful resume.

The interface can use representative fixtures during development, but they must be clearly isolated from durable user data and must not be mistaken for actual session or integration status.

## Checks for the first slice

1. Save a goal, an explicit next step, and an uncategorized capture; restart and verify the same content returns.
2. Show a suggestion only when its underlying active-goal step exists; show a helpful empty state when none exists. Archived goals are excluded where archival is supported.
3. Exercise an input-validation or write failure: show the failure, keep unsaved input, and allow retry without falsely reporting a save.
4. Exercise real-session-present, no-session, and session-source-unavailable states with isolated fixtures. Continue is prominent only when a real session record exists and must never report an unverified resume.
5. With integrations unavailable or disconnected, confirm goals and quick capture remain usable and the screen reports the actual integration state.

## Still to resolve

- Local database location, SQLite binding, backup/restore, migration, and recovery behavior.
- The details of goal/step editing and suggestion ranking, including the limits of any initial non-AI suggestions.
- Session metadata source, persistent identity, and separately verified resume capabilities for AGY and OpenCode. The terminal foundation is not yet connected to the dashboard.
- The exact typed interface, fixture format, file ownership, and desktop packaging decisions needed before parallel implementation.

Future work must still implement and verify the broader [first-release plan](first-release-plan.md), including independent FlowState focus, both installed harnesses, reviewed Obsidian writes, learning, and practice.
