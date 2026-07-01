# R3 Visual Preset "Update" Button Analysis and Design Recommendation

This analysis covers the codebase structure, state management, UI implementation details, and proposed implementation plan for the **Visual Preset "Update" Button** requirement (R3).

---

## 1. Codebase Findings & Observations

### 1.1 Architecture & UI Clarification
Although the project description mentions an "Electron + React" architecture, the Fokus timer modes analyzed are actually implemented using **Vanilla JavaScript DOM manipulation** inside the Electron renderer process. There are no React components used for the Pomo Timer, Micro Sprint, or Repeating Reminders views; they interact directly with elements defined in `index.html`.

### 1.2 Component and File Mapping
The core functionality is located in the following files:
*   **Pomo Timer**:
    *   **Logic & State**: `src/renderer/features/pomo-timer.js`
    *   **DOM Structure**: `index.html` (lines 1674–1746)
*   **Micro Sprint**:
    *   **Logic & State**: `src/renderer/features/micro-sprint.js`
    *   **DOM Structure**: `index.html` (lines 1750–1805)
*   **Repeating Reminders**:
    *   **Logic & State**: `src/renderer/features/repeating.js`
    *   **DOM Structure**: `index.html` (lines 1600–1672)

---

## 2. Detailed Preset Analysis

### 2.1 Pomo Timer Presets
*   **Built-in Options**:
    *   `deep-work`: 1 work phase (50m), 1 break phase (10m)
    *   `quick-study`: 1 work phase (25m), 1 break phase (5m)
    *   `homework`: 1 work phase (45m), 1 break phase (15m)
*   **Custom Presets**:
    *   Stored in `electron-store` under the key `customPomoPresets`.
    *   Format: `{ sequence: Array<{type, duration, unit}>, repeats: string | number }`.
*   **Input Elements to Track**:
    *   `pomoState.pomoSequence` (monitored via changes to phases).
    *   `#pomo-repeats` input value.

### 2.2 Micro Sprint Presets
*   **Built-in Options**:
    *   `quick-chores`: durationVal: `'5'`, customMins: `null`, tasks: `"Clean desk\nCheck email\nStretch"`, autostart: `true`.
    *   *Note: There is a bug in the current HTML select menu (`#sprint-presets`) in `index.html` where the `quick-chores` option is missing entirely, despite being fully handled in `micro-sprint.js` lines 89–95. This option should be added to `index.html`.*
*   **Custom Presets**:
    *   Stored in `electron-store` under the key `sprintPresets`.
    *   Format: `{ durationVal, customMins, tasks, autostart }`.
*   **Input Elements to Track**:
    *   `#sprint-duration` select value.
    *   `#custom-sprint-duration` number input value (if custom duration active).
    *   `#sprint-tasks` textarea value.
    *   `#sprint-autostart` checkbox check state.

### 2.3 Repeating Reminders Presets
*   **Built-in Options**:
    *   `concentration`: intervalMins: `0`, intervalSecs: `30`, rounds: `5`, message: `"Stay focused! Keep up the concentration."`, popupsCount: `1`
    *   `high-intensity`: intervalMins: `0`, intervalSecs: `20`, rounds: `10`, message: `"High-intensity work! Push through!"`, popupsCount: `1`
    *   `quick-work`: intervalMins: `1`, intervalSecs: `0`, rounds: `5`, message: `"Quick work sprint. Stay on task."`, popupsCount: `1`
*   **Custom Presets**:
    *   Stored in `electron-store` under the key `repeatingPresets`.
    *   Format: `{ intervalMins, intervalSecs, rounds, message, popupsCount }`.
*   **Input Elements to Track**:
    *   `#reminder-interval` number input.
    *   `#reminder-interval-seconds` number input.
    *   `#reminder-rounds` number input.
    *   `#reminder-message` text input.
    *   `#reminder-popups-count` select value.

---

## 3. Design Recommendation

We recommend adding event listeners to track changes in all configuration fields. A general comparison function `checkPresetDeviation()` will run on input/change events for each mode, comparing current values against the active preset.

### 3.1 Button Rendering and Styling (Update vs Save)
We can utilize the existing "Save Preset" buttons (`#save-pomo-preset-btn`, `#save-sprint-preset-btn`, `#save-repeating-preset-btn`) and dynamically alter their style and content:
*   **Save Mode**: Revert inline styling to standard gradient `background: var(--header-grad-1)` and text to `"Save Preset"`. Remove `.update-mode` class.
*   **Update Mode** (when drift is detected and select value $\neq$ `'custom'`): Set background style to green (`#27ae60`), text to `"Update"`, and add `.update-mode` class.

### 3.2 In-Place Update and Save-as-New logic
Upon clicking the save button:
1.  Check if the button has the class `.update-mode`.
2.  If `.update-mode` is **absent**, perform the original "Save Preset" dialog flow.
3.  If `.update-mode` is **present**:
    *   Retrieve the active preset key from the select dropdown.
    *   **If the active preset is Custom** (starts with `custom-preset-`):
        *   Extract the preset name.
        *   Save the current configuration values to the preset name key in-place.
        *   Persist to `electron-store` via `store.set(...)`.
        *   Recheck deviation (which resets the button back to Save Preset).
    *   **If the active preset is Built-in**:
        *   Get the text content of the selected select option (e.g. `"Deep Work - 50/10"`).
        *   Create/Overwrite a custom preset under that exact name.
        *   Persist to `electron-store`.
        *   Reload preset options to dynamically include the new custom preset.
        *   Select the newly created custom preset (e.g., `custom-preset-Deep Work - 50/10`) in the dropdown.
        *   Dispatch the dropdown `'change'` event to sync the UI state (e.g. showing delete button).
        *   Recheck deviation.

---

## 4. Proposed Code Snippets & Modifications

### Helper: Style Modifier
```javascript
function showUpdateBtn(btnElement, show) {
    if (!btnElement) return;
    if (show) {
        btnElement.style.background = '#27ae60';
        btnElement.textContent = 'Update';
        btnElement.classList.add('update-mode');
    } else {
        btnElement.style.background = 'var(--header-grad-1)';
        btnElement.textContent = 'Save Preset';
        btnElement.classList.remove('update-mode');
    }
}
```

### 4.1 Pomo Timer Modifications (`src/renderer/features/pomo-timer.js`)

1.  **UX Enhancement on Preset Selection**: Update select change listener to reset repeats and infinite rounds when built-in is selected.
2.  **Sequence Comparison Helper**:
    ```javascript
    function sequencesEqual(seq1, seq2) {
        if (!seq1 || !seq2) return false;
        if (seq1.length !== seq2.length) return false;
        for (let i = 0; i < seq1.length; i++) {
            const p1 = seq1[i];
            const p2 = seq2[i];
            if (p1.type !== p2.type) return false;
            if (p1.duration !== p2.duration) return false;
            if ((p1.unit || 'mins') !== (p2.unit || 'mins')) return false;
        }
        return true;
    }
    ```
3.  **Deviation Check**:
    ```javascript
    export function checkPomoPresetDeviation() {
        if (!pomoPresetsSelect || !savePomoPresetBtn) return;
        const val = pomoPresetsSelect.value;
        if (val === 'custom') {
            showUpdateBtn(savePomoPresetBtn, false);
            return;
        }
        let presetSeq = [];
        let presetRepeats = 1;
        
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (customPresets[key]) {
                const data = customPresets[key];
                if (Array.isArray(data)) {
                    presetSeq = data;
                    presetRepeats = 1;
                } else {
                    presetSeq = data.sequence || [];
                    presetRepeats = data.repeats || 1;
                }
            }
        } else {
            if (val === 'deep-work') {
                presetSeq = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
            } else if (val === 'quick-study') {
                presetSeq = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
            } else if (val === 'homework') {
                presetSeq = [{ type: 'work', duration: 45 }, { type: 'break', duration: 15 }];
            }
        }
        
        const currentSeq = pomoState.pomoSequence;
        const currentRepeats = pomoRepeatsInput ? pomoRepeatsInput.value : 1;
        const isDifferent = !sequencesEqual(currentSeq, presetSeq) || String(currentRepeats) !== String(presetRepeats);
        showUpdateBtn(savePomoPresetBtn, isDifferent);
    }
    ```
4.  **Save/Update Action Listener**:
    ```javascript
    if (savePomoPresetBtn) {
        savePomoPresetBtn.addEventListener('click', () => {
            if (savePomoPresetBtn.classList.contains('update-mode')) {
                const val = pomoPresetsSelect.value;
                const repeatsVal = pomoRepeatsInput ? pomoRepeatsInput.value : 1;
                let name = '';
                if (val.startsWith('custom-preset-')) {
                    name = val.replace('custom-preset-', '');
                } else {
                    name = pomoPresetsSelect.options[pomoPresetsSelect.selectedIndex].textContent.trim();
                }
                
                customPresets[name] = {
                    sequence: JSON.parse(JSON.stringify(pomoState.pomoSequence)),
                    repeats: repeatsVal
                };
                store.set('customPomoPresets', customPresets);
                
                if (!val.startsWith('custom-preset-')) {
                    updatePresetOptions();
                    pomoPresetsSelect.value = `custom-preset-${name}`;
                    pomoPresetsSelect.dispatchEvent(new Event('change'));
                }
                checkPomoPresetDeviation();
            } else {
                if (pomoState.pomoSequence.length === 0) {
                    customAlert('Add phases to sequence before saving as preset.');
                    return;
                }
                savePresetContainer.style.display = 'flex';
                presetNameInput.focus();
            }
        });
    }
    ```
5.  **Events Hook**: Call `checkPomoPresetDeviation()`:
    *   Inside `renderSequence()`.
    *   Inside `updateSequenceDuration()` after changes.
    *   Inside the change listener for `#pomo-presets`.
    *   Add an `input`/`change` event listener on `#pomo-repeats` and call it.

### 4.2 Micro Sprint Modifications (`src/renderer/features/micro-sprint.js`)

1.  **Deviation Check**:
    ```javascript
    export function checkSprintPresetDeviation() {
        if (!sprintPresetsSelect || !saveSprintPresetBtn) return;
        const val = sprintPresetsSelect.value;
        if (val === 'custom') {
            showUpdateBtn(saveSprintPresetBtn, false);
            return;
        }
        let pDurationVal = '5';
        let pCustomMins = null;
        let pTasks = '';
        let pAutostart = false;
        
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (sprintPresets[key]) {
                const data = sprintPresets[key];
                pDurationVal = data.durationVal || '5';
                pCustomMins = data.customMins || null;
                pTasks = data.tasks || '';
                pAutostart = !!data.autostart;
            }
        } else if (val === 'quick-chores') {
            pDurationVal = '5';
            pTasks = "Clean desk\nCheck email\nStretch";
            pAutostart = true;
        }
        
        const currentDurationVal = sprintDurationSelect ? sprintDurationSelect.value : '5';
        const currentCustomMins = (sprintDurationSelect && sprintDurationSelect.value === 'custom' && customSprintDurationInput) ? (parseInt(customSprintDurationInput.value, 10) || 5) : null;
        const currentTasks = sprintTasksInput ? sprintTasksInput.value : '';
        const currentAutostart = sprintAutostartCheckbox ? sprintAutostartCheckbox.checked : false;
        
        const isDifferent = currentDurationVal !== pDurationVal ||
                            (currentDurationVal === 'custom' && String(currentCustomMins) !== String(pCustomMins)) ||
                            currentTasks !== pTasks ||
                            currentAutostart !== pAutostart;
        showUpdateBtn(saveSprintPresetBtn, isDifferent);
    }
    ```
2.  **Save/Update Action Listener**:
    ```javascript
    if (saveSprintPresetBtn) {
        saveSprintPresetBtn.addEventListener('click', () => {
            if (saveSprintPresetBtn.classList.contains('update-mode')) {
                const val = sprintPresetsSelect.value;
                let name = '';
                if (val.startsWith('custom-preset-')) {
                    name = val.replace('custom-preset-', '');
                } else {
                    name = sprintPresetsSelect.options[sprintPresetsSelect.selectedIndex].textContent.trim();
                }
                sprintPresets[name] = {
                    durationVal: sprintDurationSelect ? sprintDurationSelect.value : '5',
                    customMins: (sprintDurationSelect && sprintDurationSelect.value === 'custom' && customSprintDurationInput) ? (parseInt(customSprintDurationInput.value, 10) || 20) : null,
                    tasks: sprintTasksInput ? sprintTasksInput.value : '',
                    autostart: sprintAutostartCheckbox ? sprintAutostartCheckbox.checked : false
                };
                store.set('sprintPresets', sprintPresets);
                if (!val.startsWith('custom-preset-')) {
                    updateSprintPresetOptions();
                    sprintPresetsSelect.value = `custom-preset-${name}`;
                    sprintPresetsSelect.dispatchEvent(new Event('change'));
                }
                checkSprintPresetDeviation();
            } else {
                if (saveSprintPresetContainer) saveSprintPresetContainer.style.display = 'flex';
                if (sprintPresetNameInput) sprintPresetNameInput.focus();
            }
        });
    }
    ```
3.  **Events Hook**: Call `checkSprintPresetDeviation()`:
    *   Inside the change listener for `#sprint-presets` and `#sprint-duration`.
    *   Add change/input/keyup listeners to `#custom-sprint-duration`, `#sprint-tasks`, `#sprint-autostart`.

### 4.3 Repeating Reminders Modifications (`src/renderer/features/repeating.js`)

1.  **UX Enhancement on Preset Selection**: Uncheck infinite rounds if a preset is selected (so that duration/rounds display correctly).
2.  **Deviation Check**:
    ```javascript
    export function checkRepeatingPresetDeviation() {
        if (!repeatingPresetsSelect || !saveRepeatingPresetBtn) return;
        const val = repeatingPresetsSelect.value;
        if (val === 'custom') {
            showUpdateBtn(saveRepeatingPresetBtn, false);
            return;
        }
        let pIntMins = 0, pIntSecs = 0, pRounds = 5, pMsg = '', pPopups = 1;
        
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (repeatingPresets[key]) {
                const data = repeatingPresets[key];
                pIntMins = data.intervalMins || 0;
                pIntSecs = data.intervalSecs || 0;
                pRounds = data.rounds || 5;
                pMsg = data.message || '';
                pPopups = data.popupsCount || 1;
            }
        } else {
            if (val === 'concentration') {
                pIntSecs = 30; pRounds = 5; pMsg = "Stay focused! Keep up the concentration.";
            } else if (val === 'high-intensity') {
                pIntSecs = 20; pRounds = 10; pMsg = "High-intensity work! Push through!";
            } else if (val === 'quick-work') {
                pIntMins = 1; pRounds = 5; pMsg = "Quick work sprint. Stay on task.";
            }
        }
        
        const curMins = reminderIntervalInput ? (parseInt(reminderIntervalInput.value, 10) || 0) : 0;
        const curSecs = reminderIntervalSecondsInput ? (parseInt(reminderIntervalSecondsInput.value, 10) || 0) : 0;
        const curRounds = reminderRoundsInput ? (parseInt(reminderRoundsInput.value, 10) || 5) : 5;
        const curMsg = reminderMessageInput ? reminderMessageInput.value : '';
        const curPopups = reminderPopupsCountInput ? (parseInt(reminderPopupsCountInput.value, 10) || 1) : 1;
        
        const isDifferent = curMins !== pIntMins || curSecs !== pIntSecs || curRounds !== pRounds || curMsg !== pMsg || curPopups !== pPopups;
        showUpdateBtn(saveRepeatingPresetBtn, isDifferent);
    }
    ```
3.  **Save/Update Action Listener**:
    ```javascript
    if (saveRepeatingPresetBtn) {
        saveRepeatingPresetBtn.addEventListener('click', () => {
            if (saveRepeatingPresetBtn.classList.contains('update-mode')) {
                const val = repeatingPresetsSelect.value;
                let name = '';
                if (val.startsWith('custom-preset-')) {
                    name = val.replace('custom-preset-', '');
                } else {
                    name = repeatingPresetsSelect.options[repeatingPresetsSelect.selectedIndex].textContent.trim();
                }
                repeatingPresets[name] = {
                    intervalMins: reminderIntervalInput ? (parseInt(reminderIntervalInput.value, 10) || 0) : 0,
                    intervalSecs: reminderIntervalSecondsInput ? (parseInt(reminderIntervalSecondsInput.value, 10) || 0) : 0,
                    rounds: reminderRoundsInput ? (parseInt(reminderRoundsInput.value, 10) || 5) : 5,
                    message: reminderMessageInput ? reminderMessageInput.value : '',
                    popupsCount: reminderPopupsCountInput ? (parseInt(reminderPopupsCountInput.value, 10) || 1) : 1
                };
                store.set('repeatingPresets', repeatingPresets);
                if (!val.startsWith('custom-preset-')) {
                    updateRepeatingPresetOptions();
                    repeatingPresetsSelect.value = `custom-preset-${name}`;
                    repeatingPresetsSelect.dispatchEvent(new Event('change'));
                }
                checkRepeatingPresetDeviation();
            } else {
                if (infiniteRoundsCheckbox && infiniteRoundsCheckbox.checked) {
                    customAlert("Cannot save preset with 'Infinite Rounds' enabled.");
                    return;
                }
                if (saveRepeatingPresetContainer) {
                    saveRepeatingPresetContainer.style.display = 'flex';
                    if (repeatingPresetNameInput) repeatingPresetNameInput.focus();
                }
            }
        });
    }
    ```
4.  **Events Hook**: Call `checkRepeatingPresetDeviation()`:
    *   Inside the change listener for `#repeating-presets`.
    *   Add change/input/keyup listeners to `#reminder-interval`, `#reminder-interval-seconds`, `#reminder-rounds`, `#reminder-message`, `#reminder-popups-count`, `#infinite-rounds`.

---

## 5. UI Layout Fix for Micro Sprint Preset Dropdown
In `index.html`, update the select field `#sprint-presets` to include the built-in `quick-chores` preset:
```html
<select id="sprint-presets" style="flex: 1;">
  <option value="custom">Custom</option>
  <option value="quick-chores">Quick Chores</option>
</select>
```
