# TGM terminal foundation

A standalone Windows development slice for trying the installed AGY and OpenCode CLIs in a real interactive terminal. It does not connect to the TGM dashboard yet.

From this directory, run `npm install`, then `npm start`. Choose an existing project folder and a harness, then select **Start terminal**. The CLI retains control of its own login, prompts, and permissions. OpenCode uses its private `--standalone` server. Stop the session before choosing another harness or folder. Use Ctrl+Shift+C to copy a selection and Ctrl+Shift+V to paste. When a terminal app captures the mouse, hold Shift while selecting text.

The harness check looks for the selected CLI in absolute folders on the PATH inherited by TGM. It checks file presence only; it does not verify that the CLI can launch or that you are signed in. **Check again** can detect a CLI installed into an existing PATH folder. If you change PATH itself, restart TGM to pick up the new environment. Windows may also find commands outside those PATH folders, so the check does not prevent you from trying to start a CLI.

`npm test` checks input, output, resizing, ordinary descendant termination, and restarting with a disposable shell. `npm run test:harness` checks harness detection and retry with temporary files. `npm run test:clipboard` checks the renderer's copy and paste bridge using an in-memory clipboard. `npm run test:clipboard-windows` checks the Windows clipboard and restores its previous contents. No model call is made.

On Windows x64, `npm run package:win` creates `dist/TGM-Terminal-win32-x64/TGM Terminal.exe` and its required runtime files. Keep the entire output folder together. The build command refuses to overwrite an existing build; move or remove that folder before rebuilding. `npm run test:package` checks that the packaged Electron runtime loads the native terminal module and runs a disposable shell. `npm run test:package-gui` builds a separate temporary copy and checks harness detection through its packaged window and bridge; it does not alter the existing build. The output is an unpacked development build, not an installer, signed release, or auto-updating app.

This is a development foundation, not a packaged or security-reviewed release. It does not yet retain terminal sessions across app restarts. Stopping or closing a running terminal asks for confirmation and terminates the terminal process tree; any unsaved work in the running CLI can be interrupted. Detached or reparented processes are not covered by the cleanup test.
