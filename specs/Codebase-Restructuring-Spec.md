# TO BE IMPLEMENTED IN THE FUTURE. DO NOT USE UNLESS SPECIFICALLY REQUESTED.
## Codebase Restructuring Specification

### 1. Objective
The current codebase relies heavily on a single, monolithic `renderer.js` file (over 2000 lines) that manages everything from UI state and IPC communication to individual feature logic (Pomodoro, Site Blocker, Audio, etc.). This specification outlines the plan to restructure the application into a modular architecture using ES6 modules. This will improve code maintainability, isolate state, simplify future testing, and reduce merge conflicts.

### 2. Proposed Directory Structure

The application may be restructured into the following directory layout (Please note that this is an example and that new features/functions added can also be implemented into this layout as wished by the user):

```text
D:\coding\fokus\
├── src/
│   ├── main/                  # FOLDER: Electron main process files
│   │   ├── main.js             # Main application lifecycle and window management
│   │   └── preload.js          # IPC bridge and context isolation
│   ├── renderer/              # FOLDER: Frontend UI and feature logic
│   │   ├── renderer.js         # Main entry point (initializes the app and imports modules)
│   │   ├── features/           # FOLDER: Individual, isolated feature modules
│   │   │   ├── pomo-timer.js    # Pomodoro timer logic and UI bindings
│   │   │   ├── micro-sprint.js  # Micro-task sprint logic
│   │   │   ├── site-blocker.js  # Site blocker UI and IPC triggers
│   │   │   ├── flow-state.js    # Flow state stopwatch mode
│   │   │   ├── repeating.js     # Repeating reminders logic
│   │   │   ├── health.js        # Health and posture mode
│   │   │   └── workflows.js     # Workflow builder, drag-and-drop, and execution logic
│   │   ├── ui/                # FOLDER: Reusable UI components and DOM manipulation
│   │   │   ├── theme.js        # Dark/Light mode toggling
│   │   │   ├── modals.js       # Custom alert and modal handling
│   │   │   ├── navigation.js   # Sidebar and mode switching logic
│   │   │   └── charts.js       # Chart.js initialization and updates
│   │   └── utils/             # FOLDER: Helper functions and shared global logic
│   │       ├── storage.js      # LocalStorage wrapper (store object)
│   │       ├── audio.js        # Audio context, fallback beeps, and chimes
│   │       ├── stats.js        # Global stats tracking and history
│   │       └── ipc.js          # Centralized IPC listener setup (optional)
├── assets/                    # FOLDER: Static assets (images, icons, sounds)
│   ├── fokusicon.png
│   └── ...
├── specs/                    # FOLDER: Specifications and planning documents
├── index.html                # Main application view
├── package.json              # Project metadata and scripts
└── README.md
```

#### Folder Explanations

- **`src/main/`**: Contains files that run in Node.js (the Electron main process). It handles OS-level interactions, file system access, and window creation.
- **`src/renderer/`**: Contains all files that run in the Chromium browser context (the frontend).
  - **`features/`**: The core of the refactor. Each major mode of the application gets its own file. This encapsulates the state (e.g., `isPomoRunning`, `pomoTimer`, `isWorkflowRunning`) so it doesn't leak into other features.
  - **`ui/`**: Manages visual components that are shared across different features or handle the overall shell of the app (like the sidebar, theme toggles, and custom modal wrappers).
  - **`utils/`**: Shared helper functions that don't rely on specific UI elements but provide services to the rest of the app, like interacting with `localStorage`, playing audio, or tracking global statistics.

### 3. Pre-requisites & Actions Before Refactoring

Before writing any new code or moving files, the following actions **must** be taken to ensure a safe transition:

1. **Create a Dedicated Git Branch:**
   - Never perform a major refactor on the `main` or `master` branch.
   - Action: `git checkout -b feature/codebase-restructure`

2. **Verify Current Functionality (Baseline):**
   - Run the application and manually test all core features (Pomodoro, Site Blocker, Repeating Reminders, Audio chimes, Workflows) to establish a baseline of how the app behaves currently.

3. **Audit Global Variables:**
   - Review `renderer.js` and document all global variables (e.g., `isDarkMode`, `totalFocusTime`, `workflowBlocks`, `isWorkflowRunning`, `currentWorkflowBlockIndex`, `isPomoRunning`).
   - Determine which variables need to be exported from a state manager or passed as arguments, as ES6 modules have their own scope and won't share globals by default.

4. **Prepare the HTML File for ES6 Modules:**
   - The `<script>` tag in `index.html` loading `renderer.js` must be updated to support modules.
   - Action: Change `<script src="renderer.js"></script>` to `<script type="module" src="./src/renderer/renderer.js"></script>`.
   - *Note: Once `type="module"` is set, variables in `renderer.js` are no longer attached to the `window` object automatically. Any inline scripts in HTML (e.g., `onclick="..."`) will break and must be converted to `addEventListener` in the JS files.*

5. **Set up Linting (Optional but Recommended):**
   - Install ESLint to help catch export/import errors and undefined variables during the code movement process.

6. **Iterative Migration Plan:**
   - Do not delete the old `renderer.js` immediately.
   - Move code layer by layer: Utilities first (`storage.js`, `audio.js`), then UI components (`theme.js`, `modals.js`), and finally the complex features (`pomo-timer.js`).
   - Test the application after **each** file extraction.
