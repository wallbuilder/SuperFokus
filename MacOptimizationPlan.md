# macOS Optimization Plan: SuperFokus

## 🎯 Objective
Optimize the SuperFokus Electron application for macOS to improve performance, battery life, and provide a native feel. 

Crucially, this plan is designed to **completely avoid merge conflicts** with the concurrent Windows optimization effort by isolating all macOS-specific code into dedicated modules and avoiding modifications to shared core logic wherever possible.

## 🛡️ Conflict Mitigation Strategy
To ensure zero collisions with the Windows development branch, we will adhere to the following rules:

1. **Dedicated Service File:** All macOS main-process logic will be encapsulated in a new file: `src/main/services/MacOptimizationService.js`.
2. **Minimal Touch on `main.js`:** We will only add a single line to `main.js` (or the relevant initialization file) to hook the macOS service:
   ```javascript
   if (process.platform === 'darwin') {
       require('./services/MacOptimizationService').init(app, mainWindow);
   }
   ```
3. **Dedicated UI Assets:** Any macOS-specific renderer UI changes will be placed in a separate CSS file (e.g., `mac-styles.css`) or wrapped in strict `.platform-darwin` CSS classes. We will not modify generic layout styles that the Windows dev might be tweaking.
4. **Build Config Isolation:** If modifying `package.json` or electron-builder configs, we will strictly only touch the `mac`, `dmg`, or `mas` configuration blocks. We will avoid touching the `win` or `nsis` blocks.

## 🚀 Proposed macOS Optimizations

### 1. Power & Resource Management (App Nap)
* **The Problem:** macOS aggressively limits background processes using App Nap, which can break the Pomodoro timer when the app is in the background or minimized.
* **The Solution:** Implement `powerSaveBlocker` dynamically. Instead of keeping it on constantly (which drains battery), our `MacOptimizationService` will manage it, only blocking suspension when a timer is actively ticking.
* **Implementation:** Hook into the existing `TimerService` events (if an event emitter exists) from `MacOptimizationService.js` rather than modifying `TimerService.js` directly.

### 2. Native Window Aesthetics (Vibrancy & Titlebar)
* **The Problem:** The app may look out of place on macOS without native visual paradigms.
* **The Solution:** 
  * Apply `vibrancy: 'under-window'` (or similar) to the `BrowserWindow` configuration specifically for Mac.
  * Use `titleBarStyle: 'hiddenInset'` to blend the traffic light buttons natively into the application header.
* **Implementation:** Modify the `WindowManager.js` window instantiation by extending the options object exclusively when `process.platform === 'darwin'`.

### 3. Dock & Menu Integration
* **The Problem:** macOS users expect apps to interact with the Dock and top Menu Bar.
* **The Solution:**
  * Implement Dock badging (e.g., showing remaining minutes on the Dock icon).
  * Add a native Application Menu, which is explicitly required for standard copy/paste shortcuts to work correctly on macOS.
  * Support right-click Dock menu items (e.g., "Start Flow State", "Pause Timer").
* **Implementation:** Handle entirely within `MacOptimizationService.js` using `app.dock` and `Menu.setApplicationMenu`.

### 4. Sleep & Wake Handling
* **The Problem:** When a Mac goes to sleep and wakes up, timers often become desynced because JavaScript `setTimeout`/`setInterval` pauses.
* **The Solution:** Use Electron's `powerMonitor` module.
* **Implementation:** Listen for `suspend` and `resume` events in the `MacOptimizationService`. On `resume`, calculate the time delta since sleep and automatically fast-forward the timer state.

## 📋 Implementation Checklist

- [ ] Create `src/main/services/MacOptimizationService.js`.
- [ ] Add Mac-specific window configurations (vibrancy, hidden titlebar) to `src/main/services/WindowManager.js` inside a `darwin` check.
- [ ] Implement App Nap/Power Save logic in the Mac service.
- [ ] Implement Dock icon badging and context menu in the Mac service.
- [ ] Implement `powerMonitor` sleep/wake sync logic in the Mac service.
- [ ] Add a macOS-specific stylesheet for any UI tweaks (like adjusting header padding for the traffic lights).
- [ ] Verify build configurations under the `"mac"` key in `package.json`.

By keeping our footprint confined to `darwin`-specific files and conditional blocks, we ensure the Windows optimization team can work freely without fear of stepping on our toes.