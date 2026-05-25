# SuperFokus Codebase Optimization and Architectural Report {5/23/2026}

This report outlines at least 20 distinct errors, bugs, and optimization opportunities within the `src/` directory of the SuperFokus application. These issues have been categorized for easier triage.

-----------------------------------------------------------------------------------------------------------------------------------

## Category 1: IPC and Process Communication



### 1. Memory Leak in Preload Event Listeners
**File:** `src/main/preload.js`
**Snippet:**
```javascript
on: (channel, func) => {
    // ...
    ipcRenderer.on(channel, (event, ...args) => func(...args));
}
```
**Explanation:** The `electronAPI.on` function wraps the provided callback in an anonymous function but does not return a cleanup function (e.g., `removeListener`). If a renderer component (like a UI view) mounts and unmounts, registering a listener each time, it will cause a significant memory leak and duplicate executions.
**Recommendation:** Return the wrapped function so it can be removed, or expose a complementary `off` method in `preload.js` that calls `ipcRenderer.removeListener`.
**Status:** Issue fixed on date 5/24/2026

### 2. Dynamic IPC Channel Anti-Pattern
**File:** `src/main/preload.js`
**Snippet:**
```javascript
const TIMER_PREFIXES = ['timer-complete-', 'timer-started-', /* ... */];
const isTimerChannel = TIMER_PREFIXES.some(prefix => channel.startsWith(prefix));
```
**Explanation:** Using dynamic channels (e.g., `timer-complete-pomo`, `timer-complete-break`) bypasses strict channel whitelisting and creates IPC sprawl. It makes tracking and auditing events much harder.
**Recommendation:** Consolidate these into single static channels (e.g., `timer-event`) and pass the identifier (like `pomo` or `break`) inside the event payload.

### 3. Inefficient Timer Broadcasting
**File:** `src/main/services/TimerService.js`
**Snippet:**
```javascript
windowManager.broadcastToWindows('timer-tick', { id, remaining, total: timer.totalSeconds });
```
**Explanation:** The `setInterval` loop executes every second for *every* active timer and unconditionally broadcasts to all 4 possible windows (Main, Popup, Timer, Fullscreen). If 3 timers run simultaneously, it fires 12 IPC messages per second.
**Recommendation:** Batch the timer ticks into a single array update per second and only send it to windows that are currently visible or explicitly listening for timer updates.
**Status:** Issue fixed on date 5/24/2026

### 4. Unvalidated Arbitrary File Storage
**File:** `src/main/services/IpcMainHandlers.js`
**Snippet:**
```javascript
ipcMain.on('store-set', (event, key, value) => {
    if (!windowManager.isOriginSafe(event)) return;
    if (store) store.set(key, value);
});
```
**Explanation:** The `store-set` IPC handler performs no validation on the size or structure of `value`. A bug in the renderer could serialize a massive object (e.g., audio blobs) and hang the main process while writing to disk via `electron-store`.
**Recommendation:** Implement strict schema validation and size limits (e.g., max 1MB per key) within the `store-set` handler before saving to disk.
**Status:** Issue fixed on date 5/24/2026

### 5. Unbatched IPC Calls During Startup
**File:** `src/renderer/utils/storage.js`
**Snippet:**
```javascript
for (const key of keysToMigrate) {
    // ...
    store.set(key, JSON.parse(val));
}
```
**Explanation:** The `migrateStore` function sequentially fires an IPC `store-set` call for every key. This is highly inefficient during the critical startup path of the application.
**Recommendation:** Expose a `store-set-multiple` IPC handler to pass all keys and values in a single transaction, or handle migration entirely on the main process side.

-----------------------------------------------------------------------------------------------------------------------------------

## Category 2: System and Native Integration



### 6. Hardcoded Proxy Port Collision
**File:** `src/main/services/BlockerService.js`
**Snippet:**
```javascript
proxyServer.listen(8080, '127.0.0.1', () => { ... });
```
**Explanation:** Port `8080` is a very common port for local development servers. Hardcoding it guarantees a crash (`EADDRINUSE`) if another application is already bound to it, preventing the allow-list blocker from working.
**Recommendation:** Use port `0` to let the OS assign an available port dynamically, then read `proxyServer.address().port` to configure the system proxy settings.

### 7. Uncleaned Temporary Files
**File:** `src/main/services/BlockerService.js`
**Snippet:**
```javascript
const tempPath = path.join(app.getPath('userData'), 'fokus_domains.json');
fs.promises.writeFile(tempPath, JSON.stringify(domains))
```
**Explanation:** The service writes the domain list to a temporary file for the elevated helper script to read, but it never deletes the file after the helper completes. This leaks sensitive domain data and clutters the `userData` directory.
**Recommendation:** Ensure `fs.promises.unlink(tempPath)` is called in the `.then()` or `finally()` block after `runElevated` finishes executing.

### 8. Unstable Crash Handler with UAC Prompt
**File:** `src/main/main.js`
**Snippet:**
```javascript
process.on('uncaughtException', (err) => {
    blockerService.runElevated('clear', [], () => { process.exit(1); });
});
```
**Explanation:** `runElevated` relies on `sudo-prompt`, which triggers a UAC (User Account Control) prompt on Windows. If the app crashes, the user sees a random OS admin prompt. If they ignore it, the crashed app process remains frozen in memory indefinitely.
**Recommendation:** Use a fast, synchronous fallback to clear blocks if possible, or spawn a detached background un-elevated cleanup script that uses system scheduled tasks to clean up later. Do not block crash exits on UAC prompts.

### 9. HTTPS Proxy Blackholing (Bad UX)
**File:** `src/main/services/BlockerService.js`
**Snippet:**
```javascript
clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
```
**Explanation:** When blocking HTTPS requests in proxy mode, it abruptly terminates the socket. Because it does not intercept SSL (no MITM cert), the browser simply shows a confusing "Connection Reset" error rather than the friendly "Service Unavailable" HTML.
**Recommendation:** If MITM is not desired, standard DNS/hosts file blocking is far superior for HTTPS. If proxying must be used, document that HTTPS connections cannot show custom block pages.

### 10. Command Line Length Limits for Helper
**File:** `src/main/fokus-sb-helper.js` & `src/main/services/BlockerService.js`
**Snippet:**
```javascript
const base64Args = Buffer.from(JSON.stringify(commandArgs)).toString('base64');
sudo.exec(`... ${command} ${base64Args}`, ...);
```
**Explanation:** When applying a large list of domains directly via `commandArgs`, the resulting Base64 string can easily exceed the Windows command-line string length limit (8191 characters), causing the script to silently fail.
**Recommendation:** Always pass data to the helper via temporary JSON files (`apply-file`) rather than encoding large payloads directly into the CLI arguments.

-----------------------------------------------------------------------------------------------------------------------------------

## Category 3: Window and UI Management

### 11. Reference to Non-Existent Window
**File:** `src/main/services/TimerService.js`
**Snippet:**
```javascript
if (windowManager.pomoTimerWindow && !windowManager.pomoTimerWindow.isDestroyed() ...)
```
**Explanation:** The `TimerService` attempts to restore `windowManager.pomoTimerWindow`. However, `WindowManager.js` only defines `this.timerWindow`. The property `pomoTimerWindow` is undefined, causing this logic to silently fail.
**Recommendation:** Change the reference to `windowManager.timerWindow` to properly match the implementation in `WindowManager`.
**Status:** Issue fixed on date 5/24/2026

### 12. Multi-Monitor Blindness
**File:** `src/main/services/WindowManager.js`
**Snippet:**
```javascript
width: screen.getPrimaryDisplay().workAreaSize.width,
```
**Explanation:** Popups and timer windows are hardcoded to spawn on `screen.getPrimaryDisplay()`. If a user moves the main app to a secondary monitor, popups will still appear on the primary screen, causing massive confusion.
**Recommendation:** Calculate the bounds of the display where `mainWindow` currently resides (`screen.getDisplayMatching(this.mainWindow.getBounds())`) and spawn popups on that specific display.

### 13. Artificial Startup Delay Loop
**File:** `src/renderer/renderer.js`
**Snippet:**
```javascript
const executeStepsSequentially = async () => {
  while (currentStep < steps.length) {
    // ... logic
    await new Promise(r => setTimeout(r, 0));
  }
};
```
**Explanation:** The startup code intentionally delays the application load using sequential `setTimeout` loops to artificially animate a loading bar (`startup-loading-bar`). This results in unnecessary sluggishness.
**Recommendation:** Remove the artificial sequence. Initialize the modules as fast as possible and fade out the loading screen instantly when `Promise.all` resolves.

### 14. Magic UI Timeouts
**File:** `src/renderer/features/workflows/workflows-engine.js`
**Snippet:**
```javascript
setTimeout(() => {
    if (currentBlock.type === 'pomo') { ... startPomoStyle(); }
}, 100);
```
**Explanation:** The code relies on a magic `100ms` delay to allow the DOM to switch modes before attempting to start the Pomo timer. On slower machines, 100ms might not be enough, causing race conditions and UI bugs.
**Recommendation:** Use modern reactive patterns or `requestAnimationFrame` to ensure the DOM has updated before executing the dependent functionality.

### 15. Tight Coupling to DOM Elements
**File:** `src/renderer/features/workflows/workflows-engine.js`
**Snippet:**
```javascript
pomoPresetsSelect.value = currentBlock.presetKey;
pomoPresetsSelect.dispatchEvent(new Event('change'));
```
**Explanation:** The workflows engine acts as a puppeteer, directly mutating internal select elements of the `pomo-timer` feature and faking user events to trigger internal logic. This completely breaks encapsulation.
**Recommendation:** Expose a function in `pomo-timer.js` like `export function setPresetAndStart(presetKey)` and invoke that directly from the workflow engine.

-----------------------------------------------------------------------------------------------------------------------------------

## Category 4: State, Performance, and Data Management

### 16. Severe Performance Drop from Audio DataURLs
**File:** `src/renderer/utils/audio/audio-storage.js`
**Snippet:**
```javascript
const formattedNotifs = notifs.map((dataUrl, idx) => ({ ... src: dataUrl }));
await store.set('customSoundPacks', customSoundPacks);
```
**Explanation:** Converting large audio files (MP3/WAV) to Base64 `DataURL` strings and persisting them inside `electron-store`'s JSON file causes massive read/write penalties and memory bloat.
**Recommendation:** Save the binary audio files to a dedicated `sounds` folder in the `userData` directory via Node `fs` (main process), and store only the file paths in `electron-store`.

### 17. OS Sleep Interval Drift
**File:** `src/main/services/HealthService.js`
**Snippet:**
```javascript
healthIntervals.eye = setInterval(() => { ... }, healthConfig.eyeSaverInterval);
```
**Explanation:** Intervals of 20-45 minutes are highly susceptible to OS sleep states. If a laptop sleeps for 40 minutes, `setInterval` pauses, effectively delaying the posture check by 40 minutes upon waking.
**Recommendation:** Compare `Date.now()` against an expected target time within a more frequent heartbeat loop, accounting for sudden large jumps in time (indicative of waking from sleep).

### 18. Missing IPC Listener Cleanup
**File:** `src/renderer/features/workflows/workflows-engine.js`
**Snippet:**
```javascript
export function setupEngineListeners() {
    ipcRenderer.on('timer-tick', (data) => { ... });
}
```
**Explanation:** `setupEngineListeners` registers a `timer-tick` listener. If this function is called multiple times (e.g., on a soft reload or re-initialization), it will stack duplicate listeners, causing memory leaks and duplicated UI updates.
**Recommendation:** Store a reference to the bound function and explicitly remove it before re-registering, or flag if listeners are already attached.
**Status:** Issue fixed on date 5/24/2026

### 19. Direct State Mutation via DOM Elements
**File:** `src/renderer/features/pomo-timer.js`
**Snippet:**
```javascript
pomoState.pomoSequence[idx].duration = val;
```
**Explanation:** Event listeners inside the sequence list manipulate the `pomoState` array directly. This scattered mutation makes it impossible to implement generic tracking, undo/redo, or robust save mechanisms.
**Recommendation:** Implement a centralized state dispatcher (e.g., `updateSequenceDuration(idx, val)`) that handles validation, updates the object, and triggers re-renders explicitly.

### 20. Main Window Reactivation Bug
**File:** `src/main/main.js`
**Snippet:**
```javascript
app.on('activate', () => {
    if (require('electron').BrowserWindow.getAllWindows().length === 0) {
        windowManager.createWindow();
    } else {
        windowManager.mainWindow.show();
    }
});
```
**Explanation:** If the app has an active background popup or timer window but the `mainWindow` was hidden (not destroyed), `getAllWindows().length` is > 0, so it calls `mainWindow.show()`. But if `mainWindow` *was* destroyed, it might fail because `mainWindow` is null. Alternatively, if a new window is created, it overwrites the reference.
**Recommendation:** Check `if (!windowManager.mainWindow || windowManager.mainWindow.isDestroyed())` directly rather than relying on the length of `getAllWindows()`.
**Status:** Issue fixed on date 5/24/2026

-----------------------------------------------------------------------------------------------------------------------------------

## Summary

**Summary:** Addressing these 20 issues will significantly improve the stability, security, UX, and long-term maintainability of the SuperFokus application.
