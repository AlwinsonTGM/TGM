# Antigravity dashboard feasibility results

Research and isolated tests, 5 November 2026. These tests explore feasibility; they are not an implementation or a production security audit.

## Results

| Question | Result | Evidence and boundaries |
|---|---|---|
| Can the actual AGY interface run in an app-like terminal? | Yes, in a throwaway browser-hosted terminal. | AGY 1.5.1 rendered, accepted typed input, responded with Gemini 3.8 Flash, showed `/mcp`, requested normal interactive approval, and returned a test MCP marker. The browser resized; one duplicate header appeared briefly during redraw and then cleared. Five subsequent actual-AGY PTY resizes measured using xterm-headless showed one header after 200 ms and after 2 seconds; the browser visual test was not repeated. This was not a packaged desktop app. |
| Can AGY call a local custom MCP server? | Yes. | Live AGY sessions discovered and used a workspace-scoped server. Headless execution needed narrowly scoped session permissions; a denied action could still accompany a `SUCCESS` status. |
| Can a session propose a memory update? | Yes. | AGY sent a synthetic summary to the test server. In a separate two-project test, AGY read project data and submitted drafts without immediately changing saved memory. |
| Can approval and project separation be enforced? | Demonstrated in a synthetic prototype. | A separate approval action saved one draft and rejected another. Fresh AGY sessions read the expected persisted results. A minimal browser UI was also used to approve one draft, reject another, and confirm both results persisted on refresh. Fixture checks rejected cross-project arguments, oversized drafts, and stale approvals. These checks are not a production security audit or the eventual dashboard UI. |
| Can a session hook identify the conversation and transcript? | Yes, on the tested installation. | Workspace `SessionStart` and `PreInvocation` hooks returned a conversation ID and transcript path. The initial relative script path failed because hook execution used a different working directory; an absolute path worked. No transcript content was read. |
| Can related but differently worded memories always be detected? | Not established. | Exact duplicate checks miss paraphrases. AI suggestions and user review can help, but do not guarantee correct merging. |
| May the proposed app embed AGY under a consumer plan? | Not resolved. | Google's [ACP documentation](https://antigravity.google/docs/cli/acp/) describes supported editor integrations; its [FAQ](https://antigravity.google/docs/faq/) restricts wrapping AGY in third-party applications. Neither settles this specific dashboard. A technical test cannot establish permission. |

## Repeatability

The memory fixture verifier was corrected to use its own resettable data after a later live check changed its original assumptions. It subsequently passed repeatedly. The embedded terminal test used a temporary local helper, which was stopped after testing. Synthetic conversations may remain in AGY's own history.

## Important limits

These are focused feasibility tests on one Windows machine, not evidence that all future bugs are eliminated. The finished app would still need tests for its own approval UI, authentication and local process boundaries, crash and concurrent-write handling, backups, accessibility, terminal keyboard and clipboard behavior, long sessions after context compaction, and its actual data/privacy settings. A brief terminal redraw artifact was observed during resize. Earlier tests also found AGY had changed from version 1.4.12 to 1.5.1; the cause was not established, and trust for an isolated test workspace may have been saved by AGY.
