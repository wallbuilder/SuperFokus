import { ipcRenderer } from '../utils/ipc.js';
import { store } from '../utils/storage.js';
import { sharedState } from '../utils/state.js';
import { customAlert } from '../ui/modals.js';
import { playChime } from '../utils/audio.js';
import { setInputsLocked, toggleStartStopButton } from '../utils/ui-helpers.js';
import { recordFocusSession } from '../utils/stats.js';

// --- Pomo State ---
export const pomoState = {
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
};

const sequenceListEl = document.getElementById('pomo-sequence-list');
const addWorkBtn = document.getElementById('add-work-btn');
const addBreakBtn = document.getElementById('add-break-btn');

const pomoPresetsSelect = document.getElementById('pomo-presets');
const savePomoPresetBtn = document.getElementById('save-pomo-preset-btn');
const deletePomoPresetBtn = document.getElementById('delete-pomo-preset-btn');
const savePresetContainer = document.getElementById('save-preset-container');
const presetNameInput = document.getElementById('preset-name-input');
const confirmSavePresetBtn = document.getElementById('confirm-save-preset-btn');
const cancelSavePresetBtn = document.getElementById('cancel-save-preset-btn');

let customPresets = {};

export async function initPomo() {
    customPresets = await store.get('customPomoPresets', {});
    updatePresetOptions();
    renderSequence();
}

function updatePresetOptions() {
    if (!pomoPresetsSelect) return;
    // Clear existing custom presets
    Array.from(pomoPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            pomoPresetsSelect.removeChild(opt);
        }
    });
    
    Object.keys(customPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        pomoPresetsSelect.appendChild(option);
    });
}

if (pomoPresetsSelect) {
    pomoPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deletePomoPresetBtn) {
            deletePomoPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val === 'deep-work') {
            pomoState.pomoSequence = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
        } else if (val === 'quick-study') {
            pomoState.pomoSequence = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
        } else if (val === 'homework') {
            pomoState.pomoSequence = [{ type: 'work', duration: 45 }, { type: 'break', duration: 15 }];
        } else if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (customPresets[key]) {
                const data = customPresets[key];
                if (Array.isArray(data)) {
                    pomoState.pomoSequence = JSON.parse(JSON.stringify(data));
                } else if (data.sequence) {
                    pomoState.pomoSequence = JSON.parse(JSON.stringify(data.sequence));
                    if (document.getElementById('pomo-repeats')) {
                        document.getElementById('pomo-repeats').value = data.repeats || 1;
                    }
                }
            }
        }
        renderSequence();
    });
}

if (deletePomoPresetBtn) {
    deletePomoPresetBtn.addEventListener('click', () => {
        const val = pomoPresetsSelect.value;
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete customPresets[key];
                store.set('customPomoPresets', customPresets);
                updatePresetOptions();
                pomoPresetsSelect.value = 'custom';
                pomoPresetsSelect.dispatchEvent(new Event('change'));
            }
        }
    });
}

if (savePomoPresetBtn) {
    savePomoPresetBtn.addEventListener('click', () => {
        if (pomoState.pomoSequence.length === 0) {
            customAlert('Add phases to sequence before saving as preset.');
            return;
        }
        savePresetContainer.style.display = 'flex';
        presetNameInput.focus();
    });
}

if (confirmSavePresetBtn) {
    confirmSavePresetBtn.addEventListener('click', () => {
        const name = presetNameInput.value;
        if (name && name.trim()) {
            const repeatsVal = document.getElementById('pomo-repeats') ? document.getElementById('pomo-repeats').value : 1;
            customPresets[name.trim()] = {
                sequence: JSON.parse(JSON.stringify(pomoState.pomoSequence)),
                repeats: repeatsVal
            };
            store.set('customPomoPresets', customPresets);
            updatePresetOptions();
            pomoPresetsSelect.value = `custom-preset-${name.trim()}`;
            presetNameInput.value = '';
            savePresetContainer.style.display = 'none';
        }
    });
}

if (cancelSavePresetBtn) {
    cancelSavePresetBtn.addEventListener('click', () => {
        presetNameInput.value = '';
        savePresetContainer.style.display = 'none';
    });
}

ipcRenderer.on('pomo-popup-closed', () => {
    if (pomoState.isPomoRunning) {
        stopPomoStyle();
    }
});

function renderSequence() {
    if (!sequenceListEl) return;
    sequenceListEl.innerHTML = '';
    pomoState.pomoSequence.forEach((item, index) => {
        const unit = item.unit || 'mins';
        const div = document.createElement('div');
        div.className = 'sequence-item';
        div.innerHTML = `
            <span>${item.type === 'work' ? 'Work' : 'Break'} Phase</span>
            <div style="display: flex; align-items: center;">
                <input type="number" min="1" value="${item.duration}" data-index="${index}" style="width: 90px;">
                <select data-index="${index}" style="margin-left: 5px; width: 70px; padding: 5px;">
                    <option value="mins" ${unit === 'mins' ? 'selected' : ''}>mins</option>
                    <option value="secs" ${unit === 'secs' ? 'selected' : ''}>secs</option>
                </select>
                <button class="remove-btn" data-index="${index}" style="margin-left: 10px;">X</button>
            </div>
        `;
        if (sequenceListEl) sequenceListEl.appendChild(div);
    });
}

if (sequenceListEl) {
    sequenceListEl.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
            const idx = e.target.getAttribute('data-index');
            if (idx !== null) {
                let val = parseInt(e.target.value, 10) || 1;
                const unitSelect = sequenceListEl.querySelector(`select[data-index="${idx}"]`);
                if (unitSelect && unitSelect.value === 'secs' && val >= 60) {
                    val = 59;
                    e.target.value = val;
                }
                pomoState.pomoSequence[idx].duration = val;
            }
        } else if (e.target.tagName === 'SELECT') {
            const idx = e.target.getAttribute('data-index');
            if (idx !== null) {
                const newUnit = e.target.value;
                pomoState.pomoSequence[idx].unit = newUnit;
                if (newUnit === 'secs') {
                    const input = sequenceListEl.querySelector(`input[data-index="${idx}"]`);
                    if (input) {
                        let val = parseInt(input.value, 10) || 1;
                        if (val >= 60) {
                            val = 59;
                            input.value = val;
                            pomoState.pomoSequence[idx].duration = val;
                        }
                    }
                }
            }
        }
    });

    sequenceListEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const idx = e.target.getAttribute('data-index');
            if (idx !== null) {
                pomoState.pomoSequence.splice(idx, 1);
                renderSequence();
            }
        }
    });
}

if (addWorkBtn) addWorkBtn.addEventListener('click', () => { pomoState.pomoSequence.push({ type: 'work', duration: 25 }); renderSequence(); });
if (addBreakBtn) addBreakBtn.addEventListener('click', () => { pomoState.pomoSequence.push({ type: 'break', duration: 5 }); renderSequence(); });

const startPomoBtn = document.getElementById('start-pomo-btn');
const pausePomoBtn = document.getElementById('pause-pomo-btn');
const continuePomoBtn = document.getElementById('continue-pomo-btn');
const pomoAutostartCheckbox = document.getElementById('pomo-autostart');
const pomoInfiniteCheckbox = document.getElementById('pomo-infinite');
const pomoRepeatsInput = document.getElementById('pomo-repeats');
const pomoCyclesContainer = document.getElementById('pomo-cycles-container');
const pomoInfiniteStatus = document.getElementById('pomo-infinite-status');

if (pomoInfiniteCheckbox) {
    pomoInfiniteCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (pomoCyclesContainer) pomoCyclesContainer.classList.add('hidden');
            if (pomoInfiniteStatus) pomoInfiniteStatus.style.display = 'block';
        } else {
            if (pomoCyclesContainer) pomoCyclesContainer.classList.remove('hidden');
            if (pomoInfiniteStatus) pomoInfiniteStatus.style.display = 'none';
        }
    });
}
const pomoTimerDisplay = document.getElementById('pomo-timer-display');
const pomoTimeLeft = document.getElementById('pomo-time-left');
const pomoStatusText = document.getElementById('pomo-status-text');
const pomoRoundsLeft = document.getElementById('pomo-rounds-left');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatPhaseDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0 && s > 0) return `${m}m ${s}s`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
}

function updatePomoDisplay(notifyWindow = false) {
    if (pomoTimeLeft) pomoTimeLeft.innerText = formatTime(pomoState.pomoTimer);
    const currentPhase = pomoState.isPomoRunning ? pomoState.activePomoSequence[pomoState.currentPhaseIndex] : pomoState.pomoSequence[0];
    if (pomoStatusText) pomoStatusText.innerText = currentPhase ? (currentPhase.type === 'work' ? 'Work Session' : 'Break Time') : 'Finished';
    
    const nextPhaseIdx = pomoState.currentPhaseIndex + 1;
    let nextText = '--';
    const sourceSeq = pomoState.isPomoRunning ? pomoState.activePomoSequence : pomoState.pomoSequence;
    
    function getPhaseSecs(phase) {
        if (phase.totalSeconds) return phase.totalSeconds;
        return phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
    }

    if (nextPhaseIdx < sourceSeq.length) {
        const nextPhase = sourceSeq[nextPhaseIdx];
        nextText = `${nextPhase.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(getPhaseSecs(nextPhase))})`;
    } else if (pomoInfiniteCheckbox && pomoInfiniteCheckbox.checked || pomoState.currentRepeatCount + 1 < pomoState.totalRepeatsPlanned) {
        const firstPhase = sourceSeq[0];
        if (firstPhase) {
            nextText = `Repeat: ${firstPhase.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(getPhaseSecs(firstPhase))})`;
        }
    } else {
        nextText = 'Finish';
    }
    if (pomoRoundsLeft) pomoRoundsLeft.innerText = `Next: ${nextText}`;

    if (notifyWindow) {
        const totalSecs = currentPhase ? getPhaseSecs(currentPhase) : 1;
        ipcRenderer.send('update-pomo-timer', {
            phase: pomoStatusText ? pomoStatusText.innerText : '',
            timeLeft: formatTime(pomoState.pomoTimer),
            percent: currentPhase ? (pomoState.pomoTimer / totalSecs) * 100 : 0
        });
    }
}

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'pomo') {
        pomoState.pomoTimer = data.remaining;
        updatePomoDisplay(false);
    }
});

ipcRenderer.on('timer-started-pomo', (data) => {
    // Ticks are handled by timer-tick event
});

ipcRenderer.on('timer-paused-pomo', (remainingSeconds) => {
    pomoState.pomoTimer = remainingSeconds;
    updatePomoDisplay();
});

ipcRenderer.on('timer-resumed-pomo', (data) => {
    // Ticks are handled by timer-tick event
});

ipcRenderer.on('timer-stopped-pomo', () => {
    pomoState.pomoTimer = 0;
    updatePomoDisplay();
});

ipcRenderer.on('timer-complete-pomo', () => {
    handlePhaseEnd();
});

function startPomoPhase() {
    if (pomoState.currentPhaseIndex >= pomoState.activePomoSequence.length) {
        pomoState.currentRepeatCount++;
        if (pomoInfiniteCheckbox && pomoInfiniteCheckbox.checked || pomoState.currentRepeatCount < pomoState.totalRepeatsPlanned) {
            pomoState.currentPhaseIndex = 0;
        } else {
            stopPomoStyle();
            return;
        }
    }
    
    if (continuePomoBtn) continuePomoBtn.style.display = 'none';
    const currentPhase = pomoState.activePomoSequence[pomoState.currentPhaseIndex];
    pomoState.pomoTimer = currentPhase.totalSeconds;
    updatePomoDisplay();

    // Ensure timer is registered in main BEFORE showing the popup to avoid instant-close race conditions
    ipcRenderer.send('start-timer', { id: 'pomo', seconds: pomoState.pomoTimer, durationSeconds: pomoState.pomoTimer });

    if (currentPhase.type === 'break') {
        const pomoActionEl = document.querySelector('input[name="pomo-action"]:checked');
        const pomoAction = pomoActionEl ? pomoActionEl.value : 'block';
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', 
            duration: currentPhase.totalSeconds, 
            fullScreen: (pomoAction === 'block'),
            autoStart: pomoAutostartCheckbox ? pomoAutostartCheckbox.checked : false
        });
    }
}

function handlePhaseEnd() {
    playChime();
    const finishedPhase = pomoState.activePomoSequence[pomoState.currentPhaseIndex];
    if (finishedPhase.type === 'work') {
        recordFocusSession(Math.round(finishedPhase.totalSeconds / 60), 'Pomo Work');
    }
    
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
    
    pomoState.currentPhaseIndex++;
    
    if (pomoState.currentPhaseIndex >= pomoState.activePomoSequence.length && (!pomoInfiniteCheckbox || !pomoInfiniteCheckbox.checked) && pomoState.currentRepeatCount + 1 >= pomoState.totalRepeatsPlanned) {
        stopPomoStyle();
        if (sharedState.isWorkflowRunning) {
            setTimeout(() => { if (typeof sharedState.triggerNextWorkflowBlock === 'function') sharedState.triggerNextWorkflowBlock(); }, 500);
        }
        return;
    }

    if (pomoAutostartCheckbox && pomoAutostartCheckbox.checked) {
        startPomoPhase();
    } else {
        pomoState.pomoTimer = 0; // Ensure display reads 0
        updatePomoDisplay();
        if (continuePomoBtn) continuePomoBtn.style.display = 'block';
    }
}

function stopPomoStyle() {
    pomoState.isPomoRunning = false;
    pomoState.isPomoPaused = false;
    ipcRenderer.send('stop-timer', 'pomo');
    toggleStartStopButton(startPomoBtn);
    setInputsLocked('config-pomo-style', false);
    if (pomoTimerDisplay) pomoTimerDisplay.classList.add('hidden');
    if (continuePomoBtn) continuePomoBtn.style.display = 'none';
    if(pausePomoBtn) {
        pausePomoBtn.style.display = 'none';
        pausePomoBtn.innerText = 'Pause ⏸';
    }
    ipcRenderer.send('close-pomo-timer');
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
}

export function startPomoStyle() {
    if (!pomoState.isPomoRunning) {
        if (pomoState.pomoSequence.length === 0) {
            customAlert('Please add at least one phase to the sequence.');
            return;
        }
        
        pomoState.activePomoSequence = [];
        pomoState.pomoSequence.forEach(phase => {
            const phaseSecs = phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
            if (pomoState.activePomoSequence.length > 0 && pomoState.activePomoSequence[pomoState.activePomoSequence.length - 1].type === phase.type) {
                pomoState.activePomoSequence[pomoState.activePomoSequence.length - 1].totalSeconds += phaseSecs;
            } else {
                pomoState.activePomoSequence.push({ type: phase.type, totalSeconds: phaseSecs });
            }
        });

        pomoState.totalRepeatsPlanned = pomoRepeatsInput ? (parseInt(pomoRepeatsInput.value, 10) || 1) : 1;
        pomoState.isPomoRunning = true;
        pomoState.isPomoPaused = false;
        pomoState.currentPhaseIndex = 0;
        pomoState.currentRepeatCount = 0;
        toggleStartStopButton(startPomoBtn);
        setInputsLocked('config-pomo-style', true);
        if (pomoTimerDisplay) pomoTimerDisplay.classList.remove('hidden');
        if(pausePomoBtn) {
            pausePomoBtn.style.display = 'block';
            pausePomoBtn.innerText = 'Pause ⏸';
        }
        ipcRenderer.send('open-pomo-timer');
        startPomoPhase();
    }
}

if (startPomoBtn) {
    startPomoBtn.addEventListener('click', () => {
        if (!pomoState.isPomoRunning) {
            startPomoStyle();
        } else {
            stopPomoStyle();
            if (sharedState.isWorkflowRunning) {
                const stopWf = document.getElementById('stop-workflow-btn');
                if (stopWf) stopWf.click();
            }
        }
    });
}

// More robust pause button handling for Pomo Style using event delegation
document.addEventListener('click', (e) => {
    if (e.target.id === 'pause-pomo-btn') {
        // Allow pause/resume if timer has been started, regardless of current state
        if (!pomoState.isPomoPaused) {
            ipcRenderer.send('pause-timer', 'pomo');
            pomoState.isPomoPaused = true;
            const timerDisplay = document.getElementById('pomo-timer-display');
            if (timerDisplay) timerDisplay.classList.add('paused');
            e.target.innerText = 'Resume ▶️';
        } else {
            ipcRenderer.send('resume-timer', 'pomo');
            pomoState.isPomoPaused = false;
            const timerDisplay = document.getElementById('pomo-timer-display');
            if (timerDisplay) timerDisplay.classList.remove('paused');
            e.target.innerText = 'Pause ⏸';
        }
    }
});

if (continuePomoBtn) continuePomoBtn.addEventListener('click', startPomoPhase);

ipcRenderer.on('start-next-phase', () => {
    if (sharedState.isWorkflowRunning) {
        ipcRenderer.send('stop-timer', 'workflow-break');
        ipcRenderer.send('close-popup');
        ipcRenderer.send('close-fullscreen');
        ipcRenderer.send('close-pomo-timer');
        setTimeout(() => { if (typeof sharedState.triggerNextWorkflowBlock === 'function') sharedState.triggerNextWorkflowBlock(); }, 500);
    } else {
        ipcRenderer.send('stop-timer', 'pomo');
        handlePhaseEnd();
    }
});

export { stopPomoStyle, startPomoPhase };

