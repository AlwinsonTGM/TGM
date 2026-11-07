# TGM Home

This desktop slice implements the first TGM Home experience backed by local SQLite storage:

- **Honest session and integration availability:** Shows `Continue where you left off` prominently when a controlled session provider supplies a session (retaining original `AGY` or `OpenCode` harness identity and confirming actual resume results), while reporting session continuation, FlowState, AGY, OpenCode, and Obsidian as not connected in the default local build.
- **Goals and suggested next steps:** Create goals with an optional first step, see suggested next steps derived from active goals, and review or edit goal and step details without mutating saved records until explicitly saved.
- **Uncategorized quick capture:** Save thoughts without forced categorization and preserve unsaved input across validation or storage failures.
- **Database snapshot and restore CLI:** Back up and restore the SQLite database into a newly created directory with `PRAGMA quick_check` verification.

## Usage

From this directory, with Node.js 24 installed:

```powershell
npm ci
npm start
```

`npm start` builds the renderer and launches Electron. SQLite data is stored in Electron's per-user application data directory (`captures.sqlite`), independently of the source checkout. The installed application is not yet packaged.

## Database backup and recovery

With the application closed, choose an existing parent directory for each operation:

```powershell
node scripts/recover-database.cjs snapshot <absolute-source-db> <absolute-destination-parent-directory>
node scripts/recover-database.cjs restore <absolute-snapshot-db> <absolute-destination-parent-directory>
```

Each command creates a uniquely named subdirectory, verifies the source and output using `PRAGMA quick_check`, and prints the absolute path of the completed `captures.sqlite` file. This keeps the output separate from existing databases and their SQLite sidecars. A restore produces a separate copy; it does not replace the app's live database.

Keep the app closed and do not let other processes modify the new directory during the operation. The generated directory can be visible before the command completes, and directory permissions depend on the operating system and its parent directory; this is not protection against another process under the same user. Wait for the printed path before using the copy. If the process is interrupted, it may leave an incomplete directory; do not use its database.

## Tests

```powershell
npm test
```

`npm test` builds the renderer and exercises quick capture, goals and next steps, controlled session availability fixtures, database snapshot/restore recovery, and the integrated Home experience through real Electron windows with isolated temporary SQLite data.
