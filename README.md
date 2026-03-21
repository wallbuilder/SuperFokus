# SuperFokus

SuperFokus is an Electron application designed to help regulate computer and homework time while minimizing distractions.

## v0.3.5 - Improvements Update Rework

This update focuses on polishing the user experience and resolving interface issues.

### Core Enhancements
- **Sticky Header**: The main dashboard header (title and menu toggle) is now sticky, meaning it stays at the top of the screen as you scroll, ensuring controls are always accessible.
- **Improved Sidebar**:
    - **Interactive Toggle**: The sidebar button now features a "shapeshifting" icon that transforms from a hamburger (☰) to an 'X' when open.
    - **Selection Menu**: The sidebar now acts as a selection panel for different app dialogs (Stats, History, Customization).
    - **Modal Dialogs**: Selecting an item from the sidebar opens a focused modal with a darkened, blurred background overlay.
- **Enhanced Pomo Timer**:
    - **Reliability**: Optimized timer logic and disabled background throttling to ensure the timer runs accurately even when the app is minimized.
    - **Repeat Logic**: Users can now configure a specific number of repeats or set the session to run infinitely.
- **Break System Improvements**:
    - **Countdown**: Fullscreen and popup break reminders now feature a live countdown timer.
    - **Manual Progression**: If "Auto-Start Next Phase" is disabled, a "Next Phase" button appears once the break ends.
- **UI/UX Refinements**:
    - **Smooth Transitions**: Toggling Dark Mode now features a smooth color transition.
    - **Animated Startup**: A refined "materializing" and sliding animation for the SuperFokus intro screen.
    - **System Tray Integration**: SuperFokus now minimizes to the system tray on close, allowing it to run in the background.

## Planned Updates

### Health & Posture Mode (The "Body Guard")
- **Eye Saver:** Implements the 20-20-20 rule (every 20 minutes, look at something 20 feet away for 20 seconds).
- **Posture Check:** Regular reminders to stretch and adjust posture with a mandatory check-in.

### Micro-Task Sprint Mode (The "Speed Run")
- **Rapid Tasks:** Breakdown work into 5–10 minute high-speed sprints.
- **Visual Velocity:** A countdown timer for each small task to maintain momentum and focus.

### Additional Features
- Homework session management
- Distraction blocking
