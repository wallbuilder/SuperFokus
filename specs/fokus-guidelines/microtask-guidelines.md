# Micro-Task Sprint Mode Guidelines

## Overview
Micro-Task Sprint mode is designed for rapid execution of small, discrete tasks. It helps users overcome procrastination by breaking down a large to-do list into timed "bursts" of activity, ensuring continuous momentum.

## Core Functionality
1. **Task Input:**
   - The user provides a list of tasks, typically in a multi-line text area where each line represents one task.
   - If no tasks are entered, the system should default to a placeholder like "Unnamed Sprint".

2. **Timed Sprints:**
   - The user selects a fixed duration for each task sprint (e.g., 5, 10, or 20 minutes).
   - A "Custom" duration option should allow for precise control over the sprint length.

3. **Sprint Flow:**
   - Tasks are executed sequentially.
   - **Manual Completion:** After a sprint finishes, the timer stops, and the user must click "Next Task" or "Skip" to continue.
   - **Autostart Feature:** If "Autostart next task" is enabled, the next sprint begins automatically after a short delay (e.g., 2 seconds) to keep the user moving.
   - **Skip Logic:** Users can skip the current task, which stops the current timer and moves to the next item in the list without recording a successful focus session.

4. **Heads-Up & Notifications:**
   - **Completion Alert:** The application must play a chime and show a native OS notification when a task sprint completes.
   - **Timer Window:** The window must show the *current task name*, the time remaining, and a progress bar.
   - **Tasks Remaining:** A counter below the progress bar must display the number of tasks remaining in the current sprint.

## Implementation Details
- **Typo Verification:** Ensure the "Autostart" checkbox ID in the HTML matches the JavaScript selector (checked for `sprint-autostart`).
- **Labeling:** The timer window must receive the task name dynamically via IPC to ensure the header always matches the active task.
- **Progress Tracking:** The `sprintDurationSeconds` must be calculated correctly from the minutes input and used as the denominator for the progress bar percentage calculation.

## User Experience (UX) Standards
- The task list should be easily editable before the session starts.
- While a sprint is active, the task list input should be locked to prevent confusion.
- The "Next" and "Skip" buttons should be prominently displayed in the main dashboard during a session.
- The timer window should be compact and stay "always on top" to keep the user focused on the active task.

## Edge Case Handling
- **Single Task:** If only one task is provided, the session should conclude immediately after that task is finished.
- **Empty List:** If the user attempts to start with an empty text area, a default task should be created.
- **Premature Stop:** Clicking "Stop" in the dashboard should immediately close the timer window and reset the sprint state.

## Future Enhancements
- Support for "Dragging to Reorder" tasks in the list.
- Integration with external productivity tools (e.g., Todoist, Notion) to import task lists.
- A "Victory" screen upon completing all tasks in a sprint list.
- Heatmap integration to show which times of day are best for micro-task execution.
