# Handoff Report: R3 Visual Preset "Update" Button Analysis

## 1. Observation
*   **Vanilla JS instead of React**: Direct DOM queries are used for UI binding.
    *   `src/renderer/features/pomo-timer.js:29`: `const pomoPresetsSelect = document.getElementById('pomo-presets');`
    *   `src/renderer/features/micro-sprint.js:31`: `const sprintPresetsSelect = document.getElementById('sprint-presets');`
    *   `src/renderer/features/repeating.js:192`: `const repeatingPresetsSelect = document.getElementById('repeating-presets');`
*   **Save Preset Buttons in `index.html`**:
    *   Pomo: Line 1688: `<button class="action-btn" id="save-pomo-preset-btn" style="margin-top: 0; width: auto; padding: 0.85rem; background: var(--header-grad-1);">Save Preset</button>`
    *   Sprint: Line 1760: `<button class="action-btn" id="save-sprint-preset-btn" style="margin-top: 0; width: auto; padding: 0.85rem; background: var(--header-grad-1);">Save Preset</button>`
    *   Repeating: Line 1613: `<button class="action-btn" id="save-repeating-preset-btn" style="margin-top: 0; width: auto; padding: 0.85rem; background: var(--header-grad-1);">Save Preset</button>`
*   **Missing Built-in Dropdown Option**:
    *   `index.html` line 1756 contains:
        ```html
        <select id="sprint-presets" style="flex: 1;">
          <option value="custom">Custom</option>
        </select>
        ```
        However, `src/renderer/features/micro-sprint.js` line 89 contains built-in logic: `if (val === 'quick-chores') { ... }`

## 2. Logic Chain
1.  **Direct DOM Bindings**: The codebase uses direct vanilla JS element queries and event bindings (such as `addEventListener` and `.value` properties) rather than React framework states. Therefore, the implementation must modify these event listener files rather than React JSX components.
2.  **Input Drift Monitoring**: Since the inputs can be directly queried from the DOM, we can check for changes (drift) by executing a `checkPresetDeviation()` helper function bound to `change`, `input`, and `keyup` event listeners of the configuration fields.
3.  **Visual Styling Toggling**: The save buttons have an inline gradient background (`background: var(--header-grad-1)`). We can programmatically overwrite this with a green style (`#27ae60`) and text (`"Update"`) when drift is detected, and restore it back when drift is resolved.
4.  **Save vs Update Routing**: By checking for the presence of an `.update-mode` class on the save buttons in their click handlers, we can execute the in-place update/save-as-custom logic for active presets instead of launching the "Save Preset" input overlay.
5.  **Built-in Option Gap**: To make the built-in Micro Sprint preset select/drift logic testable, the `quick-chores` option must be added to the `#sprint-presets` select in `index.html`.

## 3. Caveats
*   We did not analyze the main-process-side timer engine since preset selection and drift detection are entirely client-side concerns in the renderer process.
*   We assume that the built-in preset configurations do not change dynamically at runtime.

## 4. Conclusion
The Visual Preset "Update" Button (R3) is highly feasible and can be cleanly integrated into the existing vanilla JS files (`pomo-timer.js`, `micro-sprint.js`, and `repeating.js`) and `index.html` by:
1.  Adding event hooks on all relevant config inputs.
2.  Styling the existing save buttons dynamically depending on drift detection status.
3.  Intercepting the save button click events when in update mode to execute local state updates and storage persistence.

## 5. Verification Method
*   **Manual Verification**:
    1.  Open Fokus application, select a preset (e.g. `Deep Work`).
    2.  Change any phase duration or repeat cycle. Verify the "Save Preset" button turns green and displays "Update".
    3.  Click "Update". Verify the button turns back to "Save Preset" and the preset dropdown is set to the custom preset option with the changes saved.
*   **Automated Verification**:
    *   Run `npm test` to verify the existing E2E test suites pass successfully.
    *   Write new Playwright tests in `tests/e2e` targeting each of the three timer screens, mimicking option select, input modification, checking the "Update" button visibility/styling, clicking update, and confirming the persistent store values.
