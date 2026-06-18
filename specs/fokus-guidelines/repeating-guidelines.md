# Repeating Reminders Mode Guidelines

## Overview
Repeating Reminders mode is designed to provide periodic "nudges" or alerts to the user at set intervals. This mode is ideal for keeping track of time without a rigid structure, ensuring the user is periodically reminded to stay on task or take small micro-breaks.

## Core Functionality
1. **Interval Setting:**
   - The user can define a reminder interval using two numerical inputs.
   - There will be one input for minutes and one for seconds.
   - The two text input's combined value of minutes and seconds will determine the cycle duration for each reminder.

2. **Looping Logic:**
   - The mode features an "Infinite Rounds" toggle.
   - When enabled, the timer will reset and start again immediately after each completion.
   - When disabled, the user must specify a "Number of Rounds" using a numerical input.
   - The application must track the "Current Round" vs the "Total Rounds" and display this progress to the user.

3. **User Alerts:**
   - Upon completion of an interval, the application must trigger a visual popup.
   - The user can configure "Popups per Cycle" (1 to 4) to spawn multiple popups upon completion. These must be staggered slightly (e.g., 300ms delays) to prevent UI overlap.
   - The popup should display a user-configurable message (e.g., "Time to check your posture!").
   - An optional audible chime should play alongside the popup, adhering to the user's sound pack settings.

4. **Dynamic Builder:**
   - When configured, the mode should display a clear summary of the planned reminder cycle.
   - The summary should update in real-time as the user changes the interval or round counts.

## Implementation Details
- **Timer Accuracy:** Use the centralized `TimerService` in the main process to ensure high-precision timing that is not affected by renderer process lag.
- **State Management:** The current round count and timer status must be preserved if the main window is hidden or minimized.
- **IPC Communication:**
  - Use `start-timer` to initiate the interval.
  - Listen for `timer-tick` to update the local progress display.
  - Trigger `show-popup` when the timer reaches zero.

## User Experience (UX) Standards
- The start button should clearly toggle to a "Stop" state while a session is active.
- Configuration inputs (interval, rounds) must be disabled while the timer is running to prevent mid-session logic conflicts.
- Visual progress (e.g., a countdown or progress bar) should be visible in the main dashboard. There should be no specified timer window that exists for this mode. (If there is one found, remove it!)

## Edge Case Handling
- If the interval is set to zero or a negative number, the "Start" button should remain disabled or show a validation alert.
- If "Infinite Rounds" is toggled mid-session, the application should gracefully update the termination logic without resetting the current interval.
- If the computer goes to sleep, the `TimerService` must calculate the elapsed time upon wake and determine if a reminder was missed.

## Future Enhancements
- Detailed logs of how many reminders were acknowledged vs ignored (close button clicked on >0 popups AFTER 1 second = acknowledgement).
