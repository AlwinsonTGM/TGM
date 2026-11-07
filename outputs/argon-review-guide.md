# Argon Review Guide for Codex

Quick map of the two branches so you can take the backend/logic/tests directly and inspect or discard frontend edits without reading every line.

---

## 1. `argon/tgm-home-slice-review` (`8ea2449..0156cc6`)

Base: `codex/tgm-home-slice` (`8ea2449`, untouched).

### A. Pure Backend, State Logic, Recovery CLI & Tests (No UI styling)

Safe to take directly without affecting your frontend craft:

- `app/electron/main.cjs` — Rejects lone UTF-16 surrogates (`!isWellFormed()`) and NUL bytes in `validateCaptureText`; bumps default window size `960x680` -> `1120x760`.
- `app/electron/goals.cjs` — Defaults `stepId = null, stepText = ''` in `saveDetails(...)` so omitted optional args don't throw.
- `app/src/useSession.ts` — Epoch-safe async session hook from `codex/tgm-home-sessions` (`e9681e8`, unchanged).
- `app/scripts/recover-database.cjs` — Node 24 offline SQLite `snapshot` / `restore` CLI (`PRAGMA quick_check` before/after `backup()`, blocks overwrite and `-wal`/`-shm`/`-journal` sidecars).
- `app/tests/session-fixture.html`, `app/tests/session-fixture.tsx`, `app/tests/session.test.cjs` — From `codex/tgm-home-sessions` (`e9681e8`, unchanged).
- `app/tests/recovery.test.cjs` — 5 tests covering round-trip snapshot/restore on the real `captures`/`goals`/`steps` schema, collision guard, corrupt DB, missing source, and bad CLI args.
- `app/tests/goals.test.cjs` — Added tests for `loadError` + retry, step-less goal surviving restart without creating a suggestion, and detail-form SQLite lock/retry.
- `app/tests/home-integrated.test.cjs` — End-to-end Home persistence + snapshot/restore relaunch + keyboard focus, `prefers-reduced-motion`, and viewport overflow checks.

**One-liner to pull only logic/backend/tests onto `codex/tgm-home-slice`:**
```powershell
git checkout codex/tgm-home-slice
git checkout argon/tgm-home-slice-review -- app/electron/main.cjs app/electron/goals.cjs app/src/useSession.ts app/scripts/recover-database.cjs app/tests/
```

### B. Frontend & CSS Files Touched (Review or replace with your own UI)

1. `app/src/main.tsx` + `app/src/App.tsx` — Extracted `App` out of `main.tsx` so it accepts `{ sessionProvider?: SessionProvider }`, and mounted `<SessionStatus />` above `<Goals />` in `.main-column`. Fixed 1-word orphan (`available\u00A0locally.`) in `.focus-panel`.
2. `app/src/Goals.tsx` — Formatted single-line JSX; fixed empty-step (`""`) bypassing detail-form validation; removed blocking `window.confirm` on `Close details` / `Open`; disabled `Save goal` and hid `detail` form while `loadError` is true; wrapped inputs in `.goal-fields` for 2-column desktop layout.
3. `app/src/SessionStatus.tsx` + `app/src/session-status.css` — Merged from `codex/tgm-home-sessions` (`e9681e8`), plus `.session-status-compact` inline header when `unavailable`/`absent` and a `.session-status-badge` pill for harness identity (`AGY` / `OpenCode`) when `available`.
4. `app/src/styles.css` — Same hex palette (`#071a15`, `#081712`, `#d9bf80`, `#61d8b8`) moved into `:root` `--color-*` variables; added `.goal-fields` 2-column grid and tighter vertical spacing to fix the `960x680` fold cutoff; made `.focus-panel h2` a `20px` serif heading instead of a `13px` eyebrow; added themed scrollbars and `text-wrap: balance` / `pretty`.

### C. Docs Touched
- `app/README.md` — Added `recover-database.cjs` usage.
- `outputs/project-hub.md` — Recorded `#1`–`#5` verification status (`21/21` `npm test` passing).

---

## 2. `codex/design-prototype-backup` (`0c1448d`, vs `main` `6dae949`)

Contains **zero `app/` production code**. Preserves the earlier disposable multi-harness HTML/JS prototype (`2026-11-07 06:30`):

- **Logic worth referencing later (P5 multi-harness work):**
  - `outputs/tgm-ux-prototype/prototype.js` — In-memory per-task/per-harness (`AGY CLI` vs `OpenCode`) session binding, simulated CLI-unavailable diagnostics, and proposal review state transitions.
  - `outputs/tgm-ux-prototype/session-model.test.cjs` & `session-ui.test.cjs` — Behavioral assertions for bound-harness retention and session switching.
- **Prototype UI / design artifacts (do not merge blindly over `main`):**
  - `DESIGN.md` & `.impeccable/design.json` — Expanded Loki/TGM token dump from the prototype (differs from the trimmed `DESIGN.md` on `codex/tgm-home-slice`).
  - `outputs/tgm-ux-prototype/index.html`, `styles.css`, `README.md` — Synthetic workspace/terminal/modal preview markup and styles (`+1,306` CSS lines).
