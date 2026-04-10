## Plan: Mac blocking behavior fix

TL;DR - Make the blocker window on macOS reliably prevent switching away and implement a delayed corner popup that expands to fullscreen after a configurable timeout. Do this by adding mac-specific BrowserWindow options and focus-lock behavior in the main process, moving the fullscreen transition behind a renderer timer, and wiring IPC between renderer and main for controlled fullscreen requests.

**Steps**
1. Discovery & reproduce
   1. Run the app on mac and reproduce the failure: verify blocked area can be bypassed by switching windows; confirm corner popup immediately goes fullscreen.
   2. Decide desired behavior: popup visible for N seconds (default 5s) then expand to fullscreen and fully lock user from switching away.

2. Main-process changes (mac-specific)
   1. Update blocker BrowserWindow creation in `main.js` to use macOS-specific options: `alwaysOnTop: true` (use level `'screen-saver'`), `visibleOnAllWorkspaces: true`, and optionally `kiosk` mode when locking is required.
   2. Add focus-lock handlers: when blocking is active, listen for `win.on('blur')` and immediately `win.focus()` (and log attempts). Also listen for `close`/`hide` attempts and prevent them while blocking.
   3. Expose IPC handlers in main: `blocker-show-popup`, `blocker-expand-fullscreen`, `blocker-start`, `blocker-stop`.

3. Renderer changes (popup timing & transition)
   1. Modify `fullscreen-popup.js` / `popup.js` so the corner popup is shown first and does NOT request fullscreen immediately.
   2. Add a configurable timer (default 5s) in the renderer; when timer fires, send `blocker-expand-fullscreen` IPC to main to perform the fullscreen/lock transition.
   3. Add visual state and CSS to clearly show the corner popup and smooth transition to fullscreen.

4. IPC and coordination
   1. Use Electron IPC (`ipcRenderer` ↔ `ipcMain`) to request mode changes. Keep logic that manipulates window focus and levels in main only.
   2. Ensure messages are rate-limited and validated: ignore double/rapid requests.

5. Platform gating & fallbacks
   1. Gate mac-specific APIs behind `process.platform === 'darwin'` checks.
   2. For non-mac platforms, preserve existing behavior or implement best-effort approximate locking (e.g., `alwaysOnTop` without kiosk).

6. Configuration & UX
   1. Make the popup delay configurable (default 5s). Store in a small config or pass as parameter when starting a block.
   2. Add a visual countdown on the corner popup so users understand the upcoming fullscreen transition.

7. Testing & verification
   1. Manual tests on macOS (detailed in Verification below).
   2. Add unit tests for IPC handlers where feasible (mock `BrowserWindow`) and linting.

8. Rollout
   1. Add a feature-flag or user preference to enable the new mac behavior.
   2. Update README with mac-specific notes and troubleshooting steps.

**Relevant files**
- `main.js` — modify BrowserWindow creation and add IPC handlers and focus-lock logic
- `renderer.js` — coordinate renderer <-> main IPC wiring
- `fullscreen-popup.js` — change popup timing and transition triggers
- `fullscreen-popup.html` — popup markup and countdown UI
- `popup.js` — any shared popup logic used by the app
- `popup.html` — verify consistency with other popups
- `index.html` — entry points and any initialization
- `package.json` — add test/run scripts if needed

**Verification**
1. Run the app: `npm install` then `npm start` (or the project's start command).
2. Trigger the block behavior and observe:
   - A small popup appears in the corner (with countdown).
   - Before timeout, attempting to switch windows (Cmd+Tab, clicking another app) should not permanently leave the blocker window — it should refocus/return.
   - After the countdown, the window expands to fullscreen and further switching is blocked.
3. Try edge cases: rapid show/hide requests, multiple quick blocking requests, closing via keyboard shortcuts.
4. Confirm non-mac platforms behave unchanged.

**Decisions**
- Use main-process focus/level manipulation rather than renderer-only hacks (safer and more reliable on macOS).
- Use `kiosk` mode only when strict locking is required; otherwise use `alwaysOnTop` + `focus()` to avoid overly aggressive system-level restrictions.

**Further Considerations**
1. Accessibility: ensure the popup and forced focus behavior are accessible and provide a clear escape for legitimate accessibility tools. Option: add an emergency bypass protected by a password or long-press.
2. Limitations: macOS and the OS-level task switcher (Cmd+Tab) are intentionally difficult to fully block; if complete prevention is required, kiosk mode may be necessary and should be opt-in.
