# Context: SuperFokus Enhancements

## Environment Details
- OS: Windows
- Workspaces:
  - D:\coding\fokus (SuperFokus application codebase)
- Technology Stack:
  - Electron
  - React
  - Audio Engine (Web Audio API / Custom synthesis)
  - electron-store
  - Playwright E2E tests

## Task Scope
- SFX customizability (max 10, delete options, delete files from disk)
- Fix brown noise distortion in `audio-engine.js` (scaling and normalization to stay within `[-1.0, 1.0]`)
- Green "Update" preset button in Pomo Timer, Micro Sprint, and Repeating Reminders modes.
