import { ipcRenderer } from '../utils/ipc.js';
import { store } from '../utils/storage.js';
import { customAlert } from '../ui/modals.js';
import { playChime } from '../utils/audio.js';
import { setInputsLocked, toggleStartStopButton } from '../utils/ui-helpers.js';
import { recordFocusSession } from '../utils/stats.js';

// --- Dynamic Pomo Sequence ---
let pomoSequence = [
    { type: 'work', duration: 25 },
    { type: 'break', duration: 5 }
];
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

let customPresets = store.get('customPomoPresets', {});

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
updatePresetOptions();

if (pomoPresetsSelect) {
    pomoPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deletePomoPresetBtn) {
            deletePomoPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val === 'deep-work') {
            pomoSequence = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
        } else if (val === 'quick-study') {
            pomoSequence = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
        } else if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (customPresets[key]) {
                pomoSequence = JSON.parse(JSON.stringify(customPresets[key]));
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
        if (pomoSequence.length === 0) {
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
            customPresets[name.trim()] = JSON.parse(JSON.stringify(pomoSequence));
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
    if (isPomoRunning) {
        stopPomoStyle();
    }
});

function renderSequence() {
    sequenceListEl.innerHTML = '';
    pomoSequence.forEach((item, index) => {
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
        sequenceListEl.appendChild(div);
    });
}

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
            pomoSequence[idx].duration = val;
        }
    } else if (e.target.tagName === 'SELECT') {
        const idx = e.target.getAttribute('data-index');
        if (idx !== null) {
            const newUnit = e.target.value;
            pomoSequence[idx].unit = newUnit;
            if (newUnit === 'secs') {
                const input = sequenceListEl.querySelector(`input[data-index="${idx}"]`);
                if (input) {
                    let val = parseInt(input.value, 10) || 1;
                    if (val >= 60) {
                        val = 59;
                        input.value = val;
                        pomoSequence[idx].duration = val;
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
            pomoSequence.splice(idx, 1);
            renderSequence();
        }
    }
});
renderSequence();

addWorkBtn.addEventListener('click', () => { pomoSequence.push({ type: 'work', duration: 25 }); renderSequence(); });
addBreakBtn.addEventListener('click', () => { pomoSequence.push({ type: 'break', duration: 5 }); renderSequence(); });

// Pomo State
let isPomoRunning = false;
let isPomoPaused = false;
let pomoTimer = 0;
let currentPhaseIndex = 0;
let currentRepeatCount = 0;
let totalRepeatsPlanned = 1;

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

let activePomoSequence = [];

function updatePomoDisplay() {
    pomoTimeLeft.innerText = formatTime(pomoTimer);
    const currentPhase = isPomoRunning ? activePomoSequence[currentPhaseIndex] : pomoSequence[0];
    pomoStatusText.innerText = currentPhase ? (currentPhase.type === 'work' ? 'Work Session' : 'Break Time') : 'Finished';
    
    const nextPhaseIdx = currentPhaseIndex + 1;
    let nextText = '--';
    const sourceSeq = isPomoRunning ? activePomoSequence : pomoSequence;
    
    function getPhaseSecs(phase) {
        if (phase.totalSeconds) return phase.totalSeconds;
        return phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
    }

    if (nextPhaseIdx < sourceSeq.length) {
        const nextPhase = sourceSeq[nextPhaseIdx];
        nextText = `${nextPhase.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(getPhaseSecs(nextPhase))})`;
    } else if (pomoInfiniteCheckbox.checked || currentRepeatCount + 1 < totalRepeatsPlanned) {
        const firstPhase = sourceSeq[0];
        if (firstPhase) {
            nextText = `Repeat: ${firstPhase.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(getPhaseSecs(firstPhase))})`;
        }
    } else {
        nextText = 'Finish';
    }
    pomoRoundsLeft.innerText = `Next: ${nextText}`;

    const totalSecs = currentPhase ? getPhaseSecs(currentPhase) : 1;
    ipcRenderer.send('update-pomo-timer', {
        phase: pomoStatusText.innerText,
        timeLeft: formatTime(pomoTimer),
        percent: currentPhase ? (pomoTimer / totalSecs) * 100 : 0
    });
}

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'pomo') {
        pomoTimer = data.seconds;
        updatePomoDisplay();
    }
});

ipcRenderer.on('timer-complete-pomo', () => {
    handlePhaseEnd();
});

function startPomoPhase() {
    if (currentPhaseIndex >= activePomoSequence.length) {
        currentRepeatCount++;
        if (pomoInfiniteCheckbox.checked || currentRepeatCount < totalRepeatsPlanned) {
            currentPhaseIndex = 0;
        } else {
            stopPomoStyle();
            return;
        }
    }
    
    continuePomoBtn.style.display = 'none';
    const currentPhase = activePomoSequence[currentPhaseIndex];
    pomoTimer = currentPhase.totalSeconds;
    updatePomoDisplay();

    // Ensure timer is registered in main BEFORE showing the popup to avoid instant-close race conditions
    ipcRenderer.send('start-timer', { id: 'pomo', seconds: pomoTimer });

    if (currentPhase.type === 'break') {
        const pomoActionEl = document.querySelector('input[name="pomo-action"]:checked');
        const pomoAction = pomoActionEl ? pomoActionEl.value : 'block';
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', 
            duration: currentPhase.totalSeconds, 
            fullScreen: (pomoAction === 'block'),
            autoStart: pomoAutostartCheckbox.checked
        });
    }
}

function handlePhaseEnd() {
    playChime();
    const finishedPhase = activePomoSequence[currentPhaseIndex];
    if (finishedPhase.type === 'work') {
        recordFocusSession(Math.round(finishedPhase.totalSeconds / 60), 'Pomo Work');
    }
    
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
    
    currentPhaseIndex++;
    
    if (currentPhaseIndex >= activePomoSequence.length && !pomoInfiniteCheckbox.checked && currentRepeatCount + 1 >= totalRepeatsPlanned) {
        stopPomoStyle();
        if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
            setTimeout(() => { if (typeof startNextWorkflowBlock === 'function') startNextWorkflowBlock(); }, 500);
        }
        return;
    }

    if (pomoAutostartCheckbox.checked) {
        startPomoPhase();
    } else {
        pomoTimer = 0; // Ensure display reads 0
        updatePomoDisplay();
        continuePomoBtn.style.display = 'block';
    }
}

function stopPomoStyle() {
    isPomoRunning = false;
    isPomoPaused = false;
    ipcRenderer.send('stop-timer', 'pomo');
    toggleStartStopButton(startPomoBtn);
    setInputsLocked('config-pomo-style', false);
    pomoTimerDisplay.classList.add('hidden');
    continuePomoBtn.style.display = 'none';
    if(pausePomoBtn) {
        pausePomoBtn.style.display = 'none';
        pausePomoBtn.innerText = 'Pause ⏸';
    }
    ipcRenderer.send('close-pomo-timer');
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
}

startPomoBtn.addEventListener('click', () => {
    if (!isPomoRunning) {
        if (pomoSequence.length === 0) {
            customAlert('Please add at least one phase to the sequence.');
            return;
        }
        
        activePomoSequence = [];
        pomoSequence.forEach(phase => {
            const phaseSecs = phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
            if (activePomoSequence.length > 0 && activePomoSequence[activePomoSequence.length - 1].type === phase.type) {
                activePomoSequence[activePomoSequence.length - 1].totalSeconds += phaseSecs;
            } else {
                activePomoSequence.push({ type: phase.type, totalSeconds: phaseSecs });
            }
        });

        totalRepeatsPlanned = parseInt(pomoRepeatsInput.value, 10) || 1;
        isPomoRunning = true;
        isPomoPaused = false;
        currentPhaseIndex = 0;
        currentRepeatCount = 0;
        toggleStartStopButton(startPomoBtn);
        setInputsLocked('config-pomo-style', true);
        pomoTimerDisplay.classList.remove('hidden');
        if(pausePomoBtn) {
            pausePomoBtn.style.display = 'block';
            pausePomoBtn.innerText = 'Pause ⏸';
        }
        ipcRenderer.send('open-pomo-timer');
        startPomoPhase();
    } else {
        stopPomoStyle();
        if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
            const stopWf = document.getElementById('stop-workflow-btn');
            if (stopWf) stopWf.click();
        }
    }
});

// More robust pause button handling for Pomo Style using event delegation
document.addEventListener('click', (e) => {
    if (e.target.id === 'pause-pomo-btn') {
        // Allow pause/resume if timer has been started, regardless of current state
        if (!isPomoPaused) {
            ipcRenderer.send('pause-timer', 'pomo');
            isPomoPaused = true;
            const timerDisplay = document.getElementById('pomo-timer-display');
            if (timerDisplay) timerDisplay.classList.add('paused');
            e.target.innerText = 'Resume ▶️';
        } else {
            ipcRenderer.send('resume-timer', 'pomo');
            isPomoPaused = false;
            const timerDisplay = document.getElementById('pomo-timer-display');
            if (timerDisplay) timerDisplay.classList.remove('paused');
            e.target.innerText = 'Pause ⏸';
        }
    }
});

continuePomoBtn.addEventListener('click', startPomoPhase);

ipcRenderer.on('start-next-phase', () => {
    if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
        ipcRenderer.send('stop-timer', 'workflow-break');
        ipcRenderer.send('close-popup');
        ipcRenderer.send('close-fullscreen');
        ipcRenderer.send('close-pomo-timer');
        setTimeout(() => { if (typeof startNextWorkflowBlock === 'function') startNextWorkflowBlock(); }, 500);
    } else {
        ipcRenderer.send('stop-timer', 'pomo');
        handlePhaseEnd();
    }
});

export { stopPomoStyle, startPomoPhase, isPomoRunning, pomoSequence };