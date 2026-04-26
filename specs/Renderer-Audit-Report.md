# Renderer.js Audit Report
**Date:** April 25, 2026
**Subject:** Dependency Mapping for Modularization

## 1. Logical Sections of `renderer.js`
This mapping identifies the approximate location of feature logic for extraction.

- **Lines 1-150:** Global State, UI References, and IPC Setup.
- **Lines 151-400:** Core Utilities (Audio, Custom Modals, LocalStorage/Store).
- **Lines 401-750:** Pomodoro Timer logic and UI bindings.
- **Lines 751-900:** Micro-Sprint logic.
- **Lines 901-1150:** Flow State (Stopwatch mode).
- **Lines 1151-1350:** Repeating Reminders (Posture, Water).
- **Lines 1351-1700:** Workflows Engine (Orchestration logic).
- **Lines 1701-1900:** Site Blocker UI (IPC triggers).
- **Lines 1901-End:** Statistics, Theme Toggling, and App Resets.

## 2. Global Variable & Dependency Map

| Variable/Symbol | Features Using It | Dependency Risk |
| :--- | :--- | :--- |
| `isWorkflowRunning` | Workflows, Pomo, Sprint, Site Blocker | **High.** Controls timer locking. |
| `totalFocusTime` | Pomo, Sprint, Flow, Stats | **Medium.** Shared accumulator. |
| `recordFocusSession()`| Pomo, Sprint, Flow, Workflows | **Medium.** Shared storage utility. |
| `playChime()` | Pomo, Sprint, Repeating, Health | **Low.** Shared audio feedback. |
| `customAlert()` | All Features | **Low.** Shared UI modal wrapper. |
| `isPomoRunning` | Pomo, Workflows, Home Reset | **High.** Required for workflow auto-advance. |
| `currentWorkflowBlock`| Workflows, UI Header | **Medium.** Global UI state. |

## 3. Structural Risks for Refactor
1. **Tight Coupling in Workflows:** The Workflow engine programmatically triggers DOM events in other features. These should be replaced by a centralized Event Bus or Command pattern.
2. **Monolithic Reset:** The `returnToHome()` function has hardcoded knowledge of every feature's "stop" logic.
3. **State Leakage:** Feature-specific flags (like `isPomoRunning`) are currently in the global scope, making them vulnerable to accidental mutation.

## 4. Recommended Extraction Order
1. **Utilities First:** `storage.js`, `audio.js`, `modals.js`.
2. **Independent Features:** `site-blocker.js`, `health-mode.js`.
3. **Core Features:** `pomo-timer.js`, `flow-state.js`.
4. **Orchestrator Last:** `workflows.js` (requires all other modules to be ready).
