# Personal dashboard: decisions and open checks

Living notes from our planning conversation, updated 6 November 2026. These are product decisions, not a finished technical specification.

## Purpose and starting a session

- Windows and PC first: the user does productive work on the computer and does not need phone access in the initial version.
- Start on a dashboard with suggested next steps and a Continue last session option; projects and AGY sessions should be one click away.
- Help the user start work when overwhelmed: offer a few manageable actions across active goals, with a reason for each. The user can choose, edit, dismiss, or request other options.
- An optional quick choice of available time and energy can help tailor suggestions; it can be skipped.
- The user selects a few active goals from the backlog or creates new ones. The rest stays available without importing all 72 items as active tasks.
- For cross-goal suggestions, AGY may consider the memories of all active projects. Archived projects are excluded from those suggestions; archiving preserves their records and should be reversible.
- An easy-to-reach quick capture box saves an idea, concern, note, or task without requiring categorization. An item can remain a note or later be linked to a goal or project.

## Goals, learning and practice

- Set goals, track progress and time spent, and optionally describe what completion looks like. Time spent and outcome progress are distinct.
- Goals can be archived independently of projects, preserving their history while excluding them from active goal suggestions; archiving a goal does not automatically archive its project.
- Goals can have an optional checklist of milestones or steps. AGY can suggest items, and the user can edit or mark them complete; progress notes remain available for goals that do not fit a checklist.
- AGY proposes progress updates after sessions; the user reviews and approves or edits them before they change the goal.
- An approved learning history records studied topics, completed work, and independent practice without claiming mastery. The user can start practice based on prior learning: multiple choice, interview, or hands-on exercises.
- Practice feedback can be given after each answer or at the end; default is after each answer.
- All three practice formats should be available through AGY sessions in the first usable release, without requiring a dedicated quiz interface initially. After practice, AGY proposes a learning-history update covering what was practiced, progress, struggles, and possible recurring patterns. The user reviews and may edit or reject the update; distinguish tentative observations from verified mastery and link observations to sessions when possible.

## Projects, AGY and memory

- Support projects linked to actual folders and projects without an existing folder, such as college or personal goals.
- User envisions the real AGY CLI interface in an app-hosted terminal, with a dashboard beside it, communicating through a dedicated MCP server. Existing AGY skills and plugins should remain usable where compatible.
- Project memory is scoped to a project, limited in size, and updated only when the user chooses to save important session details and approves the proposed changes. AGY may read memories across active projects when creating dashboard suggestions, as explicitly requested; archived projects are excluded. AI may suggest merging related notes; it cannot guarantee perfect deduplication.
- Feasibility checks and limitations are recorded in [Antigravity feasibility results](antigravity-feasibility-results.md). Google's policy for the exact proposed custom harness remains unconfirmed.

### Knowledge storage: exploration, not decided

- Clarification from user: Obsidian is primarily a reading and reviewer library. The user typically reads AI-written material rather than writing notes manually, and wants to review what they have studied and practiced. Existing vault: `C:/Users/PC/Documents/Obsidian`.
- Read-only inspection found an existing reviewer hierarchy under `BSIS JOURNEY`, including links from year to semester/exam to subject and modules. Sampled reviewers use structured headings, callouts, highlighted terms and tables. The review was limited; do not assume every note shares a format, change existing files, or index the entire vault without an explicit choice.
- Agreed reviewer workflow: an AGY study session is the main source, with the option to combine other selected study material. The user selects an existing subject or project, and AGY prepares a reviewer and proposes a destination and any links within the existing vault structure. The user previews/approves before saving or modifying vault files. Reviewers, project memory and practice history serve different purposes; do not treat an AI-written reviewer as proof of mastery. Exact folder/link handling and existing-vault compatibility need verification.
- User suggested using Gemini Notebook (formerly NotebookLM). As of 6 November 2026, Google's [personal Gemini Notebook API](https://developers.google.com/notebook/docs) and [MCP server](https://developers.google.com/notebook/docs/mcp) are in public preview. They support managing notebooks and adding plain text/Markdown, public URLs, and supported YouTube sources, but [the roadmap](https://developers.google.com/notebook/docs/roadmap) lists retrieving notebook information and generating artifacts as future capabilities. Direct binary uploads and API deletion are also on that roadmap. AGY could prepare selected session text for a notebook while still drafting a reviewer separately; this is a candidate workflow, not an implemented or authenticated integration.
- Decision: keep Gemini Notebook integration for later, monitor relevant official announcements/API changes, and use AGY study sessions to draft reviewers for the user's review and Obsidian in the meantime. Combining additional selected sources remains desirable.
- The [API is free during preview](https://developers.google.com/notebook/docs/rate-limits), with limits based on account tier; it requires OAuth and a Google Cloud project, as documented in [authentication](https://developers.google.com/notebook/docs/authentication). Do not assume it shares Antigravity quota. Explicitly choose what session data is sent to Google; account access, live compatibility, billing beyond preview and deletion workflow remain unverified.
- Obsidian can open an ordinary existing local folder as a vault. Candidate: a user-readable central folder for project notes, linked to actual code folders without placing personal notes inside Git repositories by default. Also consider a folder inside each project or the user's existing Obsidian vault; the user has not chosen.
- Separate full conversations, optional approved session summaries, curated project memory used by AI, and learning/practice history. Link them to sources; do not assume an AI session survives compaction intact or that studied means mastered.
- Candidate: cap the small curated context sent to the AI, while retaining original notes and history; clarify what counts toward the cap and let the user review consolidation. Do not silently delete or merge notes to make room.
- Treat Markdown as the authoritative source for user-readable notes and use a rebuildable search index; structured records may separately hold goals, timers and pending approvals. Backup and restore must cover both, not only Markdown.
- Before saving approved edits, detect whether the target note changed externally; show the conflict and require a fresh review rather than overwrite. Preserve unknown content/properties and maintain recoverable history.
- The user permits cross-project suggestions using active project memories; excluded archived projects should remain excluded by default. Show which selected material is sent to the AI and distinguish local file storage from cloud processing. Plain local files are not automatically encrypted.
- Existing Obsidian vaults, note-link behavior, concurrent edits, backups, data migration, and compatibility with real user vaults require explicit testing before use. Standard Markdown links offer interoperability and Obsidian supports both Markdown links and wikilinks.

## Focus workflow: agreed direction

Focus sessions must also work without AGY, including reading or independent practice. The user can track time without AI and add a short note afterward; any AI-generated summary is optional and requires the AI to be available. Sessions can be paused and resumed, with paused time excluded from recorded work time. Sessions started directly in FlowState should also appear in the dashboard afterward. Offline behavior and how session data syncs between applications still need verification.

Stopping a focus session saves its time and session log but leaves an unfinished task open. Completing the task is a separate user choice; stopping for the day must not automatically imply the work is complete.

1. The user can explicitly start focus using `/focus` or clearly request it in natural language, with a task and optional goal/project association.
2. Start or open FlowState and link the focus session to the relevant context when feasible.
3. The user can stop using `/stop` or an equally clear natural-language request. Ambiguous wording should lead to a clarification before starting or stopping.
4. On stop, AGY proposes a short log covering the intention, work done, learning, and possible next step, using the available session context and the actual duration recorded by FlowState.
5. The user reviews any proposed changes before they update learning history, goal progress, or project memory. Show uncertainty where work cannot be inferred; do not invent details.

## Verification required before committing to the integration

- Follow-up: [end-to-end prototype results](end-to-end-prototype-results.md) document AGY `/focus` and `/stop` operating a rebuilt, isolated FlowState copy, and AGY submitting an Obsidian reviewer proposal via MCP. Both use prototypes; the production integration remains to be implemented and verified.
- 6 November update: [integration validation results](integration-validation-2026-11-06.md) record actual AGY resume and `/focus`-skill-to-MCP tests, disposable FlowState runtime checks, and an Obsidian reviewer prototype opened in the real app. These are limited proofs, not an integrated first release.
- Determine how AGY registers and executes `/focus` and `/stop`; do not assume MCP tools automatically create slash commands or that those names are available.
- Inspect and test how FlowState can be opened, start and stop a session, associate a task, and return authoritative duration and session identity. Verify whether it exposes a supported API, command, deep link, or other integration; do not directly write its database without a deliberate design.
- Source inspection found FlowState has internal start, pause, complete and session-note commands, but no documented external control API. Its current completion path appears to mark the task completed when ending a focus session; verify live and decide how to stop a session while leaving unfinished work open. Test with a disposable database or app instance before changing real data.
- Test what happens if FlowState is closed, unavailable, already running a session, or if either application restarts. Define how duplicate starts and stops are prevented.
- Determine how sessions started directly in FlowState are detected and displayed in the dashboard, including completed sessions and missed events after either app was closed. Determine how session logs appear in both applications, which system owns each record, and whether a reliable connection is feasible without duplicates.
- Verify what session context AGY can access, what information is sent to the model, and how user approval and project boundaries are enforced by the app. Handle missing, compacted, or ambiguous context without fabricating a log.
- Test the exact proposed embedded AGY interface and MCP integration, including Google account terms for that arrangement, before assuming consumer-plan eligibility.

## First usable release: agreed integration boundary

The first usable release must include working FlowState and Obsidian integrations. FlowState is the user's own unfinished project and its necessary development is in scope; it should gain a clear purpose in the dashboard workflow. Obsidian reviewer creation and saving into the chosen existing vault structure is also required from day one, with preview and approval before vault writes.

Aim for one useful cycle: choose an active goal, get a small suggested step, start or continue an AGY study session, use FlowState to focus and record time, review a proposed progress or memory update, and generate and approve a reviewer for Obsidian. Include quick capture, a way to return to a previous session, and all three agreed practice formats through AGY. Resolve the highest-risk integrations and define offline and failure behavior before committing the release plan.
