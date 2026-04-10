 # SUPERFOKUS v0.9.1 UPDATE {4/8/2026}
This update fixes many of the problems had with v0.9.

# Optimzations (IMPLEMENT THIS FIRST USING THE STRATEGY BELOW)
    Based on an analysis of the SuperFokus codebase, there are several significant
    opportunities for optimization. Below is a list of the primary ways to optimize the code without changing functionality.

   1. Window Management (Singleton Pattern)
    File: 'main.js'
    * Current State: Functions like createPopupWindow(), createFullscreenWindow(), and
        createPomoTimerWindow() instantiate a brand new BrowserWindow object every time they
        are called, and destroy them when closed.
    * Optimization: In Electron, creating a new browser window is an expensive operation
        because it spins up a new Chromium renderer process. You should adopt a Singleton
        Pattern. Create these windows once (either at startup or upon first use) and then use
        window.hide() and window.show() instead of destroying and recreating them.

   2. IPC Traffic and Timer Ticks
    Files: 'main.js' and 'renderer.js'
    * Current State: The timer logic (setInterval) lives in the main process and ticks
        every 1000ms. On every single tick, it sends an IPC message (e.g., timer-tick-pomo)
        to the renderer process to update the UI.
    * Optimization: This creates high IPC traffic. You can offload the visual ticking to
        the renderer process. The main process should only calculate the target endTime and
        send that timestamp via IPC once. The renderer can then use requestAnimationFrame or
        its own local interval to update the display smoothly. The main process only needs to
        communicate when a timer is started, paused, stopped, or has definitively finished.

   3. DOM Event Delegation
    File: 'renderer.js'
    * Current State: In functions that build dynamic lists like renderSequence() and
        renderWorkflowStack(), the code clears the container, creates new elements, and then
        loops through them using querySelectorAll to attach individual event listeners (for
        inputs, selects, and remove buttons).
    * Optimization: Use Event Delegation. Attach a single event listener to the static
        parent container (e.g., sequenceListEl) and check event.target to determine which
        dynamic child was clicked or changed. This avoids attaching and detaching hundreds of
        event listeners, preventing memory leaks and speeding up the render cycle.

   4. Chart.js Re-rendering
    File: 'renderer.js'
    * Current State: Inside renderChart(), the code completely destroys the existing
        statsChartInstance and instantiates a new Chart() every time a focus session is
        recorded.
    * Optimization: Tearing down and rebuilding a Canvas context is computationally heavy.
        Instead, check if the chart instance already exists. If it does, simply update the
        underlying data array (statsChartInstance.data.datasets(0).data = newData) and call
        statsChartInstance.update() (PLEASE NOTE THAT THE PARENTHESES AROUND THE 0 SHOULD BE REPLACED WITH SQUARE BRACKETS WHEN IMPLEMENTING THIS CODE).

   5. Excessive OS-Level Polling
    File: 'main.js'
    * Current State: For macOS focus enforcement, there is a setInterval (macFocusEnforcer)
        that runs every 1000ms. It constantly calls fullscreenWindow.focus(),
        setAlwaysOnTop(true), and setAlwaysOnTop(false).
    * Optimization: Continuously thrashing native OS window APIs every second is very
        resource-intensive. Since there are already event listeners for the blur event that
        re-focus the window if the user clicks away, the constant polling interval is likely
        redundant and should be removed or severely throttled.

   6. Caching DOM Elements and LocalStorage Writes
    File: 'renderer.js'
    * DOM Queries: Frequent functions like customAlert() query the DOM for their elements
        (document.getElementById) every time they are executed. These lookups should be
        cached globally once at the top of the file.
    * Storage Syncs: In recordFocusSession(), store.set() (which wraps synchronous
        localStorage.setItem) is called four times in a row. These writes are blocking the
        main thread and should be combined into a single object write or batched/debounced.
    
  ## Recommended Implementation Strategy (FOLLOW THESE STEPS TO IMPLEMENT THE ABOVE OPTIMIZATIONS):
  If you need to tackle the above optimizatons, you could easily do it in isolated phases to ensure
  stability:
   1. Phase 1 (Low Risk, High Reward): Implement the frontend fixes (3, 4, and 6). These
      are standard JavaScript best practices that touch isolated functions in renderer.js
      and carry almost zero risk of breaking core app functionality.
   2. Phase 2 (Medium Risk): Refactor the IPC traffic (2). This requires coordinating
      changes across both main.js and renderer.js to ensure the timers still sync
      properly, but it yields massive CPU efficiency gains.
   3. Phase 3 (Higher Complexity): Refactor to the Window Singleton pattern (1) and tone
      down the Mac polling (5). This changes the core lifecycle of how the app handles its
      memory and windows, so it requires more careful testing to ensure windows properly
      clear their state when hidden instead of destroyed.

# Improvements & QOL
- Add a "Select another mode button" between the "Select a Fokus Mode to get started" heading and the config options
- The "Select a Fokus Mode to get started" text should change to "Select another Fokus Mode" and become a text button (an example of this is the "SuperFokus" header text that takes you to the main page) if you are viewing a Fokus Mode Config Page.
    - The button will open a modal (call it something like "choose-extra-mode"/"chooseExtraMode") that gives you the option to select another mode, excluding the mode you are already on. There will also
    - If it's open, the sidebar will automatically close when the button is pressed. AS LONG AS THE MODAL IS VISIBLE, YOU WILL NOT BE ABLE TO OPEN THE SIDEBAR.
- Add a link to the GitHub page for SuperFokus in the bottom right of the window. Refer to the file 'fokus-v0.9_helper.JPG' for a visual example.

# Bugs & Fixes
- The Pause Button for Repeating Reminders and Pomo Style STILL doesn't work.
- Turning on Dark mode still leaves SuperFokus's "background" white (check the code to see why this is the case).
- A JavaScript error happens when trying to activate Site Blocker on Windows. Analyze the code to see if it is outdated and (replace it with code that works if it's ACTUALLY outdated). There is a picture of the JavaScript error at the file 'fokus-SB-Error.png'.

# Technical & Other Requirements
- **Version Bump:** MUST change all instances of the old version number ('v0.9') to "v0.9.1" across all files (e.g., UI headers, package.json, etc.).