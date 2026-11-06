# Dashboard integration checks — 6 November 2026

These are feasibility checks for planning, using disposable projects and data. They are not the finished dashboard or a production security review.

## AGY: real CLI, session continuity, and commands

- A previous browser-hosted terminal test ran the actual AGY 1.5.1 interface, accepted input, displayed `/mcp`, obtained normal tool approval, and returned a custom MCP marker. Project-scoped memory drafts and separate approval were also demonstrated with synthetic data. See [earlier AGY results](antigravity-feasibility-results.md).
- A new test created a synthetic conversation with Gemini 3.8 Flash Low, exited, and resumed the same conversation ID in a new AGY process. AGY recalled a codeword from that conversation. This used print mode, not the embedded terminal's session picker; crash recovery is not proved.
- In the actual interactive CLI, `/focus` was initially unknown. A custom MCP server alone did not register the command.
- A synthetic workspace skill made `/focus` appear in the CLI. Submitting it in a successful interactive run caused Gemini 3.8 Flash Low to call the read-only `isolated_test/get_test_marker` MCP tool and display its marker. A direct natural-language request also called that tool. An earlier plan-mode attempt asked for an unrelated PowerShell search instead of calling the tool; that search was not approved. Tool selection and execution are therefore not deterministic guarantees. `--mode auto` was unavailable for this account, so AGY fell back to default mode in the successful test.
- These tests did not connect to FlowState or prove `/stop`, guaranteed action execution, packaged-app behavior, security isolation, interrupted sessions, or the eventual project/session UI. The previously observed brief terminal redraw artifact remains to be retested in a browser.
- Test processes were stopped. Synthetic sessions and a plan artifact may remain in AGY history, and AGY may have saved trust for the synthetic workspace. The test files remain under `work/`.
- [Google's FAQ](https://antigravity.google/docs/faq/) says headless mode is for direct scripts and CI and says wrapping `agy` in third-party coding agents or applications is unsupported for consumer plans. Google's [ACP documentation](https://antigravity.google/docs/cli/acp/) also describes editor integrations. Whether a dashboard hosting the ordinary interactive terminal is covered by the restriction remains unclear; passing technical tests does not resolve eligibility.

## FlowState: actual timer behavior

The existing Windows executable was copied and run with local app data redirected to a disposable test location; the real FlowState database was not used.

- A test task started. During five seconds of pause the stored elapsed time remained 13 seconds; after resuming it advanced from 18 to 23 seconds over five seconds.
- A forced restart restored the active task and its timer continued, advancing from 39 to 44 seconds.
- The existing **Complete Task** control saved a session of 61 seconds and marked its task complete; the saved session and completion persisted across another restart.
- There is no separate stop-and-save-while-leaving-the-task-open control in the tested UI; source inspection indicates the existing finish path completes the task. The desired stop behavior therefore requires FlowState development.
- No dashboard-to-FlowState bridge was tested or is yet available. Restart while paused, interruption during a write, duplicate prevention, and synchronization of sessions created directly in FlowState remain open.

## Obsidian: reviewer and approval prototype

Tests used a synthetic vault and a separate Obsidian profile, not the user's existing vault.

- A small local prototype left files unchanged for pending or rejected drafts, and blocked writes after a simulated external edit or a new-file collision. A newly reviewed and approved draft saved a reviewer and added a wikilink while preserving existing subject-note content and frontmatter.
- The installed Obsidian 1.15.0 opened the synthetic vault. Following the subject note's wikilink opened the reviewer, including its callout and reverse link.
- The prototype is not production protection: sequential multi-file writes have an interruption and check-to-write race. Recovery, conflicts, backups, and behavior in the existing vault need a deliberate implementation and further tests. The test vault gained its own settings, and Windows launch or folder-picker recent history may have changed; the normal Obsidian profile and existing vault were not intentionally modified.

## Planning implications

1. The real AGY CLI, a workspace skill, and a custom MCP server have worked together in one interactive test. The command must still be designed for uncertain model/tool behavior, explicit permission, and visible success or failure; it must not claim focus started merely because `/focus` was submitted.
2. FlowState needs an explicit stop-without-completing operation and a designed integration boundary, with authoritative session IDs and time, restart recovery, and duplicate handling.
3. Obsidian reviewer saving needs a reviewed proposal and conflict/recovery design before writing the user's vault. The actual AGY-to-reviewer-to-vault chain has not been demonstrated end to end.
4. The first usable release and its risks can now be specified, but the actual integrated system must still be tested as it is built; these probes cannot prove an unbuilt application bug-free.
