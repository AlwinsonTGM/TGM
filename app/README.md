# TGM Home

TGM Home is a Windows-first Electron development app. It saves quick captures, goals and their next steps locally, using the selected TGM dashboard concept. Workspace runs the installed AGY or OpenCode CLI in an interactive terminal. FlowState, Obsidian and session resume are not connected.

## Run

Use Node.js 24 or later and npm. From this directory:

```powershell
npm ci
npm start
```

`npm start` builds the interface and starts Electron. The app stores its SQLite database as `captures.sqlite` in Electron's per-user `userData` directory, outside the source checkout. This is a development app, not an installer or a production release.

## Workspace terminal

Open **Workspace**, choose a harness and an existing project folder, and select **Start terminal**. The CLI manages its own sign-in, prompts and permissions. TGM starts only the selected executable found in absolute folders on its inherited PATH; restart TGM after changing PATH. OpenCode uses `--standalone`. Finding the executable does not establish sign-in or successful launch.

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
