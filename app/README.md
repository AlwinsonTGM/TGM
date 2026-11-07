# TGM Home

This desktop slice implements the first TGM Home experience backed by local SQLite storage:

- **Honest session and integration availability:** Shows `Continue where you left off` prominently when a controlled session provider supplies a session (retaining original `AGY` or `OpenCode` harness identity and confirming actual resume results), while reporting session continuation, FlowState, AGY, OpenCode, and Obsidian as not connected in the default local build.
- **Goals and suggested next steps:** Create goals with an optional first step, see suggested next steps derived from active goals, and review or edit goal and step details without mutating saved records until explicitly saved.
- **Uncategorized quick capture:** Save thoughts without forced categorization and preserve unsaved input across validation or storage failures.
- **Database snapshot and restore CLI:** Back up and restore the SQLite database with `PRAGMA quick_check` verification and sidecar collision checks.

## Usage

From this directory, with Node.js 24 installed:

```powershell
npm ci
npm start
```

`npm start` builds the renderer and launches Electron. SQLite data is stored in Electron's per-user application data directory (`captures.sqlite`), independently of the source checkout. The installed application is not yet packaged.

## Database backup and recovery

With the application closed, create a verified snapshot or restore a snapshot to a new destination path in a new private directory. Keep other applications and processes from writing to that directory during the operation:

```powershell
node scripts/recover-database.cjs snapshot <absolute-source-db> <absolute-snapshot-dest>
node scripts/recover-database.cjs restore <absolute-snapshot-src> <absolute-restored-dest>
```

Both commands verify `PRAGMA quick_check` before and after staging and refuse an existing destination or SQLite `-wal`/`-shm`/`-journal` sidecar. These checks are not a lock: a concurrent process can create a sidecar between the final check and publication. Use a directory with exclusive access; do not open or move the destination until the command has finished.

## Tests

```powershell
npm test
```

`npm test` builds the renderer and exercises quick capture, goals and next steps, controlled session availability fixtures, database snapshot/restore recovery, and the integrated Home experience through real Electron windows with isolated temporary SQLite data.
