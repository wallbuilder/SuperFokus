# Flow State Mode Guidelines

## Overview
Flow State mode provides a simple, open-ended stopwatch for "Deep Work" sessions. It avoids the pressure of a ticking countdown, instead tracking how long the user has been in a state of continuous concentration. It is perfect for long, creative tasks or complex problem-solving.

## Core Functionality
1. **Stopwatch Logic:**
   - Unlike other modes, Flow State **counts up** from 00:00:00.
   - It tracks elapsed time rather than remaining time.
   - The timer should continue until manually stopped by the user.

2. **Periodic Chimes (Intention Nudges):**
   - The user can configure a "Chime Interval" in minutes and seconds.
   - When enabled, a subtle sound plays at the specified interval (e.g., every 15 minutes).
   - This serves as a "reality check" to ensure the user is still focused and hasn't drifted into a distraction.

3. **Timer Window Integration:**
   - The dedicated timer window must display "Flow State" as its primary header.
   - The central display must show the time in `HH:MM:SS` format.
   - Since there is no set end time, the progress bar should either be hidden or show an "active" animation.

4. **Session History:**
   - Upon stopping the session, the total elapsed time must be recorded in the application's statistics module.
   - Sessions shorter than a certain threshold (e.g., 1 minute) should not be recorded to keep the focus logs clean.

## Implementation Details
- **Stable Start Time:** Calculate the elapsed time by subtracting the session start timestamp from the current timestamp, rather than incrementing a local variable, to prevent timer drift.
- **Handshake Mechanism:** The timer window must request its initial state from the main UI upon opening to ensure the stopwatch starts displaying correctly without a 1-second delay.
- **IPC Updates:** Use `update-timer-window` to pass the `HH:MM:SS` string and an explicit `task: 'Flow State'` label to the timer window.

## User Experience (UX) Standards
- The "Start" button should toggle to a red "Stop" button during an active session.
- Theme colors for Flow State should be calming and non-intrusive (e.g., cool blues or greens).
- The intention nudge (chime) must be audible but not startling; it should feel like a gentle reminder rather than an alarm.

## Edge Case Handling
- **Very Long Sessions:** The display must handle sessions longer than 24 hours without breaking the UI layout.
- **Computer Sleep:** The stopwatch must correctly account for time spent in sleep mode by comparing the system clock upon wake.
- **Accidental Close:** If the timer window is closed, the stopwatch should continue running in the main process until the user explicitly stops it from the dashboard.

## Future Enhancements
- Integration with "System Idle" tracking to automatically pause the stopwatch if the user leaves their computer.
- A "Deep Work" mode that automatically blocks all websites when Flow State is active.
- Visualizations of "Focus Streaks" for users who maintain Flow State for multiple days in a row.
- Support for "Custom Sounds" for the intention nudge.
