# Dashboard UX shaping — discovery draft

**Status:** Discovery in progress, 6 November 2026. Familiarity is a user-stated priority. User named AGY, Obsidian, Google Keep, and Codex as familiar tools; chose a small set of suggested next steps as the first-open priority; and selected **calm home + workspace**. The user prefers Concept C, likes the Loki-inspired workspace direction, wants noticeable themed details throughout, and requests **TGM** as the top app brand instead of AGY. Exact assets, home treatment, accessibility, and the complete visual system remain to be reviewed. This is not a UI implementation.

## User and job

A student and developer opens the app at a Windows PC, often feeling overwhelmed by many potential goals. The interface should make it easy to choose a small next step, continue an AGY session, or focus independently. It should feel familiar enough to navigate without relearning basic controls, and attractive enough that the user wants to return.

## Existing agreements

- The home view presents a few actionable suggestions, a way to continue the last session, access to projects/sessions, and quick capture. Time and energy input is optional.
- The AGY area hosts the real CLI and retains its actual keyboard behavior, commands, and approval prompts; dashboard controls do not pretend an action succeeded before it did.
- Projects have sessions. They can refer to a real folder or a personal/study goal. Archived projects remain available but are excluded from ordinary active suggestions.
- FlowState provides actual focus time. Pause/resume is clear; stopping a session and completing its task are separate actions. Focus works without AI.
- Obsidian reviewers are based on AGY study sessions and optionally selected sources. The user can preview/edit/approve changes; familiar subject and reviewer navigation should support reading.
- Project memory, learning progress, and practice results are distinct and user-reviewed. Multiple-choice, interview, and hands-on practice run through AGY in the first release.
- UI/design and logic are assigned to separate focused tasks and connected through an agreed contract before integration. The desktop stack direction is React/TypeScript/Vite and Electron; FlowState stays Tauri/Rust.

## Familiarity: design hypothesis

Favor recognizable controls, labels, placement, keyboard behavior, and predictable results from the tools the user already knows. The named references are AGY, Obsidian, Google Keep, and Codex. Candidate mappings: real AGY terminal and commands; project/session navigation familiar from agent harnesses; a readable, linked subject/reviewer library; and effortless quick capture. These are design hypotheses to validate, not claims that the user wants to copy each interface exactly. Keep navigation and status language consistent across surfaces. Do not assume FlowState's appearance is a favorite: the user described it as unfinished and rarely used.

Research supports the principle as a hypothesis: experimental work found that prior exposure to similar features helped participants complete tasks more quickly and use controls more intuitively ([Blackler et al.](https://pubmed.ncbi.nlm.nih.gov/19586618/)); another experiment found transfer from both familiar control appearance and spatial layout ([O’Reilly and Dixon](https://repositories.cdlib.org/uc/item/7cs60013)). These studies do not prove that a particular layout will work for this user or guarantee habitual use. Validate by asking the user to perform real tasks with a prototype.

## Surfaces and states to shape

| Surface | Main job | States to make understandable |
|---|---|---|
| Start | Find or capture one useful next action | First visit, no active goals, suggested steps, return to last session, AI unavailable |
| Projects and sessions | Locate, start, and resume a project/session | Project without a folder, many sessions, archived project, session restore failure |
| AGY workspace | Use the actual terminal alongside project context | Running, waiting for approval, tool denied/failed, unavailable or missing context |
| Focus | Start, pause, resume, stop, or explicitly complete work | Active, paused, app offline, duplicate action, stopped but task open |
| Review | Inspect and approve progress, memory, or reviewer changes | Pending, edited, rejected, approved, changed vault file, partial-write recovery |
| Learning | Find previous study and start practice | Studied versus practiced, questions/interview/exercise, tentative patterns, no history |

## Layout options for discussion

All options open on a few suggested next steps, keep project/session access and quick capture, and use the actual AGY terminal. These are rough structures, not approved visual designs.

1. **Calm home + workspace (recommended):** Start on suggested steps and Continue last session, with simple navigation and quick capture. Selecting a step opens a dedicated project/session workspace with the AGY terminal and focus status. Less initial density; moving into the workspace changes the main view.
2. **Always-visible workspace:** Suggested steps share the screen with the AGY terminal and project navigation. Fast context switching; less room for each area and more to process at first open.
3. **Session sidebar:** Suggested steps take the center; a persistent project/session sidebar stays visible. Opening a session replaces the center area with the AGY workspace. Easy to resume without the terminal occupying the home view; long session lists need careful organization.

The user chose **calm home + workspace** for further exploration. This is a structural direction, not final approval of detailed screen layouts or aesthetics. Keep stop versus complete separate and provide a way to focus without AGY.

## Initial home-screen visual concepts

On 6 November 2026, three AI-generated static home-screen references were produced for feedback, each showing synthetic content. They illustrate different treatments of the selected flow; they are not working screens, an approved design, or evidence of final copy and branding. The generated 'AGY' app names and any depicted shortcut are placeholders, not product decisions.

- [Concept A — calm dark](ui-exploration/concept-a-dark.png): graphite/lavender, spacious suggestions, compact recent-project navigation.
- [Concept B — warm light](ui-exploration/concept-b-light.png): light surfaces, quick capture near the top, familiar simple controls.
- [Concept C — focused dark](ui-exploration/concept-c-dense.png): denser rows, teal accent, recent sessions in the sidebar; its prominent display serif is an unapproved generated choice.

The user selected Concept C and said it recalls their favorite character Loki. They chose **more noticeable themed details throughout** over merely using the colors. The precise treatment is still subject to their review; preserve familiar usable controls. A workspace design, actual accessibility and layout checks, and implementation remain outstanding. GradientDeck examples considered as references: [Linear](https://ui.gradientdeck.com/styles/linear), [Raycast](https://ui.gradientdeck.com/styles/raycast), [Notion](https://ui.gradientdeck.com/styles/notion), [Cursor](https://ui.gradientdeck.com/styles/cursor). These are third-party interpretations, largely from public site visuals; they were not copied as a working-app template. The intended Unslop repository remains unconfirmed.

### Workspace exploration

[Loki-inspired workspace concept](ui-exploration/workspace-loki-exploration.png) is an AI-generated static exploration based on Concept C: deeper green and prominent gold themed details, project/session navigation, an illustrated terminal area, focus status, memory/reviewer actions, and quick capture. It is not a working app, and its original AGY app name, logo, terminal text, and icons are generated placeholders. In particular, the pictured generic shell output does **not** represent a tested AGY CLI interface; the eventual application must host the actual CLI. The companion home screen still needs matching treatment.

The user subsequently said they like this direction and requested **TGM** as the top app brand because it represents them. The [TGM-branded workspace concept](ui-exploration/workspace-tgm-concept.png) reflects that edit and preserves the **AGY Terminal** label for the real tool. The accepted direction does not by itself approve every generated icon, placeholder, layout detail, or claim. The matching home screen and other key states are still to be designed.

### Matching home and clickable preview

The [matching TGM home image](ui-exploration/home-tgm-concept.png) is a generated static concept, not an approved final screen. The [session-flow prototype](tgm-ux-prototype/index.html) is a separate disposable HTML/CSS/JS preview using synthetic in-memory state. It demonstrates suggestions, sample project sessions, quick capture, simulated focus and reviewed sample updates. It does not connect to AGY, FlowState, Obsidian, or real user data. The user has not yet evaluated the prototype; its answer and remaining states are open. A browser check and a Gemini/Agent Desktop sample interaction passed; see the [prototype notes](tgm-ux-prototype/README.md) for the visual testing limitation.

## Open questions

1. How should the chosen calm home and separate workspace be detailed? Check navigation, quick capture, visibility of focus status, and AGY terminal space with the user.
2. Which exact Unslop and GradientDeck repositories/references did the user mean? Several Unslop projects exist. This is not a reason to delay discovery or substitute one silently.
3. Compare actual desktop screen concepts and states with the user before settling visual direction or writing a design system. Test keyboard use, legibility, low-width behavior, real task completion, and whether the interface encourages starting work.

## Evidence and next step

FlowState's existing floating control displays the active task, timer, pause/resume, and completion. Use it as evidence of existing functionality, not as a mandate to copy its appearance. The old completion action marks the task complete, so the new flow must clearly distinguish stopping from completing. See [planning decisions](dashboard-decisions.md), [first-release plan](first-release-plan.md), and [integration tests](end-to-end-prototype-results.md).

Next: present a low-fidelity two-screen flow for the chosen direction, then explore visual treatments using the named references. Confirm a concise design brief with the user before implementation.
