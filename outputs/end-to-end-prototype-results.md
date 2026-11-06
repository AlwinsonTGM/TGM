# End-to-end prototype results — 6 November 2026

These checks use real applications with synthetic data and disposable prototypes. They test feasibility, not the finished dashboard.

## AGY → MCP → FlowState

A disposable copy of FlowState was rebuilt with an in-process test bridge. Its database and app storage were redirected to the test workspace; the user's normal database and installation were not modified. Classifier startup was disabled and telemetry was synthetic in the copy.

1. In the real interactive AGY CLI, Gemini 3.8 Flash Low invoked the custom `/focus` skill, which called the test MCP tool. It started a synthetic task in the rebuilt FlowState app. The running timer was also visible in FlowState's floating pill.
2. AGY's `/stop` skill called the test MCP tool. The FlowState copy saved a 25-second session and left its task `pending`, with no completion timestamp. The result was independently verified in the isolated SQLite database.
3. A second `/stop` reported no active session and did not add another session. A duplicate start while another test task was active was also rejected.
4. A second test session was stopped and the copied app restarted. Both sessions and both pending tasks remained in the database; the prototype's status endpoint returned the latest session.

The original FlowState executable has no such bridge or stop-without-completing action. These results use modified prototype code, not a production implementation. The loopback bridge has no authentication and is **not suitable for production**. Simultaneous commands, process failure during a write, release packaging, complete offline behavior and a real dashboard integration have not been validated.

## AGY → reviewer proposal → approval → Obsidian

- In a real two-turn synthetic study conversation, AGY generated an HTTP status-code reviewer and a practice question.
- In one test, a disposable browser approval prototype displayed the generated reviewer. Rejecting it left the synthetic vault unchanged. An external edit blocked stale approval; a fresh preview and approval preserved the edit and saved the reviewer and index link. The real Obsidian app, using an isolated profile and test vault, opened that reviewer via the link and displayed the study content. This run passed AGY output to the prototype through a test file.
- In a subsequent test, AGY in the resumed study conversation directly called the custom `reviewer_probe/propose_reviewer` MCP tool. The tool created a pending draft. The prototype showed the same draft, and the reviewer and link were absent from the vault before approval. Calling the prototype's approval endpoint saved the exact proposed text and linked it from the subject note, preserving its existing frontmatter. Browser accessibility timed out during this second run, so this specific approval was made through the endpoint, not the browser; the browser and Obsidian checks were the earlier separate run.
- The approval interface and save process are prototypes. They do not yet provide production access control, atomic multi-file writes, recovery from interruption, or protection against an edit during the final write. The finished dashboard, embedded interactive AGY study session, and the user's existing vault have not been tested as a single end-to-end flow.

## Test footprint

The test processes and local listeners were stopped. Synthetic AGY sessions and trust for a test workspace may remain in AGY history/settings. Obsidian used a separate test profile and vault. The copied FlowState build cache under `work/flowstate-bridge-proof` occupies approximately 3.7 GiB and is retained with the proof for repeatability; it is separate from the original project's build cache.

These results support planning a first release using the real AGY interface, a project-scoped MCP server, FlowState, and Obsidian. The production integration still needs authenticated local communication, clear success and failure reporting, safe file writes and recovery, and testing against the real app's supported integration after implementation.
