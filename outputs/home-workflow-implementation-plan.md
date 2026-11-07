# TGM Home and work-flow implementation plan

**Status:** Planning, 7 November 2026. This document plans the confirmed design brief; it does not claim the features are implemented or authorize an unattended release. The existing app is a development build. See the [project hub](project-hub.md) and [first-release plan](first-release-plan.md).

## Outcome and scope

Help the user choose a small next step, choose independent work, AGY, or OpenCode, and start with that step visible. Let them capture a thought without classification and later edit, delete, or attach it to a goal or project. Clarify prerequisites and keyboard movement, and give currently available actions the strongest hierarchy. Preserve the current TGM visual identity, explicit unavailability messages, goal-draft protections, and existing terminal safety.

Current baseline: Home saves captures, goals, and steps; Workspace runs one installed harness in a selected folder. Projects, FlowState, and session resume are not connected. The work below includes the small project foundation needed for the chosen capture flow; it does not represent the full project or integration checkpoints as complete.

## Sequence

### 1. Define and protect the data changes

- Add a transactional, versioned SQLite migration to `app/electron/store.cjs`. Recognize the existing unversioned schema deliberately, preserve all captures as uncategorized, make reopening repeatable, and refuse unknown future versions. Verify foreign keys and leave the old database usable if migration fails.
- Add a minimal project record with a stable ID, name, active/archive state, and optional user-selected folder. Provide create, list, rename, archive, and restore so a user can create a project without a folder and later select a real project for an attachment. Preserve archived projects and their history; hide them from new attachment choices by default. Do not build a full project dashboard in this slice.
- Add nullable goal and project references to captures. For this first flow, each capture has at most one attachment: none, one goal, or one project. Existing captures remain unattached. Keep an existing archived attachment visible and identifiable; removing or archiving a target must never silently delete the capture.
- Add an edit/conflict token and validated capture edit, delete, attach, and detach operations. Reuse the existing text validation, perform conditional updates/deletes, and return a recognizable conflict without overwriting newer content. Use an explicit delete confirmation rather than implementing a separate undo system.
- Expose only needed operations through trusted-sender-checked IPC in `app/electron/main.cjs`, `preload.cjs`, and `app/src/global.d.ts`. Validate IDs, allowed targets, ownership, and input in the main process/store as well as presenting helpful UI messages.

### 2. Make capture useful after saving

- Replace the plain capture list in `app/src/App.tsx` with readable rows showing text and any attachment. Provide keyboard-accessible actions to edit, delete, attach, change, and detach. Keep quick capture uncategorized and fast; creating a project is optional, not a prerequisite for saving a note.
- Supply goal/project selection and a small project creation/management entry point. Clearly distinguish no targets, loading, archived targets, and failed saves; avoid a free-text project label masquerading as a real project.
- Preserve a capture edit draft on save failure or conflict and include it in existing unsaved-change protection. On cancel, return focus to the originating action; after deletion, move focus to a sensible surviving control. Handle long text and growing lists without losing access to actions.

### 3. Connect a step to a work choice

- Separate **Start** from **Edit** on each suggested step. Start opens a labelled, keyboard-operable chooser for **independent work**, **Antigravity CLI**, and **OpenCode**; cancel returns to the originating step. Preserve existing editing and conflict handling.
- Store a typed in-memory work intent in `App.tsx`: stable goal/step IDs, a display snapshot, and selected mode. Pass it to Workspace and show the selected goal and step. Navigation must preserve the active intent and Home drafts. This is current-window context, not session history or a promise to resume after restart.
- For independent work, show the chosen step and say that timing and history are unavailable while FlowState is disconnected. Do not create a fake focus session, call a harness, or mark the task complete. Connect real FlowState behavior only in its own integration checkpoint.
- For a harness, preselect the chosen CLI but require the user to choose a working folder and explicitly start the terminal. Do not inject the step into the CLI or submit a prompt automatically. If a terminal is already running, preserve its harness, folder, and task context; offer return, cancellation, or the existing confirmed stop flow before switching. A canceled or failed stop must leave the running session intact.

### 4. Clarify Workspace and improve Home hierarchy

- In `app/src/Workspace.tsx`, explain that the working folder is where the selected CLI runs, show the full selected path, and make the reason for a disabled start action visible. A user with a folderless goal can explicitly choose any suitable existing folder; no project association is required. Never silently choose the home directory, app data, or a repository. Do not create an automatic working directory until its location and file-access policy are decided.
- Preserve the existing absolute-directory, allowed-harness, terminal-size, PATH, start/stop, and process-lifecycle checks. Surface missing or deleted folders, missing harnesses, failed checks, failed starts, and failed stops. Finding a CLI or spawning a terminal does not establish successful sign-in or task completion.
- In Home, emphasize **Add goal** when no next step exists. Reduce the disconnected focus panel to a quiet, truthful status instead of a prominent disabled primary button. Keep the session-history placeholder honest.
- Move focus to newly opened goal and detail forms, restore it to the invoking control on close, and retain unsaved-draft warnings. Maintain labelled controls, visible focus, accessible announcements, responsive reflow, and the existing forest/mint/gold visual system.

## Verification and acceptance

Use isolated test profiles, synthetic records and executables, and disposable working folders. Do not send prompts to real harnesses or touch the user's FlowState data or Obsidian vault for these checks.

1. **Existing data and recovery:** migrate a representative old database, reopen it twice, verify old captures/goals/steps are unchanged, and exercise failed/interrupted migration. Snapshot and restore a migrated database using the existing recovery workflow; verify project records and attachments survive. Reject unsupported newer schema versions.
2. **Capture behavior:** create an uncategorized note; edit and cancel; attach to and detach from real goals and projects; confirm deletion; reopen and verify persistence. Exercise malformed input, unknown targets, archived targets, concurrent edits, storage failure, and retained drafts. Verify newly added IPC handlers reject untrusted senders.
3. **Start behavior:** from a known step, choose each mode and verify the correct goal/step remains visible. Independent mode starts no terminal or timer. Each harness mode selects the correct CLI but does not launch until explicitly requested. Canceling, switching, navigation, and an already-running terminal preserve context and unsaved drafts.
4. **Folder and failure behavior:** select and cancel an existing folder, use a goal without a project, remove a selected folder before start, and exercise missing CLI, failed launch, failed or canceled stop, and actual terminal exit. Report only verified outcomes.
5. **Usability:** test keyboard-only flow, focus movement and restoration, labels and status announcements; inspect empty and populated Home and Workspace in visible Electron at a representative desktop size and narrow window, including 200% zoom. Check long note and goal text and unavailable integration states.
6. Run `npm test` from `app`, including meaningful updates to `store.test.cjs`, `recovery.test.cjs`, `home-ui.test.cjs`, `terminal-ui.test.cjs`, and IPC/host tests as relevant. Review the rendered app against `DESIGN.md`, run the Impeccable detector once on changed UI targets, and record results in the project hub without marking unrelated release checkpoints complete.

## Dependencies and boundaries

- The project foundation is required for actual project attachment; the UI must not advertise it until the backing store and selection work. The proposed minimal project fields and lifecycle are implementation choices for this slice, not a completed project-management system.
- FlowState timing, synchronized history, durable session resume, AI summaries, Obsidian changes, and a packaged release remain separate first-release work. Independent activity here is untimed and nonpersistent across app restart unless later integration establishes otherwise.
- The project hub notes that security and packaging are not established. Existing local access and trusted-sender protections must not be weakened; a full production security or backup strategy is outside this slice.
