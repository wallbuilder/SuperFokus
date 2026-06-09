# Pomo Style Mode Guidelines

## Overview
Pomo Style mode is a sophisticated implementation of the Pomodoro Technique, allowing for customized sequences of work and break phases. It encourages deep focus followed by intentional recovery periods to maintain high productivity levels throughout the day.

## Core Functionality
1. **Dynamic Sequence Builder:**
   - The user can build a custom list of phases using the "+ Work Phase" and "+ Break Phase" buttons.
   - Each phase is represented as a "unit" in the dynamic builder list.
   - **Phase Labels:** Units are clearly labeled as 'Work Phase' or 'Break Phase'.
   - **Editable Durations:** Each unit contains an editable text box (number input) to define the duration.
   - **Unit Selection:** A dropdown menu to the right of the duration allows selecting between 'mins' (minutes) and 'secs' (seconds).
   - **Reordering & Deletion:** Each unit should have a 'Remove' (X) button to delete it from the sequence.

2. **Session Logic:**
   - The sequence is executed in linear order from top to bottom.
   - **Auto-Advance:** When a phase completes, the application should automatically transition to the next phase in the list if the "Autostart next phase" toggle is enabled.
   - **Manual Advance:** If autostart is disabled, the timer stops at 00:00 and waits for the user to click a "Continue" button.
   - **Infinite Repetition:** An "Infinite Rounds" toggle allows the entire sequence to loop indefinitely.
   - **Planned Repeats:** If not infinite, the user can specify the total number of times the sequence should repeat.

3. **User Alerts & UI Feedback:**
   - **Distinct Chimes:** Use different chime types for 'Work Start', 'Break Start', and 'Session Complete'.
   - **Timer Window Integration:** The dedicated timer window must display the current phase name, remaining time, and a progress bar.
   - **Phase Summary:** The main dashboard should display a "Next Up" preview to show the user what phase follows the current one.

## Implementation Details
- **Phase Consolidation:** Sequential phases of the same type (e.g., Work followed by Work) should be combined into a single logical block for the `TimerService`.
- **State Persistence:** The `activePomoSequence` must be stored such that a window reload doesn't reset the user's progress within a multi-phase session.
- **Handshake Mechanism:** The timer window must request initial data upon opening to ensure the first phase displays correctly without race conditions.

## User Experience (UX) Standards
- The "Start" button must toggle to "Stop" once a session begins.
- Clicking "Stop" should immediately terminate the session and close the timer window.
- The progress bar in the timer window should transition smoothly and accurately reflect the completion percentage of the *current phase*.
- Header colors should change based on the phase: typically a focus-oriented color for Work and a calming color for Breaks.

## Edge Case Handling
- **Empty Sequence:** The "Start" button should be disabled or trigger a warning if no phases have been added.
- **Zero Durations:** Validation must prevent phases from being set to 0 minutes or 0 seconds.
- **Mid-Session Edits:** Configuration inputs should be locked during an active session to maintain the integrity of the sequence logic.

## Future Enhancements
- Integration with the Site Blocker to automatically restrict distracting websites *only* during Work phases.
- Support for "Long Breaks" every X number of cycles.
- Export/Import of custom Pomo sequences as presets.
- Statistics tracking for "Time Spent Focusing" vs "Time Spent Breaking".
