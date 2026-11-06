# TGM Home

This is the first desktop slice: local quick capture and its saved history. Goals and the real terminal, FlowState, and Obsidian integrations are not connected yet.

From this directory, with Node.js 24 installed:

```powershell
npm ci
npm start
```

`npm start` builds the renderer and launches Electron. SQLite data is stored in Electron's per-user application data directory, independently of the source checkout. The installed application is not yet packaged.

Run `npm test` to build the renderer and exercise the app through real Electron windows with isolated temporary data, including a restart and a storage failure. The Electron binary may download on first use.
