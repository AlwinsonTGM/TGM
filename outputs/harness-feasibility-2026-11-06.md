# Harness feasibility — 6 November 2026

The first release is intended to support both installed AGY and OpenCode, with a harness selected per session. These are narrow local checks, not production integration tests.

## OpenCode

- Installed CLI: OpenCode 2.2.5 on Windows. Its help advertises interactive use, session selection, MCP, and a v2 API server.
- `opencode api --standalone GET /api/info` returned server information and version 2.2.5.
- With XDG, APPDATA, and LOCALAPPDATA paths redirected to `work/harness-probe/opencode-isolated`, a standalone `POST /api/session` created an empty session and a separate standalone `GET /api/session/{id}` retrieved it. Both reported zero model tokens and cost. No model prompt, interactive terminal, MCP tool, or actual conversation resume was tested.
- The [v2 API reference](https://dev.opencode.ai/v2/docs/api) describes sessions, models, permissions, and MCP, while marking its HTTP API surface experimental. The [v2 migration guide](https://dev.opencode.ai/v2/docs/migrate-v1/) describes the v2 client and server authentication. Verify compatibility against installed versions and secure the local process before integrating it.

## AGY

- Installed CLI: AGY 1.5.2. Help advertises conversation continuation and session selection.
- In isolated temporary data paths, `agy acp --stdio --disable-telemetry` successfully answered an ACP initialization request and advertised session load, resume, and list. No session was created or resumed, and no model or tool was called in this check.
- Earlier [integration tests](end-to-end-prototype-results.md) exercised a real conversation and MCP on an earlier installation; they do not prove the new desktop integration or current-version session resume.

## Remaining checks

Test interactive terminal startup and actual conversation resume for both harnesses, per-harness MCP and approval behavior, model and provider configuration, process lifecycle, and safe local API authentication in a disposable project. Account availability, model costs, and any applicable terms need checking before billed requests or production integration. Do not assume transcripts, credentials, or capabilities transfer between harnesses.

## Live conversation and MCP checks

On 6 November, small synthetic requests were run using the installed CLIs in separate test workspaces:

- **AGY 1.5.2:** The standalone CLI, using `gemini-3.8-flash-low`, created a conversation and recalled a synthetic marker after resuming it by ID. A later turn invoked a project-scoped read-only MCP tool; its independent log confirmed the call. The final response reported cumulative usage of 60,003 input and 51 output tokens; monetary cost was not available. A synthetic session remains in AGY history. See `work/harness-probe/agy-live`.
- **OpenCode 2.2.5:** The CLI, using `opencode/big-pickle`, created and resumed a synthetic conversation and recalled its marker. It also invoked a project-configured read-only MCP marker tool through Code Mode, confirmed by the tool's independent log. The reported cost was $0. During setup, standalone MCP listing showed no server even though a subsequent model run discovered and called it; the cause remains unresolved. See `work/harness-probe/opencode-live`.
- These checks did not establish approval enforcement, packaged Electron integration, an embedded interactive terminal, or production-ready security. The OpenCode CLI calls were headless; AGY was run via direct CLI scripting.

Google's [Antigravity FAQ](https://antigravity.google/docs/faq/) says direct CLI headless scripting is intended, while wrapping AGY inside third-party applications is unsupported on consumer plans. It does not specifically establish whether a general embedded terminal in TGM is permitted; confirm the intended integration path before committing to it.

## Interactive embedded-terminal checks

On 6 November, both installed CLIs were tested as ordinary interactive terminal programs inside hidden, disposable Electron 44.10.2 prototypes using xterm.js and node-pty. In each, the CLI interface rendered and unsent keyboard input appeared in its prompt. Neither test submitted a model request.

- **AGY 1.5.2:** Passed after accepting the trust prompt for the disposable `work/harness-probe/agy-live` workspace; that trust choice may persist in AGY settings. Both test process IDs exited. Evidence: `work/harness-probe/agy-terminal/result.json`.
- **OpenCode 2.2.5:** Passed. The PTY and OpenCode child exited, but the Electron main and renderer remained after `app.exit` and required manual termination. Data paths were redirected, but a model selection still appeared, so complete configuration isolation was not established. Evidence: `work/harness-probe/opencode-terminal/result.json`.

These prototypes were hidden and unpackaged; resize, clipboard, permission flows, real model interaction in the embedded terminal, and release security remain untested. Google's [changelog](https://antigravity.google/changelog?version=2.12.2) explicitly mentions AGY in the VS Code integrated terminal, and its [ACP documentation](https://antigravity.google/docs/ide/extensions/acp) describes editor integrations and other ACP clients. Those examples support investigating a normal terminal or ACP client; they do not explicitly resolve the FAQ's application-wrapping language for TGM.

## Terminal foundation follow-up

The standalone `work/tgm-terminal` development app runs either CLI in a chosen folder. A Windows test verified input, actual resized dimensions, restart, and termination of a synthetic child and grandchild while leaving an unrelated process running. Detached or reparented processes remain untested. The app asks before stopping a running terminal.

An automated clipboard test exercised xterm selection, keyboard shortcuts, and the Electron bridge with an in-memory clipboard; a manual check pasted the Windows clipboard into the live OpenCode prompt. Mouse selection and copying through the real Windows clipboard were not verified end-to-end. When terminal applications capture mouse input, xterm supports Shift-drag selection.

OpenCode displayed a permission prompt through the terminal transport; rejecting a synthetic write via keyboard left the target file absent. AGY also displayed a command permission prompt, but the session was stopped before testing rejection. These used a headless xterm buffer and actual terminal process, not the visible app window. OpenCode used free Big Pickle; AGY used Flash Low and its monetary cost was unavailable. A synthetic AGY plan artifact was created in the disposable test workspace.

An unpacked Windows x64 development build was created. Its bundled native PTY passed a shell smoke test, and its visible window launched and stopped both OpenCode and AGY. This is not an installer, signed release, or production security review.

## Follow-up verification

- A Windows clipboard test selected xterm text, copied it through the actual Electron bridge, and pasted it back to the terminal input. It saved and restored the previous clipboard contents. Selection was set programmatically, so mouse selection under a harness's mouse capture was not verified.
- OpenCode's real permission prompt and keyboard rejection passed in an isolated copy of the packaged application with a hidden window; the synthetic write did not occur. AGY's permission rejection also passed with the packaged terminal module and headless xterm, but not the complete packaged window. Both used disposable projects; AGY model cost was unavailable.
- A controlled detached child survived after its launcher exited and the terminal was stopped. The test cleaned up its known PID. Ordinary process-tree cleanup does not guarantee termination of detached or reparented processes. The UI now states this limit; reliable containment would require a separately tested mechanism.
