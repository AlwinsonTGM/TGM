# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Windows-first desktop application with a web-style interface hosted in Electron; phone/cloud support may be considered later.

## Stack

Agreed direction, 6 November 2026: React, TypeScript, and Vite for the dashboard, with Electron and Node.js/TypeScript for the desktop host; SQLite for local structured data and Markdown for approved Obsidian reviewers. Evaluate xterm.js and node-pty for hosting installed harness CLIs. Keep the existing FlowState app in Tauri and Rust. Versions, dashboard repository, SQLite binding, secure integrations, and deployment/packaging remain open and need testing.

D: is an unreliable external HDD and is not suitable for development; use reliable internal storage. The user has managed storage and does not need a disk-space optimization plan.

## Users

The primary user is the product owner: a student and developer working at a Windows PC. They have many possible projects and learning goals and often struggle to decide where to begin. They are familiar with CLI and agent-harness interfaces, care strongly about UI/UX, and mainly read AI-written study notes in Obsidian. Phone use is distracting, so the initial release is PC-first.

## Product Purpose

Make it easier to start a meaningful work or study session, capture thoughts without immediate organization, and return later to see what was done, studied, and practiced. Success means the user actually returns to the app to do useful work and can build skills independently, rather than spending time maintaining a complicated productivity system.

## Positioning

Bring a small set of actionable goal suggestions together with selectable installed harnesses, initially the Antigravity CLI (AGY) and OpenCode, the user's own FlowState focus app, and their Obsidian reviewer library. The user controls what AI-generated progress, memory, and reviewer changes are saved. This is a product direction supported by limited prototypes, not a claim that a finished integration exists.

## Operating Context

- The primary entry point is the start of a PC work or study session. The user can choose a small step, select an installed harness for a session, continue a prior session with its original harness, or work independently.
- FlowState tracks focus time, including sessions started without a harness. Stopping a session and completing a task are separate actions.
- The user reads AI-assisted reviewers in an existing Obsidian vault and wants to revisit learning through multiple-choice, interview, or hands-on practice.
- Projects may be attached to a real folder or represent a personal or study goal without an existing folder. Quick capture should not force categorization.

## Capabilities and Constraints

- The first usable release requires both installed AGY and OpenCode CLIs, FlowState and Obsidian integrations, along with goal tracking, quick capture, project/session access, approved learning history, and all three practice formats. See [first-release plan](outputs/first-release-plan.md).
- Run the actual installed harness CLIs in an app-hosted terminal, with a choice per session. Keep sessions, authentication, and harness-specific configuration distinct; do not assume conversations transfer across harnesses. Verify project-aware tools, skills, and resume behavior separately for each harness; do not treat a submitted command or an AI response as evidence of success without checking the action's result.
- Explore OpenCode's API for possible deeper integration separately from the required terminal experience; verify its capabilities, security, and lifecycle before relying on it. No API integration is established by the current prototype.
- Project memory is bounded and saved only on explicit user request after review. The user allows cross-project suggestions using active projects' memories; archived projects are excluded by default.
- Review proposed changes before applying them to goal progress, learning history, project memory, or the existing vault. Preserve user data and distinguish verified facts from AI suggestions.
- FlowState and independent focus must work without a harness; AI summaries are optional and depend on available context. First-release behavior for failure, synchronization, recovery, and backup must be designed and tested.
- Product implementation has not started. The experiments used disposable data and prototypes and did not establish production security or a complete packaged dashboard.
- The user wants design and logic work separated into focused tasks, coordinated through clear interfaces, with Worktrunk for isolated parallel development where applicable. The requested implementation model is AGY's Argon Medium, while Gemini 3.8 Flash High should drive Agent Desktop for UI testing where those tools work.

## Brand Commitments

- The user wants **TGM** (their own initials/name) as the top app brand, replacing the generated AGY brand. The AGY terminal retains its actual AGY identity. Whether the full product name is Personal Command Center remains open.
- The user named GradientDeck UI and Unslop as desired GitHub design references. Their exact intended repositories and applicable usage are being verified; do not silently substitute a different project with the same name.
- The user explicitly wants the interface to feel familiar to tools they already use; recognizable navigation, controls, and expected behavior are a binding design preference. They named AGY, Obsidian, Google Keep, and Codex as familiar references. The final visual system remains open.
- The user selected the Codex UX concept as the design direction. Its full design system and production implementation remain to be documented and developed.

## Evidence on Hand

- [Project hub and current handoff](outputs/project-hub.md).
- [First-release plan](outputs/first-release-plan.md) and [planning decisions](outputs/dashboard-decisions.md).
- [End-to-end prototype results](outputs/end-to-end-prototype-results.md): actual AGY commands controlled a modified isolated FlowState copy; AGY also submitted a reviewer proposal through MCP. The reviewer browser/Obsidian and MCP approval-endpoint checks were separate runs.
- The existing FlowState app and source are a distinct project; its current completion action marks the task complete. The user's existing Obsidian vault contains reviewer notes, but the whole vault has not been audited.

## Product Principles

- Reduce the effort needed to begin useful work.
- Keep capture and daily use simple while preserving the user's longer-term goals.
- Make AI assistance reviewable and accurate about its available evidence.
- Support independent study and reflect practice without claiming mastery.
- Protect existing work and make failure, recovery, and actual action results clear.
