# Personal dashboard: first slice

Status: planning draft, 5 November 2026. No app or integration has been built yet.

## Purpose

Make it easier to resume meaningful work by letting you save a small, reviewed project memory from an Antigravity session. The immediate test is whether that memory helps you return to the project. The wider dashboard will eventually help you choose between a few sensible options.

## What you have chosen

- Show a few options and help you choose; do not decide for you.
- Support both projects linked to a real folder and personal projects without one.
- Use the official Antigravity harness, existing compatible skills and plugins, and a dedicated MCP server for this dashboard.
- Keep memory specific to a project. Save session information only when you choose; show proposed changes for review before saving.
- Limit memory growth. Design the interface carefully, after agreeing on the system's behavior.

## The first end-to-end experience

1. Create one project in the dashboard. Give it a name and optionally associate a folder; personal projects need no existing folder.
2. Use an Antigravity session in the official CLI. The user identifies the project to the dashboard MCP. Read only the memory of that selected project, with the configured permissions.
3. During or at the end of the session, ask Antigravity to propose saving important information. The agent uses the session context it actually has; the MCP does not presume it can retrieve a complete transcript.
4. The agent reads relevant existing project memory and sends the dashboard a proposed update: concise progress, decisions or learning, unresolved questions, and a next step when applicable. It explains whether it proposes adding, updating or leaving an existing entry alone. It must not silently erase other information.
5. The dashboard shows the proposed change alongside the existing text. Approve, edit or discard it. Nothing becomes durable project memory before approval in the dashboard.
6. On the next visit, open the project and see its approved memory and suggested next step. The user can edit or remove saved memory.

For the first test, initiation is inside the CLI session. A dashboard-side "Add session to memory" button remains an open design question: it requires a supported way to identify and obtain the relevant session content. Until then the user can initiate the proposal in the session and review it in the dashboard.

## Memory boundaries

- Store a concise, editable Markdown project memory with identifiable entries and links to supporting material when available. Keep session history separate; do not assume the dashboard can access the CLI's complete history.
- Give each project a visible configurable memory budget. Initial proposal: 2,000 words of approved project memory, subject to your preference and testing. This budget excludes session transcripts and applies to resulting saved memory, not just a single proposal.
- When an update would exceed the limit, do not silently save, delete, or compress. Explain the limit and let the user edit the proposal or approve a separate consolidation proposal. Keep a recoverable previous version of edited memory.
- Duplicate detection is best effort: propose matches and show what would change. Similar facts may be distinct; uncertainty must not cause deletion.
- Treat project context as sensitive. Only the selected project's memory is exposed by this MCP, and the dashboard checks the project on every operation. Workspace configuration alone is not a security boundary; other enabled tools or CLI context may have independent access.

## Integration and operating boundaries

- First test: a custom local MCP server called by the official Antigravity CLI. The dashboard does not launch, embed, or wrap `agy`. Google documents custom MCP servers and workspace configuration: https://antigravity.google/docs/mcp/.
- Google says wrapping `agy` in third-party applications is not supported under consumer plans: https://antigravity.google/docs/faq/. Whether a specific embedded terminal is permitted needs Google clarification; an MCP connection does not settle that question.
- A project-scoped MCP can expose only a small set of operations: read selected project context, create a pending memory proposal, and check its review status if needed. Applying an update belongs to the dashboard's explicit review action, not an MCP tool that the model can call directly.
- Confirm project selection explicitly, validate every MCP request, and reject a project mismatch. The dashboard approval must identify the project and exact proposed changes. Detect edits made since the proposal was drafted and ask for a fresh review rather than overwriting them.
- The agent sees data returned to it and sends its prompt/context to its model provider. Make shared context visible; do not assume local files mean AI processing is local. Check the installed CLI's actual permissions and settings.
- Account quota, costs, authentication, available session context, concurrent access and Windows compatibility need a bounded live test. Do not promise that a separate Gemini API uses the same subscription quota.

## What counts as success

- A folder-linked project and a personal project can be represented without requiring a pre-existing folder for the latter.
- A real session can create a pending proposal for the chosen project, using the CLI's actual available context.
- The review shows before/after content and lets the user approve, edit or discard it. Discarding makes no change to approved memory.
- Only the selected project's approved memory is returned through the app's MCP; a mismatched request is rejected.
- A proposed update over the configured limit is blocked without losing existing content. A stale proposal cannot overwrite a newer edit.
- A later session can retrieve the approved memory and offer a useful continuation; the user judges whether it actually helps.
- If Antigravity is unavailable, existing dashboard memory remains readable and editable.

## Before implementation

1. Confirm the user experience and memory budget. Decide where the dashboard runs and how projects are chosen; do not assume a separate custom chat UI.
2. Run a small, explicitly scoped integration proof on Windows: register a minimal local MCP in the official CLI, read a sample project and submit a sample proposal. Verify session-context handoff and permissions; no personal information is needed for the test.
3. Design the review and project-navigation interface using relevant design skills. Review the design with you before implementation.
4. Specify storage, backup, and recovery based on the chosen app form. Build the smallest usable slice and test the approval, budget, project isolation, and stale-update cases.

## Later, not part of this first slice

The full option-selection dashboard, automatic FlowState integration, multi-device sync, multiple clients, billing, automatic reviews, and a custom harness are not designed or implemented here. The 72-item backlog remains a reference, not an automatically imported task list.
