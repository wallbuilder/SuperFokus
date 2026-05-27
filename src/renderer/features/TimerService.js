import { ipcRenderer } from '../utils/ipc.js';
import { playChime } from '../utils/audio.js';
import { store } from '../utils/storage.js';
import { sharedState } from '../utils/state.js';
import { showOSNotification } from '../utils/notifications.js';
import { customAlert } from '../ui/modals.js';
import { recordFocusSession } from '../utils/stats.js';
import { formatTime as uiFormatTime, setInputsLocked, toggleStartStopButton, escapeHtml } from '../utils/ui-helpers.js';

/**
 * Unified Timer Service (Renderer)
 * Consolidates state, IPC handling, and logic for all timer types:
 * - Pomo Style
 * - Repeating Reminders
 * - Micro-Task Sprints
 * - Flow State Stopwatch
 */

// --- Centralized State ---
export const timerState = {
    pomo: {
        pomoSequence: [
            { type: 'work', duration: 25 },
            { type: 'break', duration: 5 }
        ],
        isPomoRunning: false,
        isPomoPaused: false,
        pomoTimer: 0,
        currentPhaseIndex: 0,
        currentRepeatCount: 0,
        totalRepeatsPlanned: 1,
        activePomoSequence: []
    },
    repeating: {
        repeatingTimer: 0,
        currentRounds: 0,
        isRepeatingRunning: false,
        isRepeatingPaused: false,
        currentRepeatingTotalSeconds: 0
    },
    sprint: {
        isSprintRunning: false,
        sprintTasks: [],
        currentSprintTaskIndex: 0,
        sprintTimerSeconds: 0,
        sprintDurationSeconds: 0
    },
    flow: {
        isFlowRunning: false,
        flowStartTime: 0,
        currentFlowElapsed: 0,
        totalChimeIntervalSeconds: 0,
        nextChimeSeconds: 0
    }
};

// --- DOM References ---
const pomoUI = {
    startBtn: document.getElementById('start-pomo-btn'),
    pauseBtn: document.getElementById('pause-pomo-btn'),
    continueBtn: document.getElementById('continue-pomo-btn'),
    presetsSelect: document.getElementById('pomo-presets'),
    repeatsInput: document.getElementById('pomo-repeats'),
    infiniteCheckbox: document.getElementById('pomo-infinite'),
    autostartCheckbox: document.getElementById('pomo-autostart'),
    timerDisplay: document.getElementById('pomo-timer-display'),
    timeLeft: document.getElementById('pomo-time-left'),
    statusText: document.getElementById('pomo-status-text'),
    roundsLeft: document.getElementById('pomo-rounds-left'),
    sequenceList: document.getElementById('pomo-sequence-list')
};

const repeatingUI = {
    startBtn: document.getElementById('start-repeating-btn'),
    pauseBtn: document.getElementById('pause-repeating-btn'),
    presetsSelect: document.getElementById('repeating-presets'),
    intervalInput: document.getElementById('reminder-interval'),
    intervalSecsInput: document.getElementById('reminder-interval-seconds'),
    roundsInput: document.getElementById('reminder-rounds'),
    infiniteCheckbox: document.getElementById('infinite-rounds'),
    messageInput: document.getElementById('reminder-message'),
    autocloseInput: document.getElementById('reminder-autoclose'),
    timerDisplay: document.getElementById('repeating-timer-display'),
    timeLeft: document.getElementById('repeating-time-left'),
    roundsLeft: document.getElementById('repeating-rounds-left')
};

const sprintUI = {
    startBtn: document.getElementById('start-sprint-btn'),
    stopBtn: document.getElementById('stop-sprint-btn'),
    nextBtn: document.getElementById('next-sprint-btn'),
    skipBtn: document.getElementById('skip-sprint-btn'),
    presetsSelect: document.getElementById('sprint-presets'),
    durationSelect: document.getElementById('sprint-duration'),
    tasksInput: document.getElementById('sprint-tasks'),
    autostartCheckbox: document.getElementById('sprint-autostart'),
    timerDisplay: document.getElementById('sprint-timer-display'),
    timeLeft: document.getElementById('sprint-time-left'),
    currentTask: document.getElementById('sprint-current-task'),
    tasksLeft: document.getElementById('sprint-tasks-left'),
    customDurationInput: document.getElementById('custom-sprint-duration')
};

const flowUI = {
    startBtn: document.getElementById('start-flow-btn'),
    stopBtn: document.getElementById('stop-flow-btn'),
    chimeIntervalInput: document.getElementById('flow-chime-interval'),
    chimeIntervalSecsInput: document.getElementById('flow-chime-interval-seconds'),
    timerDisplay: document.getElementById('flow-timer-display'),
    timeElapsed: document.getElementById('flow-time-elapsed')
};

// --- Initialization ---
export async function initTimerService() {
    console.log('[TimerService] Initializing unified timer service...');
    
    // Load Presets and Preferences
    const [pomoPresets, repeatingPresets, sprintPresets, sprintAutostart] = await Promise.all([
        store.get('customPomoPresets', {}),
        store.get('repeatingPresets', {}),
        store.get('sprintPresets', {}),
        store.get('sprintAutostart', false)
    ]);

    // Initialize UI Modules
    initPomoUI(pomoPresets);
    initRepeatingUI(repeatingPresets);
    initSprintUI(sprintPresets, sprintAutostart);
    initFlowUI();
    
    // Register Global Listeners
    setupGlobalListeners();
}

function setupGlobalListeners() {
    ipcRenderer.on('timer-tick', (batchedTicks) => {
        batchedTicks.forEach(tick => {
            switch(tick.id) {
                case 'pomo': handlePomoTick(tick); break;
                case 'repeating': handleRepeatingTick(tick); break;
                case 'sprint': handleSprintTick(tick); break;
                case 'flow': handleFlowTick(tick); break;
            }
        });
    });

    ipcRenderer.on('timer-event', (payload) => {
        switch(payload.type) {
            case 'pomo': handlePomoEvent(payload); break;
            case 'repeating': handleRepeatingEvent(payload); break;
            case 'sprint': handleSprintEvent(payload); break;
            case 'flow': handleFlowEvent(payload); break;
        }
    });

    ipcRenderer.on('request-initial-timer-update', (type) => {
        if (type === 'pomo' && timerState.pomo.isPomoRunning) updatePomoDisplay(true);
        if (type === 'sprint' && timerState.sprint.isSprintRunning) updateSprintDisplay();
        if (type === 'flow' && timerState.flow.isFlowRunning) updateFlowDisplay(timerState.flow.currentFlowElapsed);
    });

    ipcRenderer.on('pause-timer-from-dock', (id) => pauseTimer(id));
    ipcRenderer.on('start-flow-state-from-dock', () => { if (!timerState.flow.isFlowRunning) startFlow(); });
    
    // Unified popup closure handling
    ipcRenderer.on('popup-closed', () => {
        if (timerState.pomo.isPomoRunning) stopPomo();
        if (timerState.flow.isFlowRunning) stopFlow();
    });

    ipcRenderer.on('start-next-phase', () => {
        if (sharedState.isWorkflowRunning) {
            ipcRenderer.send('stop-timer', 'workflow-break');
            ipcRenderer.send('close-popup');
            ipcRenderer.send('close-fullscreen');
            ipcRenderer.send('close-timer-window');
            setTimeout(() => { if (typeof sharedState.triggerNextWorkflowBlock === 'function') sharedState.triggerNextWorkflowBlock(); }, 500);
        } else {
            ipcRenderer.send('stop-timer', 'pomo');
            handlePomoPhaseEnd();
        }
    });
}

// --- Pomo Logic ---
function initPomoUI(customPresets) {
    updatePomoPresetOptions(customPresets);
    renderPomoSequence();
    
    if (pomoUI.presetsSelect) {
        pomoUI.presetsSelect.addEventListener('change', (e) => handlePomoPresetChange(e.target.value, customPresets));
    }

    if (pomoUI.startBtn) {
        pomoUI.startBtn.addEventListener('click', () => {
            if (!timerState.pomo.isPomoRunning) startPomo();
            else {
                stopPomo();
                if (sharedState.isWorkflowRunning) {
                    const stopWf = document.getElementById('stop-workflow-btn');
                    if (stopWf) stopWf.click();
                }
            }
        });
    }

    if (pomoUI.sequenceList) {
        pomoUI.sequenceList.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            if (idx === null) return;
            if (e.target.tagName === 'INPUT') {
                let val = parseInt(e.target.value, 10) || 1;
                const unitSelect = pomoUI.sequenceList.querySelector(`select[data-index="${idx}"]`);
                if (unitSelect && unitSelect.value === 'secs' && val >= 60) {
                    val = 59;
                    e.target.value = val;
                }
                updatePomoSequenceDuration(idx, val);
            } else if (e.target.tagName === 'SELECT') {
                const newUnit = e.target.value;
                updatePomoSequenceDuration(idx, undefined, newUnit);
                if (newUnit === 'secs') {
                    const input = pomoUI.sequenceList.querySelector(`input[data-index="${idx}"]`);
                    if (input) {
                        let val = parseInt(input.value, 10) || 1;
                        if (val >= 60) {
                            val = 59;
                            input.value = val;
                            updatePomoSequenceDuration(idx, val);
                        }
                    }
                }
            }
        });
        pomoUI.sequenceList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn')) {
                const idx = e.target.getAttribute('data-index');
                if (idx !== null) { timerState.pomo.pomoSequence.splice(idx, 1); renderPomoSequence(); }
            }
        });
    }
    
    const addWorkBtn = document.getElementById('add-work-btn');
    if (addWorkBtn) addWorkBtn.addEventListener('click', () => { timerState.pomo.pomoSequence.push({ type: 'work', duration: 25 }); renderPomoSequence(); });
    const addBreakBtn = document.getElementById('add-break-btn');
    if (addBreakBtn) addBreakBtn.addEventListener('click', () => { timerState.pomo.pomoSequence.push({ type: 'break', duration: 5 }); renderPomoSequence(); });

    const deleteBtn = document.getElementById('delete-pomo-preset-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
        const val = pomoUI.presetsSelect ? pomoUI.presetsSelect.value : '';
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete customPresets[key];
                store.set('customPomoPresets', customPresets);
                updatePomoPresetOptions(customPresets);
                if (pomoUI.presetsSelect) {
                    pomoUI.presetsSelect.value = 'custom';
                    pomoUI.presetsSelect.dispatchEvent(new Event('change'));
                }
            }
        }
    });

    const saveBtn = document.getElementById('save-pomo-preset-btn');
    const saveContainer = document.getElementById('save-preset-container');
    const nameInput = document.getElementById('preset-name-input');
    const confirmBtn = document.getElementById('confirm-save-preset-btn');
    const cancelBtn = document.getElementById('cancel-save-preset-btn');

    if (saveBtn && saveContainer) {
        saveBtn.addEventListener('click', () => {
            if (timerState.pomo.pomoSequence.length === 0) { customAlert('Add phases to sequence before saving.'); return; }
            saveContainer.style.display = 'flex';
            if (nameInput) nameInput.focus();
        });
    }

    if (confirmBtn && saveContainer && nameInput) {
        confirmBtn.addEventListener('click', () => {
            const name = nameInput.value;
            if (name && name.trim()) {
                const repeats = pomoUI.repeatsInput ? pomoUI.repeatsInput.value : 1;
                customPresets[name.trim()] = { sequence: JSON.parse(JSON.stringify(timerState.pomo.pomoSequence)), repeats: repeats };
                store.set('customPomoPresets', customPresets);
                updatePomoPresetOptions(customPresets);
                if (pomoUI.presetsSelect) pomoUI.presetsSelect.value = `custom-preset-${name.trim()}`;
                nameInput.value = '';
                saveContainer.style.display = 'none';
            }
        });
    }

    if (cancelBtn && saveContainer && nameInput) cancelBtn.addEventListener('click', () => { nameInput.value = ''; saveContainer.style.display = 'none'; });

    document.addEventListener('click', (e) => { if (e.target.id === 'pause-pomo-btn') pauseTimer('pomo'); });
    if (pomoUI.continueBtn) pomoUI.continueBtn.addEventListener('click', startPomoPhase);
}

function updatePomoSequenceDuration(idx, val, unit) {
    if (idx >= 0 && idx < timerState.pomo.pomoSequence.length) {
        if (val !== undefined) timerState.pomo.pomoSequence[idx].duration = val;
        if (unit !== undefined) timerState.pomo.pomoSequence[idx].unit = unit;
    }
}

function handlePomoTick(tick) {
    timerState.pomo.pomoTimer = tick.remaining;
    updatePomoDisplay(true);
}

function handlePomoEvent(payload) {
    switch(payload.event) {
        case 'paused': timerState.pomo.pomoTimer = payload.data; updatePomoDisplay(); break;
        case 'stopped': timerState.pomo.pomoTimer = 0; updatePomoDisplay(); break;
        case 'complete': handlePomoPhaseEnd(); break;
    }
}

export function startPomo() {
    if (timerState.pomo.isPomoRunning) return;
    if (timerState.pomo.pomoSequence.length === 0) { customAlert('Add phases first.'); return; }

    timerState.pomo.activePomoSequence = [];
    timerState.pomo.pomoSequence.forEach(phase => {
        const phaseSecs = phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
        const last = timerState.pomo.activePomoSequence[timerState.pomo.activePomoSequence.length - 1];
        if (last && last.type === phase.type) last.totalSeconds += phaseSecs;
        else timerState.pomo.activePomoSequence.push({ type: phase.type, totalSeconds: phaseSecs });
    });

    timerState.pomo.totalRepeatsPlanned = pomoUI.repeatsInput ? (parseInt(pomoUI.repeatsInput.value, 10) || 1) : 1;
    timerState.pomo.isPomoRunning = true;
    timerState.pomo.isPomoPaused = false;
    timerState.pomo.currentPhaseIndex = 0;
    timerState.pomo.currentRepeatCount = 0;
    
    toggleStartStopButton(pomoUI.startBtn);
    setInputsLocked('config-pomo-style', true);
    if (pomoUI.timerDisplay) pomoUI.timerDisplay.classList.remove('hidden');
    if (pomoUI.pauseBtn) { pomoUI.pauseBtn.style.display = 'block'; pomoUI.pauseBtn.innerText = 'Pause \u23F8'; }
    ipcRenderer.send('open-timer-window', 'pomo');
    startPomoPhase();
}

function startPomoPhase() {
    const { pomo } = timerState;
    if (pomo.currentPhaseIndex >= pomo.activePomoSequence.length) {
        pomo.currentRepeatCount++;
        const isInfinite = pomoUI.infiniteCheckbox && pomoUI.infiniteCheckbox.checked;
        if (isInfinite || pomo.currentRepeatCount < pomo.totalRepeatsPlanned) pomo.currentPhaseIndex = 0;
        else { stopPomo(); return; }
    }

    if (pomoUI.continueBtn) pomoUI.continueBtn.style.display = 'none';
    const currentPhase = pomo.activePomoSequence[pomo.currentPhaseIndex];
    pomo.pomoTimer = currentPhase.totalSeconds;
    updatePomoDisplay();
    ipcRenderer.send('start-timer', { id: 'pomo', seconds: pomo.pomoTimer, durationSeconds: pomo.pomoTimer });

    if (currentPhase.type === 'break') {
        const actionEl = document.querySelector('input[name="pomo-action"]:checked');
        const action = actionEl ? actionEl.value : 'block';
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', duration: currentPhase.totalSeconds, 
            fullScreen: (action === 'block'), autoStart: pomoUI.autostartCheckbox ? pomoUI.autostartCheckbox.checked : false
        });
    }
}

function handlePomoPhaseEnd() {
    const { pomo } = timerState;
    const finishedPhase = pomo.activePomoSequence[pomo.currentPhaseIndex];
    const isInfinite = pomoUI.infiniteCheckbox && pomoUI.infiniteCheckbox.checked;
    
    if (pomo.currentPhaseIndex >= pomo.activePomoSequence.length - 1 && !isInfinite && pomo.currentRepeatCount + 1 >= pomo.totalRepeatsPlanned) {
        playChime('session-complete'); showOSNotification('end'); stopPomo();
        if (sharedState.isWorkflowRunning) setTimeout(() => { if (typeof sharedState.triggerNextWorkflowBlock === 'function') sharedState.triggerNextWorkflowBlock(); }, 500);
        return;
    } else {
        if (finishedPhase.type === 'work') { playChime('break-start'); showOSNotification('end'); recordFocusSession(Math.round(finishedPhase.totalSeconds / 60), 'Pomo Work'); }
        else { playChime('session-start'); showOSNotification('start'); }
    }

    ipcRenderer.send('close-popup'); ipcRenderer.send('close-fullscreen');
    pomo.currentPhaseIndex++;
    if (pomoUI.autostartCheckbox && pomoUI.autostartCheckbox.checked) startPomoPhase();
    else { pomo.pomoTimer = 0; updatePomoDisplay(); if (pomoUI.continueBtn) pomoUI.continueBtn.style.display = 'block'; }
}

export function stopPomo() {
    timerState.pomo.isPomoRunning = false; timerState.pomo.isPomoPaused = false;
    ipcRenderer.send('stop-timer', 'pomo');
    toggleStartStopButton(pomoUI.startBtn); setInputsLocked('config-pomo-style', false);
    if (pomoUI.timerDisplay) pomoUI.timerDisplay.classList.add('hidden');
    if (pomoUI.continueBtn) pomoUI.continueBtn.style.display = 'none';
    if (pomoUI.pauseBtn) { pomoUI.pauseBtn.style.display = 'none'; pomoUI.pauseBtn.innerText = 'Pause \u23F8'; }
    ipcRenderer.send('close-timer-window'); ipcRenderer.send('close-popup'); ipcRenderer.send('close-fullscreen');
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updatePomoDisplay(notifyWindow = false) {
    const { pomo } = timerState;
    if (pomoUI.timeLeft) pomoUI.timeLeft.innerText = formatTime(pomo.pomoTimer);
    const currentPhase = pomo.isPomoRunning ? pomo.activePomoSequence[pomo.currentPhaseIndex] : pomo.pomoSequence[0];
    const status = currentPhase ? (currentPhase.type === 'work' ? 'Work Session' : 'Break Time') : 'Finished';
    if (pomoUI.statusText) pomoUI.statusText.innerText = status;
    
    const nextIdx = pomo.currentPhaseIndex + 1;
    let nextText = '--';
    const sourceSeq = pomo.isPomoRunning ? pomo.activePomoSequence : pomo.pomoSequence;
    
    if (nextIdx < sourceSeq.length) {
        const next = sourceSeq[nextIdx];
        const secs = next.totalSeconds || (next.duration * (next.unit === 'secs' ? 1 : 60));
        nextText = `${next.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(secs)})`;
    } else if ((pomoUI.infiniteCheckbox && pomoUI.infiniteCheckbox.checked) || pomo.currentRepeatCount + 1 < pomo.totalRepeatsPlanned) {
        const first = sourceSeq[0];
        const secs = first.totalSeconds || (first.duration * (first.unit === 'secs' ? 1 : 60));
        nextText = `Repeat: ${first.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(secs)})`;
    } else nextText = 'Finish';
    if (pomoUI.roundsLeft) pomoUI.roundsLeft.innerText = `Next: ${nextText}`;

    if (notifyWindow) {
        const total = currentPhase ? (currentPhase.totalSeconds || (currentPhase.duration * (currentPhase.unit === 'secs' ? 1 : 60))) : 1;
        ipcRenderer.send('update-timer-window', { phase: status, timeLeft: formatTime(pomo.pomoTimer), percent: (pomo.pomoTimer / total) * 100 });
    }
}

function formatPhaseDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60); const s = totalSeconds % 60;
    if (m > 0 && s > 0) return `${m}m ${s}s`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
}

function updatePomoPresetOptions(customPresets) {
    if (!pomoUI.presetsSelect) return;
    Array.from(pomoUI.presetsSelect.options).forEach(opt => { if (opt.value.startsWith('custom-preset-')) pomoUI.presetsSelect.removeChild(opt); });
    Object.keys(customPresets).forEach(key => {
        const opt = document.createElement('option'); opt.value = `custom-preset-${key}`; opt.textContent = `Custom: ${key}`; pomoUI.presetsSelect.appendChild(opt);
    });
}

function handlePomoPresetChange(val, customPresets) {
    if (val === 'deep-work') timerState.pomo.pomoSequence = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
    else if (val === 'quick-study') timerState.pomo.pomoSequence = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
    else if (val === 'homework') timerState.pomo.pomoSequence = [{ type: 'work', duration: 45 }, { type: 'break', duration: 15 }];
    else if (val.startsWith('custom-preset-')) {
        const key = val.replace('custom-preset-', '');
        if (customPresets[key]) {
            timerState.pomo.pomoSequence = JSON.parse(JSON.stringify(customPresets[key].sequence || customPresets[key]));
            if (customPresets[key].repeats !== undefined && pomoUI.repeatsInput) pomoUI.repeatsInput.value = customPresets[key].repeats;
        }
    }
    renderPomoSequence();
}

function renderPomoSequence() {
    if (!pomoUI.sequenceList) return;
    pomoUI.sequenceList.innerHTML = '';
    timerState.pomo.pomoSequence.forEach((item, index) => {
        const div = document.createElement('div'); div.className = 'sequence-item';
        div.innerHTML = `<span>${item.type === 'work' ? 'Work' : 'Break'} Phase</span><div style="display: flex; align-items: center;"><input type="number" min="1" value="${item.duration}" data-index="${index}" style="width: 90px;"><select data-index="${index}" style="margin-left: 5px; width: 70px; padding: 5px;"><option value="mins" ${item.unit === 'mins' ? 'selected' : ''}>mins</option><option value="secs" ${item.unit === 'secs' ? 'selected' : ''}>secs</option></select><button class="remove-btn" data-index="${index}" style="margin-left: 10px;">X</button></div>`;
        pomoUI.sequenceList.appendChild(div);
    });
}

// --- Repeating Logic ---
function initRepeatingUI(presets) {
    updateRepeatingPresetOptions(presets);
    if (repeatingUI.infiniteCheckbox) {
        repeatingUI.infiniteCheckbox.addEventListener('change', (e) => {
            const roundsContainer = document.getElementById('rounds-container'); const status = document.getElementById('infinite-status');
            if (e.target.checked) { if (roundsContainer) roundsContainer.classList.add('hidden'); if (status) status.style.display = 'block'; }
            else { if (roundsContainer) roundsContainer.classList.remove('hidden'); if (status) status.style.display = 'none'; }
        });
    }

    if (repeatingUI.startBtn) {
        repeatingUI.startBtn.addEventListener('click', () => {
            if (!timerState.repeating.isRepeatingRunning) startRepeating();
            else { stopRepeating(); if (sharedState.isWorkflowRunning) document.getElementById('stop-workflow-btn')?.click(); }
        });
    }

    if (repeatingUI.presetsSelect) repeatingUI.presetsSelect.addEventListener('change', (e) => handleRepeatingPresetChange(e.target.value, presets));

    const deleteBtn = document.getElementById('delete-repeating-preset-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
        const val = repeatingUI.presetsSelect ? repeatingUI.presetsSelect.value : '';
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Delete preset "${escapeHtml(key)}"?`)) {
                delete presets[key]; store.set('repeatingPresets', presets); updateRepeatingPresetOptions(presets);
                if (repeatingUI.presetsSelect) {
                    repeatingUI.presetsSelect.value = 'custom';
                    repeatingUI.presetsSelect.dispatchEvent(new Event('change'));
                }
            }
        }
    });

    const saveBtn = document.getElementById('save-repeating-preset-btn');
    const container = document.getElementById('save-repeating-preset-container');
    const nameInput = document.getElementById('repeating-preset-name-input');
    const confirmBtn = document.getElementById('confirm-save-repeating-preset-btn');
    const cancelBtn = document.getElementById('cancel-save-repeating-preset-btn');

    if (saveBtn && container) saveBtn.addEventListener('click', () => { if (repeatingUI.infiniteCheckbox && repeatingUI.infiniteCheckbox.checked) { customAlert("No infinite presets."); return; } container.style.display = 'flex'; if (nameInput) nameInput.focus(); });
    if (confirmBtn && container && nameInput) confirmBtn.addEventListener('click', () => {
        const name = nameInput.value;
        if (name && name.trim()) {
            presets[name.trim()] = {
                intervalMins: repeatingUI.intervalInput ? repeatingUI.intervalInput.value : 0,
                intervalSecs: repeatingUI.intervalSecsInput ? repeatingUI.intervalSecsInput.value : 0,
                rounds: repeatingUI.roundsInput ? repeatingUI.roundsInput.value : 5,
                message: repeatingUI.messageInput ? repeatingUI.messageInput.value : ''
            };
            store.set('repeatingPresets', presets); updateRepeatingPresetOptions(presets);
            if (repeatingUI.presetsSelect) repeatingUI.presetsSelect.value = `custom-preset-${name.trim()}`;
            nameInput.value = ''; container.style.display = 'none';
        }
    });
    if (cancelBtn && container && nameInput) cancelBtn.addEventListener('click', () => { nameInput.value = ''; container.style.display = 'none'; });
    document.addEventListener('click', (e) => { if (e.target.closest('#pause-repeating-btn')) pauseTimer('repeating'); });
}

function handleRepeatingPresetChange(val, presets) {
    const delBtn = document.getElementById('delete-repeating-preset-btn');
    if (delBtn) delBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
    if (val === 'concentration') { if (repeatingUI.intervalInput) repeatingUI.intervalInput.value = 0; if (repeatingUI.intervalSecsInput) repeatingUI.intervalSecsInput.value = 30; if (repeatingUI.roundsInput) repeatingUI.roundsInput.value = 5; if (repeatingUI.messageInput) repeatingUI.messageInput.value = "Stay focused!"; }
    else if (val === 'high-intensity') { if (repeatingUI.intervalInput) repeatingUI.intervalInput.value = 0; if (repeatingUI.intervalSecsInput) repeatingUI.intervalSecsInput.value = 20; if (repeatingUI.roundsInput) repeatingUI.roundsInput.value = 10; if (repeatingUI.messageInput) repeatingUI.messageInput.value = "Push!"; }
    else if (val === 'quick-work') { if (repeatingUI.intervalInput) repeatingUI.intervalInput.value = 1; if (repeatingUI.intervalSecsInput) repeatingUI.intervalSecsInput.value = 0; if (repeatingUI.roundsInput) repeatingUI.roundsInput.value = 5; if (repeatingUI.messageInput) repeatingUI.messageInput.value = "Stay on task."; }
    else if (val.startsWith('custom-preset-')) {
        const key = val.replace('custom-preset-', '');
        if (presets[key]) {
            const d = presets[key];
            if (repeatingUI.intervalInput) repeatingUI.intervalInput.value = d.intervalMins || 0;
            if (repeatingUI.intervalSecsInput) repeatingUI.intervalSecsInput.value = d.intervalSecs || 0;
            if (repeatingUI.roundsInput) repeatingUI.roundsInput.value = d.rounds || 5;
            if (repeatingUI.messageInput) repeatingUI.messageInput.value = d.message || '';
        }
    }
}

function handleRepeatingTick(tick) { timerState.repeating.repeatingTimer = tick.remaining; updateRepeatingDisplay(); }
function handleRepeatingEvent(payload) {
    switch(payload.event) {
        case 'paused': timerState.repeating.repeatingTimer = payload.data; updateRepeatingDisplay(); break;
        case 'stopped': timerState.repeating.repeatingTimer = 0; updateRepeatingDisplay(); break;
        case 'complete': handleRepeatingComplete(); break;
    }
}

export function startRepeating() {
    const { repeating } = timerState;
    const intervalMins = repeatingUI.intervalInput ? parseInt(repeatingUI.intervalInput.value) : 0;
    const intervalSecs = repeatingUI.intervalSecsInput ? parseInt(repeatingUI.intervalSecsInput.value) : 0;
    const total = (intervalMins * 60) + (intervalSecs || 0);
    const rounds = repeatingUI.roundsInput ? parseInt(repeatingUI.roundsInput.value) : 1;
    const isInf = repeatingUI.infiniteCheckbox ? repeatingUI.infiniteCheckbox.checked : false;
    if (total <= 0) { customAlert('Valid interval pls.'); return; }
    repeating.currentRepeatingTotalSeconds = total; repeating.isRepeatingRunning = true; repeating.isRepeatingPaused = false;
    repeating.currentRounds = isInf ? Infinity : (rounds || 1); repeating.repeatingTimer = total;
    toggleStartStopButton(repeatingUI.startBtn); setInputsLocked('config-repeating-reminders', true);
    if (repeatingUI.timerDisplay) repeatingUI.timerDisplay.classList.remove('hidden');
    if (repeatingUI.pauseBtn) { repeatingUI.pauseBtn.style.display = 'block'; repeatingUI.pauseBtn.innerText = 'Pause \u23F8'; }
    updateRepeatingDisplay(); ipcRenderer.send('start-timer', { id: 'repeating', seconds: repeating.repeatingTimer });
}

function handleRepeatingComplete() {
    const { repeating } = timerState; playChime(); showOSNotification('end');
    const msg = repeatingUI.messageInput ? repeatingUI.messageInput.value : '';
    const autoclose = repeatingUI.autocloseInput ? parseInt(repeatingUI.autocloseInput.value) : 10;
    ipcRenderer.send('show-popup', { message: msg, closeDelay: (autoclose || 10) * 1000, type: 'Repeating Reminder', isAutoclose: true });
    recordFocusSession(Math.round(repeating.currentRepeatingTotalSeconds / 60), 'Repeating Reminder');
    const isInf = repeatingUI.infiniteCheckbox ? repeatingUI.infiniteCheckbox.checked : false;
    if (!isInf) repeating.currentRounds--;
    if (repeating.currentRounds <= 0 && !isInf) {
        stopRepeating(); if (sharedState.isWorkflowRunning) setTimeout(() => sharedState.triggerNextWorkflowBlock?.(), 500);
    } else {
        repeating.repeatingTimer = repeating.currentRepeatingTotalSeconds; updateRepeatingDisplay();
        ipcRenderer.send('start-timer', { id: 'repeating', seconds: repeating.repeatingTimer });
    }
}

export function stopRepeating() {
    timerState.repeating.isRepeatingRunning = false; timerState.repeating.isRepeatingPaused = false;
    ipcRenderer.send('stop-timer', 'repeating'); toggleStartStopButton(repeatingUI.startBtn); setInputsLocked('config-repeating-reminders', false);
    if (repeatingUI.timerDisplay) repeatingUI.timerDisplay.classList.add('hidden');
    if (repeatingUI.pauseBtn) repeatingUI.pauseBtn.style.display = 'none'; ipcRenderer.send('close-popup');
}

function updateRepeatingDisplay() {
    if (repeatingUI.timeLeft) repeatingUI.timeLeft.innerText = formatTime(timerState.repeating.repeatingTimer);
    if (repeatingUI.roundsLeft) {
        const isInf = repeatingUI.infiniteCheckbox ? repeatingUI.infiniteCheckbox.checked : false;
        repeatingUI.roundsLeft.innerText = isInf ? 'Infinite rounds remaining.' : `Rounds remaining: ${timerState.repeating.currentRounds}`;
    }
}

function updateRepeatingPresetOptions(presets) {
    if (!repeatingUI.presetsSelect) return;
    Array.from(repeatingUI.presetsSelect.options).forEach(opt => { if (opt.value.startsWith('custom-preset-')) repeatingUI.presetsSelect.removeChild(opt); });
    Object.keys(presets).forEach(k => { const opt = document.createElement('option'); opt.value = `custom-preset-${k}`; opt.textContent = `Custom: ${escapeHtml(k)}`; repeatingUI.presetsSelect.appendChild(opt); });
}

// --- Sprint Logic ---
function initSprintUI(presets, autostart) {
    updateSprintPresetOptions(presets); if (sprintUI.autostartCheckbox) sprintUI.autostartCheckbox.checked = autostart;
    if (sprintUI.autostartCheckbox) sprintUI.autostartCheckbox.addEventListener('change', (e) => store.set('sprintAutostart', e.target.checked));
    if (sprintUI.durationSelect) sprintUI.durationSelect.addEventListener('change', (e) => { const c = document.getElementById('custom-sprint-duration-container'); if (c) c.style.display = (e.target.value === 'custom') ? 'block' : 'none'; });
    if (sprintUI.presetsSelect) sprintUI.presetsSelect.addEventListener('change', (e) => handleSprintPresetChange(e.target.value, presets));

    const delBtn = document.getElementById('delete-sprint-preset-btn');
    if (delBtn) delBtn.addEventListener('click', () => {
        const val = sprintUI.presetsSelect ? sprintUI.presetsSelect.value : '';
        if (val.startsWith('custom-preset-')) {
            const k = val.replace('custom-preset-', '');
            if (confirm(`Delete "${escapeHtml(k)}"?`)) {
                delete presets[k]; store.set('sprintPresets', presets); updateSprintPresetOptions(presets);
                if (sprintUI.presetsSelect) {
                    sprintUI.presetsSelect.value = 'custom';
                    sprintUI.presetsSelect.dispatchEvent(new Event('change'));
                }
            }
        }
    });

    const saveBtn = document.getElementById('save-sprint-preset-btn');
    const container = document.getElementById('save-sprint-preset-container');
    const nameInput = document.getElementById('sprint-preset-name-input');
    const confirmBtn = document.getElementById('confirm-save-sprint-preset-btn');
    const cancelBtn = document.getElementById('cancel-save-sprint-preset-btn');

    if (saveBtn && container) saveBtn.addEventListener('click', () => { container.style.display = 'flex'; if (nameInput) nameInput.focus(); });
    if (confirmBtn && container && nameInput) confirmBtn.addEventListener('click', () => {
        const n = nameInput.value;
        if (n && n.trim()) {
            presets[n.trim()] = {
                durationVal: sprintUI.durationSelect ? sprintUI.durationSelect.value : '5',
                customMins: sprintUI.customDurationInput ? sprintUI.customDurationInput.value : null,
                tasks: sprintUI.tasksInput ? sprintUI.tasksInput.value : '',
                autostart: sprintUI.autostartCheckbox ? sprintUI.autostartCheckbox.checked : false
            };
            store.set('sprintPresets', presets); updateSprintPresetOptions(presets);
            if (sprintUI.presetsSelect) sprintUI.presetsSelect.value = `custom-preset-${n.trim()}`;
            nameInput.value = ''; container.style.display = 'none';
        }
    });
    if (cancelBtn && container && nameInput) cancelBtn.addEventListener('click', () => { nameInput.value = ''; container.style.display = 'none'; });

    if (sprintUI.startBtn) sprintUI.startBtn.addEventListener('click', () => { if (!timerState.sprint.isSprintRunning) startSprint(); else { stopSprint(); document.getElementById('stop-workflow-btn')?.click(); } });
    if (sprintUI.stopBtn) sprintUI.stopBtn.addEventListener('click', () => { stopSprint(); document.getElementById('stop-workflow-btn')?.click(); });
    if (sprintUI.nextBtn) sprintUI.nextBtn.addEventListener('click', () => { timerState.sprint.currentSprintTaskIndex++; if (timerState.sprint.currentSprintTaskIndex >= timerState.sprint.sprintTasks.length) stopSprint(); else startNextSprintTask(); });
    if (sprintUI.skipBtn) sprintUI.skipBtn.addEventListener('click', () => { ipcRenderer.send('stop-timer', 'sprint'); timerState.sprint.currentSprintTaskIndex++; if (timerState.sprint.currentSprintTaskIndex >= timerState.sprint.sprintTasks.length) stopSprint(); else startNextSprintTask(); });
}

function handleSprintPresetChange(val, presets) {
    const delBtn = document.getElementById('delete-sprint-preset-btn');
    if (delBtn) delBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
    if (val === 'quick-chores') { if (sprintUI.durationSelect) sprintUI.durationSelect.value = '5'; if (sprintUI.tasksInput) sprintUI.tasksInput.value = "Clean\nEmail\nStretch"; if (sprintUI.autostartCheckbox) sprintUI.autostartCheckbox.checked = true; }
    else if (val.startsWith('custom-preset-')) {
        const k = val.replace('custom-preset-', '');
        if (presets[k]) {
            const d = presets[k];
            if (sprintUI.durationSelect) { sprintUI.durationSelect.value = d.durationVal; sprintUI.durationSelect.dispatchEvent(new Event('change')); }
            if (d.durationVal === 'custom' && sprintUI.customDurationInput) sprintUI.customDurationInput.value = d.customMins;
            if (sprintUI.tasksInput) sprintUI.tasksInput.value = d.tasks;
            if (sprintUI.autostartCheckbox) sprintUI.autostartCheckbox.checked = !!d.autostart;
        }
    }
}

function handleSprintTick(tick) { timerState.sprint.sprintTimerSeconds = tick.remaining; updateSprintDisplay(); }
function handleSprintEvent(payload) { if (payload.event === 'stopped') { timerState.sprint.sprintTimerSeconds = 0; updateSprintDisplay(); } else if (payload.event === 'complete') handleSprintComplete(); }

export function startSprint() {
    const { sprint } = timerState; if (sprint.isSprintRunning) return;
    const raw = sprintUI.tasksInput ? sprintUI.tasksInput.value.split('\n').map(t => t.trim()).filter(Boolean) : [];
    sprint.sprintTasks = raw.length > 0 ? raw : ['Unnamed Sprint'];
    sprint.currentSprintTaskIndex = 0;
    let mins = 5;
    if (sprintUI.durationSelect) {
        mins = (sprintUI.durationSelect.value === 'custom' && sprintUI.customDurationInput) ? (parseInt(sprintUI.customDurationInput.value) || 5) : (parseInt(sprintUI.durationSelect.value) || 5);
    }
    sprint.sprintDurationSeconds = mins * 60;
    sprint.isSprintRunning = true; if (sprintUI.startBtn) sprintUI.startBtn.style.display = 'none'; if (sprintUI.stopBtn) sprintUI.stopBtn.style.display = 'block';
    setInputsLocked('config-micro-sprint', true); if (sprintUI.timerDisplay) sprintUI.timerDisplay.classList.remove('hidden');
    ipcRenderer.send('open-timer-window', 'sprint'); startNextSprintTask();
}

function startNextSprintTask() {
    const { sprint } = timerState; if (sprint.currentSprintTaskIndex >= sprint.sprintTasks.length) { stopSprint(); return; }
    if (sprintUI.nextBtn) sprintUI.nextBtn.style.display = 'none'; if (sprintUI.skipBtn) sprintUI.skipBtn.style.display = 'block';
    sprint.sprintTimerSeconds = sprint.sprintDurationSeconds; updateSprintDisplay();
    ipcRenderer.send('start-timer', { id: 'sprint', seconds: sprint.sprintTimerSeconds });
}

function handleSprintComplete() {
    const { sprint } = timerState; playChime('session-complete'); showOSNotification('end'); recordFocusSession(Math.round(sprint.sprintDurationSeconds / 60), 'Micro-Task Sprint');
    const auto = sprintUI.autostartCheckbox ? sprintUI.autostartCheckbox.checked : false;
    if (auto) {
        setTimeout(() => { sprint.currentSprintTaskIndex++; if (sprint.currentSprintTaskIndex >= sprint.sprintTasks.length) stopSprint(); else startNextSprintTask(); }, 2000);
    } else { if (sprintUI.nextBtn) sprintUI.nextBtn.style.display = 'block'; if (sprintUI.skipBtn) sprintUI.skipBtn.style.display = 'block'; }
}

export function stopSprint() {
    timerState.sprint.isSprintRunning = false; ipcRenderer.send('stop-timer', 'sprint'); ipcRenderer.send('close-timer-window');
    if (sprintUI.startBtn) sprintUI.startBtn.style.display = 'block'; if (sprintUI.stopBtn) sprintUI.stopBtn.style.display = 'none'; setInputsLocked('config-micro-sprint', false);
    if (sprintUI.timerDisplay) sprintUI.timerDisplay.classList.add('hidden'); if (sprintUI.nextBtn) sprintUI.nextBtn.style.display = 'none'; if (sprintUI.skipBtn) sprintUI.skipBtn.style.display = 'none';
}

function updateSprintDisplay() {
    const { sprint } = timerState; if (sprintUI.timeLeft) sprintUI.timeLeft.innerText = formatTime(sprint.sprintTimerSeconds);
    const task = sprint.sprintTasks[sprint.currentSprintTaskIndex] || `Sprint ${sprint.currentSprintTaskIndex + 1}`;
    if (sprintUI.currentTask) sprintUI.currentTask.innerText = task;
    const rem = Math.max(0, sprint.sprintTasks.length - sprint.currentSprintTaskIndex - 1);
    if (sprintUI.tasksLeft) sprintUI.tasksLeft.innerText = `Remaining Tasks: ${rem}`;
    ipcRenderer.send('update-timer-window', { task: task, timeLeft: formatTime(sprint.sprintTimerSeconds), percent: (sprint.sprintTimerSeconds / sprint.sprintDurationSeconds) * 100, tasksLeft: rem });
}

function updateSprintPresetOptions(presets) {
    if (!sprintUI.presetsSelect) return;
    Array.from(sprintUI.presetsSelect.options).forEach(opt => { if (opt.value.startsWith('custom-preset-')) sprintUI.presetsSelect.removeChild(opt); });
    Object.keys(presets).forEach(k => { const opt = document.createElement('option'); opt.value = `custom-preset-${k}`; opt.textContent = `Custom: ${escapeHtml(k)}`; sprintUI.presetsSelect.appendChild(opt); });
}

// --- Flow Logic ---
function initFlowUI() {
    if (flowUI.startBtn) flowUI.startBtn.addEventListener('click', startFlow);
    if (flowUI.stopBtn) flowUI.stopBtn.addEventListener('click', stopFlow);
}

export function startFlow() {
    const { flow } = timerState; flow.isFlowRunning = true; if (flowUI.startBtn) flowUI.startBtn.style.display = 'none'; if (flowUI.stopBtn) flowUI.stopBtn.style.display = 'block';
    setInputsLocked('config-flow-state', true); if (flowUI.timerDisplay) flowUI.timerDisplay.classList.remove('hidden');
    flow.flowStartTime = Date.now(); flow.currentFlowElapsed = 0;
    const mins = flowUI.chimeIntervalInput ? parseInt(flowUI.chimeIntervalInput.value) : 0;
    const secs = flowUI.chimeIntervalSecsInput ? parseInt(flowUI.chimeIntervalSecsInput.value) : 0;
    flow.totalChimeIntervalSeconds = (mins * 60) + (secs || 0); flow.nextChimeSeconds = flow.totalChimeIntervalSeconds || 0;
    updateFlowDisplay(0); ipcRenderer.send('open-timer-window', 'flow'); ipcRenderer.send('start-timer', { id: 'flow', seconds: 86400 });
}

export function stopFlow() {
    const { flow } = timerState; if (!flow.isFlowRunning) return;
    flow.isFlowRunning = false; if (flowUI.startBtn) flowUI.startBtn.style.display = 'block'; if (flowUI.stopBtn) flowUI.stopBtn.style.display = 'none';
    setInputsLocked('config-flow-state', false); if (flowUI.timerDisplay) flowUI.timerDisplay.classList.add('hidden');
    ipcRenderer.send('stop-timer', 'flow'); ipcRenderer.send('close-timer-window');
    const elapsed = Math.round(flow.currentFlowElapsed / 60); if (elapsed > 0) recordFocusSession(elapsed, 'Flow State');
}

function handleFlowTick(tick) {
    const { flow } = timerState; flow.currentFlowElapsed = tick.total - tick.remaining; updateFlowDisplay(flow.currentFlowElapsed);
    if (flow.totalChimeIntervalSeconds > 0 && flow.currentFlowElapsed >= flow.nextChimeSeconds) { playChime(); flow.nextChimeSeconds += flow.totalChimeIntervalSeconds; }
}

function handleFlowEvent(payload) {}

function updateFlowDisplay(elapsed) {
    if (!flowUI.timeElapsed) return; const timeStr = formatFlowTime(elapsed); flowUI.timeElapsed.innerText = timeStr;
    ipcRenderer.send('update-timer-window', { task: 'Flow State', timeLeft: timeStr });
}

function formatFlowTime(s) {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// --- Generic API ---
export function pauseTimer(id) {
    const target = timerState[id]; if (!target) return;
    const isPaused = (id === 'pomo') ? target.isPomoPaused : (id === 'repeating') ? target.isRepeatingPaused : false;
    if (!isPaused) {
        ipcRenderer.send('pause-timer', id);
        if (id === 'pomo') { target.isPomoPaused = true; if (pomoUI.timerDisplay) pomoUI.timerDisplay.classList.add('paused'); if (pomoUI.pauseBtn) pomoUI.pauseBtn.innerText = 'Resume \u25B6\uFE0F'; }
        else if (id === 'repeating') { target.isRepeatingPaused = true; if (repeatingUI.timerDisplay) repeatingUI.timerDisplay.classList.add('paused'); if (repeatingUI.pauseBtn) repeatingUI.pauseBtn.innerText = 'Resume \u25B6\uFE0F'; }
    } else {
        ipcRenderer.send('resume-timer', id);
        if (id === 'pomo') { target.isPomoPaused = false; if (pomoUI.timerDisplay) pomoUI.timerDisplay.classList.remove('paused'); if (pomoUI.pauseBtn) pomoUI.pauseBtn.innerText = 'Pause \u23F8'; }
        else if (id === 'repeating') { target.isRepeatingPaused = false; if (repeatingUI.timerDisplay) repeatingUI.timerDisplay.classList.remove('paused'); if (repeatingUI.pauseBtn) repeatingUI.pauseBtn.innerText = 'Pause \u23F8'; }
    }
}

export function stopAllActive() {
    if (timerState.pomo.isPomoRunning) stopPomo();
    if (timerState.repeating.isRepeatingRunning) stopRepeating();
    if (timerState.sprint.isSprintRunning) stopSprint();
    if (timerState.flow.isFlowRunning) stopFlow();
}

export function setPresetAndStart(type, presetKey) {
    let select = (type === 'pomo') ? pomoUI.presetsSelect : (type === 'repeating') ? repeatingUI.presetsSelect : (type === 'sprint') ? sprintUI.presetsSelect : null;
    if (select) { select.value = presetKey; select.dispatchEvent(new Event('change')); }
    if (type === 'pomo') startPomo();
    else if (type === 'repeating') { if (repeatingUI.roundsInput) repeatingUI.roundsInput.value = 1; startRepeating(); }
    else if (type === 'sprint') startSprint();
}
