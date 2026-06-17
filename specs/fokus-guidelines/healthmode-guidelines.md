# Health Mode Guidelines

## Overview
Health Mode is a wellness-focused feature that encourages users to take regular breaks from their computer. It addresses "Computer Vision Syndrome" and physical fatigue by enforcing short eye-rest periods and longer movement breaks throughout the day.

## Core Functionality
1. **Periodic Rest Reminders:**
   - **20-20-20 Rule:** Every 20 minutes, the user is prompted to look at something 20 feet away for 20 seconds.
   - **Movement Breaks:** Every hour (or a user-defined interval), the user is prompted to stand up and stretch for several minutes.

2. **Enforcement Levels:**
   - **Soft Reminder:** A simple notification or non-blocking popup appears, which the user can easily dismiss.
   - **Strict Enforcement:** The screen is partially or fully obscured by a semi-transparent overlay that cannot be closed until the break duration has elapsed.
   - **Hard Lock (Kiosk Mode):** For maximum discipline, the application enters a "kiosk" state where all other windows are hidden, forcing the user to step away.

3. **Smart Pause:**
   - If the user is already away from their computer (detected via system idle time), Health Mode should automatically pause its timers to avoid "double-breaking".
   - It should resume only once activity is detected again.

## Implementation Details
- **Always on Top:** The break windows must use `alwaysOnTop: true` and `level: 'screen-saver'` (on macOS) to ensure they are visible over all other applications.
- **IPC Handshake:** The break window should signal the main process when it is successfully displayed, so the timer can begin.
- **Fullscreen Logic:** Use Electron's `setKiosk` or `setFullScreen` methods for strict enforcement modes to prevent the user from Alt-Tabbing away from the break.

## User Experience (UX) Standards
- The break window should display helpful wellness tips or simple stretch animations.
- Calming background colors and typography should be used to reduce visual stress.
- A "Skip" button may be provided in "Soft" mode, but should be hidden or require a confirmation in "Strict" mode.

## Edge Case Handling
- **Emergency Override:** There must be a hidden way to close a hard-locked break window in case of an emergency (e.g., a specific key combination).
- **Multiple Displays:** Health Mode must ideally dim or block all connected monitors, not just the primary one.
- **Video Playback Detection:** The mode should optionally detect if a video is playing (e.g., during a meeting) and defer the break until the video stops.

## Future Enhancements
- Integration with fitness trackers (e.g., Apple Health, Fitbit) to synchronize break data.
- "Guided Breathing" exercises during the rest periods.
- Support for "Hydration Tracking" reminders.
- Custom stretch routines that the user can pick from.
