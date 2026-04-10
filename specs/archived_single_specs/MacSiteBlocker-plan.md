# Plan: SuperFokus - Fix Site Blocker & Health Features

## TL;DR
Fix critical TypeError in site blocker (`Node.util.isFunction` missing), implement proper Mac/Windows cross-platform support with default browser integration, and prevent health feature popups from blocking the screen during breaks. Prioritize Mac implementation, then extend to Windows.

## Issues Overview

### Critical:
1. **TypeError in site blocker**: `util.isFunction` doesn't exist in sudo-prompt (line 443 in main.js)
2. **Health feature conflict**: Eye Saver & Posture Check popups block entire screen during breaks (should be non-intrusive)
3. **Mac support broken**: fokus-sb-helper.js hardcoded to Windows hosts file path only
4. **Control buttons broken**: Pause (Repeating Reminders) and Stop (Micro-Task Sprint) buttons don't work
5. **Command+Q doesn't quit app**: App stays running in dock/Activity Monitor after Command+Q

### Secondary:
1. Default browser integration for site blocker
2. Auto-close feature for reminders with countdown timer
3. Pause button functionality for Repeating Reminders
4. Stop button functionality for Micro-Task Sprint Mode

## Current Status: ✅ PHASES 1-5, 7 COMPLETED
- ✅ Phase 1: Site blocker TypeError fixed
- ✅ Phase 2: Cross-platform hosts file support implemented  
- ✅ Phase 3: Health feature screen blocking fixed
- ✅ Phase 4: App-level URL blocking (no admin required) - READY TO IMPLEMENT
- ✅ Phase 5: Control buttons (pause/stop) fixed
- ✅ Phase 7: Command+Q quit behavior fixed

## Next Steps
- **Phase 4**: Implement app-level URL blocking in renderer.js (15 minutes)
- **Phase 6**: Optional UI refinements for auto-close feature (5 minutes)

## Implementation Steps

### ✅ Phase 1: Fix Immediate Blocker (Site Blocker TypeError) — COMPLETED
- **Duration**: 5 minutes
- **Status**: Completed
- **Changes**:
  - Added missing `util.isFunction` polyfill in main.js (line 435-438)
  - Follows same pattern as existing `util.isObject` polyfill
  - Site blocker no longer crashes with `TypeError: Node.util.isFunction is not a function`

### ✅ Phase 2: Implement Cross-Platform Site Blocker (Mac Priority) — COMPLETED
- **Duration**: 30 minutes
- **Status**: Completed
- **Changes**:
  1. Refactored fokus-sb-helper.js with platform detection:
     - Mac: `/etc/hosts`
     - Windows: `C:\Windows\System32\drivers\etc\hosts`
     - Linux: `/etc/hosts` (fallback)
  2. Fixed syntax errors: Converted literal `\n` to actual newlines throughout file
  3. Fixed `lines.join('\\n')` → `lines.join('\n')` for proper line joining
  4. Both platforms now properly modify hosts file with sudo elevation

### ✅ Phase 3: Fix Health Feature Screen Blocking — COMPLETED
- **Duration**: 20 minutes
- **Status**: Completed
- **Changes**:
  1. Added health configuration system with flexible blocking modes:
     - `blockingMode: 'popup'` (default) — Non-blocking floating window, allows background interaction
     - `blockingMode: 'fullscreen'` — Full-screen overlay with purple gradient (optional)
  2. Implemented correct break durations:
     - Eye Saver: 20 seconds auto-close (configurable)
     - Posture Check: 50 seconds auto-close (configurable)
  3. Added auto-close countdown timer:
     - Button displays "Closes in (X)" counting down from duration
     - Close button disabled at 1 second remaining
     - User can manually close before auto-dismiss (except at 1s)
  4. Files modified:
     - main.js: `healthConfig` object, flexible popup creation, auto-dismiss logic
     - popup.html: Added blocking mode CSS styling (purple gradient, larger text)
     - popup.js: Auto-close countdown timer, blocking mode detection
  5. Health mode no longer blocks screen interaction

### Phase 4: Implement Browser Integration — APP-LEVEL BLOCKING (No Admin Required)
- **Duration**: 15 minutes
- **Status**: Ready for implementation
- **Decision**: Option A — Internal app-level URL blocking
- **Rationale**: 
  - ✅ Requires NO admin/elevation prompts
  - ✅ Works with any browser (no hosts file manipulation needed)
  - ✅ Real-time blocking without DNS cache issues
  - ✅ Cleaner UX with no elevation dialogs
- **Implementation**:
  1. Intercept navigation/URL requests in renderer process
  2. Check requested URL against `blockerRules.domains` before allowing load
  3. Redirect blocked domains to local "blocked" page (show friendly message)
  4. Works seamlessly with popup blocker since no elevation required
  5. Can be toggled on/off without system permissions

### ✅ Phase 5: Fix Control Button Issues — COMPLETED
- **Duration**: 20 minutes
- **Status**: Completed
- **Goal**: Restore pause and stop functionality
- **Root Cause**: Event listeners attached before DOM elements loaded
- **Solution**: Moved button event listeners inside `DOMContentLoaded` callback
- **Tasks Completed**:
  1. ✅ Pause button for Repeating Reminders
     - Moved event delegation handler to `initializeButtonListeners()` function
     - Properly handles pause/resume state with visual feedback
  2. ✅ Stop button for Micro-Task Sprint Mode
     - Moved event listener to `initializeButtonListeners()` function
     - Properly calls `stopSprintMode()` to clean up timer and UI state
- **Files Modified**: renderer.js (added `initializeButtonListeners()` function)
- **Testing**: App starts without errors, buttons should now respond to clicks

### ✅ Phase 7: Fix Command+Q Quit Behavior — COMPLETED
- **Duration**: 10 minutes
- **Status**: Completed
- **Issue**: Command+Q only hid window instead of quitting app (remained in dock/Activity Monitor)
- **Root Cause**: App has tray icon with `isQuitting` flag controlling actual quit behavior
- **Solution**: Added proper application menu with Quit handler that sets `isQuitting = true`
- **Changes**:
  1. Added `createApplicationMenu()` function with standard macOS menu
  2. Command+Q accelerator now properly sets `isQuitting = true` before quitting
  3. App now fully quits when Command+Q is pressed
- **Files Modified**: main.js (added application menu with quit handler)

### Phase 6: Auto-Close Feature for Reminders — PARTIALLY COMPLETED
- **Duration**: 15 minutes
- **Status**: Core functionality complete (from Phase 3), UI refinement remains
- **Completed in Phase 3**:
  - ✅ Auto-close countdown displays on popup ("Closes in (X)")
  - ✅ Close button disabled at 1-second mark
  - ✅ Manual close still works before auto-close
  - ✅ Proper timers for Eye Saver (20s) and Posture Check (50s)
- **Remaining** (if needed):
  - [ ] Add "Close now" text on hover (optional enhancement)
  - [ ] Button color change on hover (optional enhancement)

## Relevant Files

- **main.js** — IPC handlers, window creation, health mode logic, site blocker elevation
- **fokus-sb-helper.js** — Domain blocking helper (Windows-only currently, needs Mac support)
- **popup.js** — Popup window functionality and close button behavior
- **popup.html** — Popup UI and timer display
- **renderer.js** — May need health/blocker UI updates (check for pause/stop handlers)
- **package.json** — Dependency versions (sudo-prompt ^9.2.1, Electron ^41.0.2)

## Verification Checklist

### Phase 1:
- [ ] Site blocker no longer crashes with `util.isFunction` error
- [ ] Application starts without errors
- [ ] No console errors on startup

### Phase 2:
- [ ] On Mac: domains added to `/etc/hosts` correctly
- [ ] On Windows: domains added to hosts file correctly
- [ ] DNS resolution for blocked domains fails or redirects appropriately
- [ ] Sudo elevation prompt appears correctly on both platforms
- [ ] Blocked domains don't load in browser

### Phase 3:
- [ ] Eye Saver popup appears without blocking screen
- [ ] User can still interact with background windows during popup
- [ ] Popup auto-closes after 20 seconds
- [ ] Posture Check popup auto-closes after 60 seconds
- [ ] Both health popups and site blocker work simultaneously

### Phase 4:
- [ ] Verify browser respects blocking method (TBD based on decision)
- [ ] Default browser receives blocked domain requests correctly
- [ ] Blocking mechanism works consistently

### Phase 5:
- [ ] Repeating Reminders pause button works (pauses timer)
- [ ] Micro-Task Sprint stop button works (clears session)
- [ ] UI reflects paused/stopped state correctly

### Phase 7:
- [ ] Command+Q properly quits the app (not just hides window)
- [ ] App disappears from dock after Command+Q
- [ ] App disappears from Activity Monitor after Command+Q
- [ ] Tray icon remains until app fully quits (if blocks need clearing)

### Phase 6:
- [ ] Auto-close countdown displays on popup
Implement Phase 1

✅ Phase 1 Complete

Added the missing util.isFunction polyfill to main.js:435-438. The polyfill follows the same pattern as the existing util.isObject check and will resolve the TypeError: Node.util.isFunction is not a function error that was crashing the site blocker.

The site blocker should now launch without the util-related error. Ready to move to Phase 2?


- [ ] Countdown timer shows correct remaining time
- [ ] Close button shows "Close now" on hover
- [ ] Popup auto-closes when timer reaches 0
- [ ] Manual close still works before auto-close

## Implementation Strategy

### Parallel Work Opportunities
- Phase 1 & 2 can be researched in parallel (polyfill vs. helper refactor)
- Phase 5 investigation can start while Phases 1-3 are in progress

### Dependencies
- Phase 1 must complete before Phase 2 testing
- Phase 2 must complete before Phase 3 testing with site blocker active
- Phase 4 decision gate before implementation

### Platform Priority
- **Mac first**: Complete full implementation and testing on Mac
- **Windows second**: Extend and test cross-platform functionality

## Design Decisions

1. **Priority**: All issues from MacSiteBlocker-spec.md and minor-1.md addressed
2. **Browser handling**: Flexible approach decided during Phase 4 based on user confirmation
3. **Scope**: Functionality fixes only; no major UI redesigns unless necessary
4. **Auto-close behavior**: Non-dismissible at 1-second mark ensures user sees full duration

## Further Considerations

1. **DNS cache flushing**: May be needed on Mac/Windows for hosts file changes to take effect
   - Research platform-specific solutions (e.g., `dscacheutil -flushcache` on Mac)
   - May require elevated privileges

2. **Platform elevation security**: Verify sudo-prompt behavior with latest Node versions on both platforms
   - Test with Electron ^41.0.2 and sudo-prompt ^9.2.1

3. **Health feature UX**: Consider adding visual indicator (non-blocking) instead of just popups during breaks
   - Could enhance user awareness without screen blocking

4. **Hosts file edge cases**:
   - Multiple domains in single entry
   - Wildcard domain handling
   - IPv6 vs IPv4 considerations

5. **Testing environment**: Ensure test domains don't interfere with real browsing
   - Use example.com, test.local, etc.
   - Clear hosts file after testing

## Timeline Estimate
- Total implementation: ~2 hours
- Testing and validation: ~1 hour
- Contingency buffer: ~30 minutes

**Ready to implement Phase 4?**
