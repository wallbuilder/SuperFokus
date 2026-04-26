import { ipcRenderer } from '../utils/ipc.js';
import { playChime } from '../utils/audio.js';
import { store } from '../utils/storage.js';
import { customAlert } from '../ui/modals.js';
import { recordFocusSession } from '../utils/stats.js';
import { formatTime, setInputsLocked, toggleStartStopButton } from '../utils/ui-helpers.js';
import { isWorkflowRunning, startNextWorkflowBlock } from './workflows.js';

const infiniteRoundsCheckbox = document.getElementById('infinite-rounds');
const roundsContainer = document.getElementById('rounds-container');
const infiniteStatus = document.getElementById('infinite-status');
const startRepeatingBtn = document.getElementById('start-repeating-btn');
const pauseRepeatingBtn = document.getElementById('pause-repeating-btn');
const reminderIntervalInput = document.getElementById('reminder-interval');
const reminderIntervalSecondsInput = document.getElementById('reminder-interval-seconds');
const reminderRoundsInput = document.getElementById('reminder-rounds');
const reminderMessageInput = document.getElementById('reminder-message');
const reminderAutocloseInput = document.getElementById('reminder-autoclose');
const repeatingTimerDisplay = document.getElementById('repeating-timer-display');
const repeatingTimeLeft = document.getElementById('repeating-time-left');
const repeatingRoundsLeft = document.getElementById('repeating-rounds-left');

let repeatingTimer = 0;
let currentRounds = 0;
export let isRepeatingRunning = false;
let isRepeatingPaused = false;
let currentRepeatingTotalSeconds = 0;

if (infiniteRoundsCheckbox) {
    infiniteRoundsCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            roundsContainer.classList.add('hidden');
            infiniteStatus.style.display = 'block';
        } else {
            roundsContainer.classList.remove('hidden');
            infiniteStatus.style.display = 'none';
        }
    });
}

function updateRepeatingDisplay() {
    if (repeatingTimeLeft) repeatingTimeLeft.innerText = formatTime(repeatingTimer);
    if (repeatingRoundsLeft) {
        if (infiniteRoundsCheckbox && infiniteRoundsCheckbox.checked) {
            repeatingRoundsLeft.innerText = 'Infinite rounds remaining. Press Stop to exit this mode.';
        } else {
            repeatingRoundsLeft.innerText = `Rounds remaining: ${currentRounds}`;
        }
    }
}

let repeatingLocalInterval = null;
function updateLocalRepeatingTimer(endTime) {
    // Local timer removed in v0.9.2 - now synced via timer-tick IPC from main.js
}

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'repeating') {
        repeatingTimer = data.seconds;
        updateRepeatingDisplay();
    }
});

ipcRenderer.on('timer-started-repeating', (endTime) => updateLocalRepeatingTimer(endTime));
ipcRenderer.on('timer-resumed-repeating', (endTime) => updateLocalRepeatingTimer(endTime));
ipcRenderer.on('timer-paused-repeating', () => {
    if (repeatingLocalInterval) clearInterval(repeatingLocalInterval);
});
ipcRenderer.on('timer-stopped-repeating', () => {
    if (repeatingLocalInterval) clearInterval(repeatingLocalInterval);
    repeatingTimer = 0;
    updateRepeatingDisplay();
});

ipcRenderer.on('timer-complete-repeating', () => {
    playChime();
    const autocloseSecs = reminderAutocloseInput ? (parseInt(reminderAutocloseInput.value, 10) || 10) : 10;
    ipcRenderer.send('show-popup', {
        message: reminderMessageInput ? reminderMessageInput.value : '',
        closeDelay: autocloseSecs * 1000,
        type: 'Repeating Reminder',
        isAutoclose: true
    });
    recordFocusSession(Math.round(currentRepeatingTotalSeconds / 60), 'Repeating Reminder');
    
    if (infiniteRoundsCheckbox && !infiniteRoundsCheckbox.checked) {
        currentRounds--;
    }

    if (currentRounds <= 0 && (!infiniteRoundsCheckbox || !infiniteRoundsCheckbox.checked)) {
        stopRepeatingReminders();
        if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
            setTimeout(() => { if (typeof startNextWorkflowBlock === 'function') startNextWorkflowBlock(); }, 500);
        }
    } else {
        repeatingTimer = currentRepeatingTotalSeconds;
        updateRepeatingDisplay();
        ipcRenderer.send('start-timer', { id: 'repeating', seconds: repeatingTimer });
    }
});

export function startRepeatingReminders() {
    const intervalMins = parseInt(reminderIntervalInput.value, 10) || 0;
    const intervalSecs = parseInt(reminderIntervalSecondsInput.value, 10) || 0;
    const totalSeconds = (intervalMins * 60) + intervalSecs;
    const rounds = reminderRoundsInput ? parseInt(reminderRoundsInput.value, 10) : 1;
    const isInfinite = infiniteRoundsCheckbox ? infiniteRoundsCheckbox.checked : false;

    if (totalSeconds <= 0) {
        customAlert('Please enter a valid interval.');
        return;
    }
    if (!isInfinite && (isNaN(rounds) || rounds <= 0)) {
        customAlert('Please enter a valid number of rounds.');
        return;
    }

    currentRepeatingTotalSeconds = totalSeconds;
    isRepeatingRunning = true;
    isRepeatingPaused = false;
    currentRounds = isInfinite ? Infinity : rounds;
    repeatingTimer = totalSeconds;
    
    toggleStartStopButton(startRepeatingBtn);
    setInputsLocked('config-repeating-reminders', true);
    if (repeatingTimerDisplay) repeatingTimerDisplay.classList.remove('hidden');
    if (pauseRepeatingBtn) {
        pauseRepeatingBtn.style.display = 'block';
        pauseRepeatingBtn.innerText = 'Pause \u23F8';
    }
    updateRepeatingDisplay();

    ipcRenderer.send('start-timer', { id: 'repeating', seconds: repeatingTimer });
}

export function stopRepeatingReminders() {
    isRepeatingRunning = false;
    isRepeatingPaused = false;
    ipcRenderer.send('stop-timer', 'repeating');
    toggleStartStopButton(startRepeatingBtn);
    setInputsLocked('config-repeating-reminders', false);
    if (repeatingTimerDisplay) repeatingTimerDisplay.classList.add('hidden');
    if (pauseRepeatingBtn) {
        pauseRepeatingBtn.style.display = 'none';
        pauseRepeatingBtn.innerText = 'Pause \u23F8';
    }
    ipcRenderer.send('close-popup');
}

if (startRepeatingBtn) {
    startRepeatingBtn.addEventListener('click', () => {
        if (!isRepeatingRunning) {
            startRepeatingReminders();
        } else {
            stopRepeatingReminders();
            if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
                const stopWf = document.getElementById('stop-workflow-btn');
                if (stopWf) stopWf.click();
            }
        }
    });
}

// Repeating Reminders Presets
const repeatingPresetsSelect = document.getElementById('repeating-presets');
const deleteRepeatingPresetBtn = document.getElementById('delete-repeating-preset-btn');
const saveRepeatingPresetBtn = document.getElementById('save-repeating-preset-btn');
const saveRepeatingPresetContainer = document.getElementById('save-repeating-preset-container');
const repeatingPresetNameInput = document.getElementById('repeating-preset-name-input');
const confirmSaveRepeatingPresetBtn = document.getElementById('confirm-save-repeating-preset-btn');
const cancelSaveRepeatingPresetBtn = document.getElementById('cancel-save-repeating-preset-btn');

let repeatingPresets = store.get('repeatingPresets', {});

function updateRepeatingPresetOptions() {
    if (!repeatingPresetsSelect) return;
    Array.from(repeatingPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            repeatingPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(repeatingPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        repeatingPresetsSelect.appendChild(option);
    });
}
updateRepeatingPresetOptions();

if (repeatingPresetsSelect) {
    repeatingPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deleteRepeatingPresetBtn) {
            deleteRepeatingPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (repeatingPresets[key]) {
                const data = repeatingPresets[key];
                if (reminderIntervalInput) reminderIntervalInput.value = data.intervalMins || 0;
                if (reminderIntervalSecondsInput) reminderIntervalSecondsInput.value = data.intervalSecs || 0;
                if (reminderRoundsInput) reminderRoundsInput.value = data.rounds || 5;
                if (reminderMessageInput) reminderMessageInput.value = data.message || '';
            }
        }
    });
}

if (deleteRepeatingPresetBtn) {
    deleteRepeatingPresetBtn.addEventListener('click', () => {
        const val = repeatingPresetsSelect.value;
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete repeatingPresets[key];
                store.set('repeatingPresets', repeatingPresets);
                updateRepeatingPresetOptions();
                repeatingPresetsSelect.value = 'custom';
                repeatingPresetsSelect.dispatchEvent(new Event('change'));
            }
        }
    });
}

if (saveRepeatingPresetBtn) {
    saveRepeatingPresetBtn.addEventListener('click', () => {
        if (infiniteRoundsCheckbox && infiniteRoundsCheckbox.checked) {
            customAlert("Cannot save preset with 'Infinite Rounds' enabled.");
            return;
        }
        if (saveRepeatingPresetContainer) {
            saveRepeatingPresetContainer.style.display = 'flex';
            if (repeatingPresetNameInput) repeatingPresetNameInput.focus();
        }
    });
}

if (confirmSaveRepeatingPresetBtn) {
    confirmSaveRepeatingPresetBtn.addEventListener('click', () => {
        if (!repeatingPresetNameInput) return;
        const name = repeatingPresetNameInput.value;
        if (name && name.trim()) {
            repeatingPresets[name.trim()] = {
                intervalMins: reminderIntervalInput ? (parseInt(reminderIntervalInput.value, 10) || 0) : 0,
                intervalSecs: reminderIntervalSecondsInput ? (parseInt(reminderIntervalSecondsInput.value, 10) || 0) : 0,
                rounds: reminderRoundsInput ? (parseInt(reminderRoundsInput.value, 10) || 5) : 5,
                message: reminderMessageInput ? reminderMessageInput.value : ''
            };
            store.set('repeatingPresets', repeatingPresets);
            updateRepeatingPresetOptions();
            repeatingPresetsSelect.value = `custom-preset-${name.trim()}`;
            repeatingPresetNameInput.value = '';
            if (saveRepeatingPresetContainer) saveRepeatingPresetContainer.style.display = 'none';
        }
    });
}

if (cancelSaveRepeatingPresetBtn) {
    cancelSaveRepeatingPresetBtn.addEventListener('click', () => {
        if (repeatingPresetNameInput) repeatingPresetNameInput.value = '';
        if (saveRepeatingPresetContainer) saveRepeatingPresetContainer.style.display = 'none';
    });
}

export function initializeRepeatingButtonListeners() {
    // More robust pause button handling using event delegation for Repeating Reminders
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#pause-repeating-btn');
      if (btn) {
        // Allow pause/resume if timer has been started, regardless of current state
        if (!isRepeatingPaused) {
          ipcRenderer.send('pause-timer', 'repeating');
          isRepeatingPaused = true;
          const repeatingDisplay = document.getElementById('repeating-timer-display');
          if (repeatingDisplay) repeatingDisplay.classList.add('paused');
          btn.innerText = 'Resume \u25B6\uFE0F';
        } else {
          ipcRenderer.send('resume-timer', 'repeating');
          isRepeatingPaused = false;
          const repeatingDisplay = document.getElementById('repeating-timer-display');
          if (repeatingDisplay) repeatingDisplay.classList.remove('paused');
          btn.innerText = 'Pause \u23F8';
        }
      }
    });
}
