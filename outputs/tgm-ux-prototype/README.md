# TGM — Codex UX concept

Open `index.html` in a browser. This disposable concept demonstrates the chosen Codex TGM visual direction: a compact Home, independent FlowState focus, per-session harness selection (`AGY CLI` and `OpenCode`), workspace terminal with simulated CLI-unavailable diagnostics, quick capture, and explicit review before saving. Everything is synthetic and resets on refresh; there are no writes to AGY, OpenCode, FlowState, Obsidian, or user data.

Try choosing a suggested step (with its default harness or an explicit `AGY CLI` / `OpenCode` override), reopening a sidebar session to verify its bound harness is retained, toggling **Simulate CLI unavailable** in the terminal header while using FlowState focus and Quick Capture, and opening a memory or reviewer proposal.

This preview keeps one in-memory sample session per task and harness. Switching to another harness opens its separate sample session; switching back restores its transcript and unfinished input. The preview does not model multiple sessions for the same task and harness.

Run `node outputs/tgm-ux-prototype/session-model.test.cjs` and `node outputs/tgm-ux-prototype/session-ui.test.cjs` from the repository root to check session behavior. The UI test uses a lightweight DOM fixture, not a real browser.
