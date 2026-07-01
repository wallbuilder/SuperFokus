# Plan: SuperFokus Enhancements

This plan outlines the steps the Project Orchestrator will coordinate to enhance SFX customizability, fix the classic audio clipping issue, and add the preset Update button.

## Step 1: Initial Exploration
- Dispatch a `teamwork_preview_explorer` to study the codebase.
- Key targets:
  - Settings/Sounds components and upload handlers.
  - `src/renderer/utils/audio/audio-engine.js` (especially classic audio/brown noise generation).
  - Pomo Timer, Micro Sprint, and Repeating Reminders React components.
  - Existing E2E test setup (Playwright files, configuration, scripts).

## Step 2: Implementation of R1 (Custom SFX & Delete)
- Implement custom SFX uploads up to 10.
- Implement deletion logic (electron-store and physical file removal).
- Update dropdown selectors to reflect changes.

## Step 3: Implementation of R2 (Audio Generation Fix)
- Modify classic audio/brown noise generation scaling factor in `audio-engine.js` to stay within `[-1.0, 1.0]` bounds.

## Step 4: Implementation of R3 (Preset "Update" Button)
- Track selected preset states in Pomo, Micro Sprint, and Repeating Reminders.
- Toggle between "Save Preset" and green "Update" button based on value drift.
- Handle in-place update for custom presets, and new custom preset creation under the same name for built-in presets.

## Step 5: Verification and Test Coverage
- Implement E2E tests for these features.
- Run tests and ensure no regressions.
