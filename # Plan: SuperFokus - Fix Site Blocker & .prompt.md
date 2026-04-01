# Plan: SuperFokus - Fix Site Blocker & Health Features

## TL;DR
Fix critical TypeError in site blocker (`Node.util.isFunction` missing), implement proper Mac/Windows cross-platform support with default browser integration, and prevent health feature popups from blocking the screen during breaks. Prioritize Mac implementation, then extend to Windows.

## Issues Overview

### Critical:
1. **TypeError in site blocker**: `util.isFunction` doesn't exist in sudo-prompt (line 443 in main.js)
2. **Health feature conflict**: Eye Saver & Posture Check popups block entire screen during breaks (should be non-intrusive)
3. **Mac support broken**: fokus-sb-helper.js hardcoded to Windows hosts file path only
4. **Control buttons broken**: Pause (Repeating Reminders) and Stop (Micro-Task Sprint) buttons don't work

### Secondary:
1. Default browser integration for site blocker
2. Auto-close feature for reminders with countdown timer
3. Pause button functionality for Repeating Reminders
4. Stop button functionality for Micro-Task Sprint Mode

## Implementation Steps

### Phase 1: Fix Immediate Blocker (Site Blocker TypeError)
- **Duration**: 5 minutes
- **Goal**: Unblock site blocker from crashing on startup
- **Task**: Add missing `util.isFunction` polyfill in main.js (line ~428)
  - Pattern already exists for `util.isObject`, replicate for `util.isFunction`
  - Location: main.js#L429

### Phase 2: Implement Cross-Platform Site Blocker (Mac Priority)
- **Duration**: 30 minutes
- **Goal**: Support both Mac and Windows hosts file manipulation
- **Tasks**:
  1. Refactor fokus-sb-helper.js to detect OS and use appropriate hosts file path
     - Mac: `/etc/hosts`
     - Windows: `C:\Windows\System32\drivers\etc\hosts`
  2. Update main.js IPC handlers for cross-platform compatibility
     - Ensure sudo-prompt works on both platforms
     - Handle platform-specific elevation/admin prompts
     - Location: main.js#L435-L480
  3. Platform detection tests
     - Verify on Mac: sudo.exec works with `/etc/hosts`
     - Verify on Windows: sudo.exec works with Windows hosts file
     - Test domain blocking actually functions on both platforms

### Phase 3: Fix Health Feature Screen Blocking
- **Duration**: 20 minutes
- **Goal**: Prevent health popups from blocking user interaction with screen
- **Tasks**:
  1. Modify popup window creation to NOT block/disable screen
     - Make popups non-modal (allow interaction with background)
     - Popups should float on top but not prevent other window access
     - Remove any fullscreen or overlay blocking
     - Location: main.js#L94-L125 (`createPopupWindow()` function)
  2. Add popup auto-dismiss
     - Eye Saver: auto-close after 20 seconds
     - Posture Check: auto-close after 60 seconds
     - User can still manually close earlier
  3. Verify health mode doesn't interfere with site blocker
     - Test both running simultaneously
     - Ensure popups don't block screen while site blocker is active

### Phase 4: Implement Browser Integration (Flexible Mode)
- **Duration**: 15-30 minutes (depends on decision)
- **Goal**: Clarify and implement default browser blocking method
- **Decision Point**: Which blocking mode is needed?
  - Option A: Internal app-level blocking (intercept URLs before load)
  - Option B: At OS level via hosts file (current approach)
  - Option C: Both modes available (toggle based on settings)
- **Tasks** (based on selected option):
  - If Option A: Modify IPC to check domain against blockerRules before loading; redirect blocked domains to "blocked" page
  - If Option B: Ensure cross-platform hosts file modification works; test browser respects hosts file changes; may need DNS cache flushing
  - If Option C: Implement both with UI toggle for user selection

### Phase 5: Fix Control Button Issues
- **Duration**: 20 minutes
- **Goal**: Restore pause and stop functionality
- **Tasks**:
  1. Pause button for Repeating Reminders
     - Search for pause handler in main.js and renderer.js
     - Verify IPC event is properly wired and logic is correct
     - Add state management if missing
  2. Stop button for Micro-Task Sprint Mode
     - Similar investigation and fix as pause button
     - Ensure timer properly cancels/clears

### Phase 6: Implement Auto-Close Feature for Reminders
- **Duration**: 25 minutes
- **Goal**: Automatically close reminder popups with countdown UI feedback
- **Tasks**:
  1. Add countdown timer to popup close button
     - Close button displays: "Closes in (10)" counting down to 0
     - On hover: changes to "Close now", button lightens
     - At 1 second: disable further closes (should auto-close at 0)
     - Location: popup.html and popup.js
  2. Update PopupWindow creation to set auto-close timers
     - Eye Saver: 20 second deadline
     - Posture Check: 60 second deadline
     - Repeating Reminders: per spec requirement

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

### Phase 6:
- [ ] Auto-close countdown displays on popup
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

**Ready to implement Phase 1?**
