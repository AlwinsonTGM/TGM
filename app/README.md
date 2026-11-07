# TGM Home

TGM Home is a Windows-first Electron development app. It saves quick captures, goals, next steps, completed steps, and basic projects locally, using the selected TGM dashboard concept. A capture can be edited, deleted, or attached to a goal or project; projects can be named, assigned an optional folder, archived, and restored. Workspace runs the installed AGY or OpenCode CLI in an interactive terminal. FlowState, Obsidian and session resume are not connected.

## Run

Use Node.js 24 or later and npm. From this directory:

```powershell
npm ci
npm start
```

`npm start` builds the interface and starts Electron. The app stores its SQLite database as `captures.sqlite` in Electron's per-user `userData` directory, outside the source checkout. This is a development app, not an installer or a production release.

## Workspace terminal

Open **Workspace**, choose a harness and an existing working folder, and select **Start terminal**. The CLI manages its own sign-in, prompts and permissions. TGM starts only the selected executable found in absolute folders on its inherited PATH; restart TGM after changing PATH. OpenCode uses `--standalone`. Finding the executable does not establish sign-in or successful launch.

From Home, **Start** on a suggested step offers independent work, AGY, or OpenCode. The chosen step is shown in Workspace but is not sent to the CLI; **Copy step** copies its text for you to paste if you choose. Independent work is untimed while FlowState is disconnected. For a harness, choose any suitable existing working folder; a goal does not need a project folder. A running terminal must be stopped before switching to another step. The selected context lasts only while the app remains open.

**Complete step** saves the outcome without stopping a running terminal. The goal remains available for another next step. Completed steps are listed on Home and can be restored when their goal has no active next step. Existing databases are upgraded when opened. Earlier app versions may open the upgraded database without understanding the new data; avoid using them with it.

Use Ctrl+Shift+C to copy a selection and Ctrl+Shift+V to paste. Hold Shift while selecting text if a terminal app captures the mouse. Stopping a session or closing TGM asks for confirmation; the running terminal process tree is terminated, but detached or reparented processes may survive. Sessions do not persist when TGM closes. Unsaved Home drafts receive a separate confirmation.

## Back up and recover

Close the app, then provide an existing absolute parent directory. Each command creates a uniquely named subdirectory, verifies the source and output, and prints the completed database's absolute path:

```powershell
node scripts/recover-database.cjs snapshot <absolute-source-db> <absolute-destination-parent-directory>
node scripts/recover-database.cjs restore <absolute-snapshot-db> <absolute-destination-parent-directory>
```

Recovery creates a separate copy; it does not replace the live database. The new directory may be visible before the operation completes. Do not let other processes modify it, and wait for the printed path before using it. If the process is interrupted it may leave an incomplete directory; do not use that database.

## Verify

```powershell
npm test
```

Automated tests use isolated temporary data and a disposable shell; they do not send prompts to your harnesses or connect to FlowState or Obsidian.
