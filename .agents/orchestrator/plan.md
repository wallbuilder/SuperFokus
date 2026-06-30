# Plan: SuperFokus E2E Test Suite Implementation Plan

## Architecture & Code Layout
- **Test files**: Located under `tests/e2e/`.
- **Existing tests**:
  - `tests/e2e/timers.spec.js`: E2E tests for POMO, micro-sprint, flow-state window opening.
  - `tests/e2e/repeating-reminders.spec.js`: E2E tests for repeating reminders.
  - `tests/e2e/site-blocker.spec.js`: E2E tests for site blocker.
- **App Startup**: Uses `@playwright/test` to launch Electron via `_electron.launch`.
- **User Data**: Saved in `electron-data/` to avoid polluting user configuration.

## Milestones

| # | Milestone Name | Scope / Target File | Dependencies | Status |
|---|---|---|---|---|
| 1 | Play/Pause Timer State Synchronization (R1) | `tests/e2e/timer-sync.spec.js` | None | DONE |
| 2 | Settings Persistence (R2) | `tests/e2e/settings-persistence.spec.js` | None | DONE |
| 3 | Sound Settings & Custom Upload (R3) | `tests/e2e/sound-settings.spec.js` | None | DONE |
| 4 | Fokus Stats Dashboard Rendering (R4) | `tests/e2e/stats-dashboard.spec.js` | None | DONE |
| 5 | E2E Integration and Zombie Process Verification | Run `npm test` and audit active processes | M1, M2, M3, M4 | DONE |

---

## Detailed Milestone Descriptions

### Milestone 1: Play/Pause Timer State Synchronization (R1)
- **Objective**: Implement Playwright tests checking bi-directional synchronization of play/pause state.
- **Test Steps**:
  1. Click POMO button and click start.
  2. Wait for mini-timer window to open.
  3. Click Play/Pause button in mini-timer window to pause. Verify main window UI updates to paused state (e.g., `#pause-pomo-btn` reads "Resume ▶", and `#pomo-timer-display` has `paused` class).
  4. Click "Resume" in main window. Verify mini-timer window updates to running/resumed state (play/pause button shows pause icon, `paused` class removed).
  5. Click "Pause" in main window. Verify mini-timer window updates to paused state.
  6. Click Play/Pause button in mini-timer window to resume. Verify main window updates to running/resumed state.
  7. Click "Stop" in main window. Verify mini-timer window closes.

### Milestone 2: Settings Persistence (R2)
- **Objective**: Implement Playwright tests verifying custom interval configurations, selected themes, or accent color settings successfully persist across restarts.
- **Test Steps**:
  1. Launch app, navigate to customization modal.
  2. Change theme (e.g., select Cyber-Green theme).
  3. Change some configurations (e.g., repeating reminders popup count or advanced settings).
  4. Save theme/settings and close modal.
  5. Close the application (`electronApp.close()`).
  6. Relaunch the application.
  7. Verify the theme selection and settings remain active (e.g., body has class `cyber-green-mode` or values are populated).

### Milestone 3: Sound Settings & Custom Upload (R3)
- **Objective**: Implement Playwright tests checking switching sound packs and custom audio uploads.
- **Test Steps**:
  1. Navigate to Customization -> Audio tab.
  2. Select different sound pack (e.g. check option updates).
  3. Click upload button and upload a dummy audio file using Playwright's `setInputFiles` on `#chime-file-input`.
  4. Verify the newly uploaded chime is successfully added to the custom notifications list.
  5. Select the custom notification and verify it is updated in the selector.

### Milestone 4: Fokus Stats Dashboard (R4)
- **Objective**: Implement Playwright tests verifying Stats panel renders heatmaps/charts and updates focus metrics after completion.
- **Test Steps**:
  1. Open Sidebar and click "Fokus Stats".
  2. Verify modal `modal-focus-stats` opens and the canvas `#statsChart` is rendered.
  3. Run a short focus session (or record a focus session in the UI / mock it) and verify that the focus time/completed rounds increment and session history updates.

### Milestone 5: E2E Verification & Zombie process cleanup
- **Objective**: Verify all tests pass via `npm test` and ensure Electron processes terminate properly after tests finish.
