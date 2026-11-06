# TGM session-flow preview

Open `index.html` in a modern browser. This disposable preview asks whether the proposed home-to-workspace journey feels natural.

Try selecting a suggested step, returning Home, continuing the last opened sample session, capturing a thought, starting/pausing/stopping sample focus, and opening a memory or reviewer preview. The time filter changes which sample suggestions appear. Everything resets when the page is refreshed or closed.

This is sample data and simulated behavior. The AGY terminal illustration is not connected to AGY; FlowState, Obsidian, actual saving, accounts, and the production application are not connected. Learning and Reviewers navigation are intentionally disabled in this limited preview. The styling and behavior are prototypes, not production implementation.

The visual layout (`index.html` and `styles.css`) and interaction code (`prototype.js`) are kept separate. An actual Antigravity `gemini-4-argon-medium` session generated the first behavior draft; it was then adapted and reviewed against this prototype's contract.

On 6 November 2026, the lead checked navigation, simulated stop and discard, dynamic Continue, and quick capture in a browser. AGY `gemini-3.8-flash-high` also used a narrowly scoped Agent Desktop adapter on an isolated copy of this preview to open a session, start/stop sample focus, and open/discard a memory proposal; an independent accessibility snapshot confirmed the stopped/open-task and discarded states. A screenshot through Agent Desktop failed because its test window was minimized, so this does not establish Gemini visual-design review or test the real integrations. Synthetic AGY conversation and an isolated test browser profile may remain.
