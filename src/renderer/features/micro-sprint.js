import { ipcRenderer } from '../utils/ipc.js';
import { playChime } from '../utils/audio.js';
import { store } from '../utils/storage.js';
import { recordFocusSession } from '../utils/stats.js';
import { formatTime, setInputsLocked } from '../utils/ui-helpers.js';
import { isWorkflowRunning, startNextWorkflowBlock } from './workflows.js';

const sprintDurationSelect = document.getElementById('sprint-duration');
const sprintTasksInput = document.getElementById('sprint-tasks');
const startSprintBtn = document.getElementById('start-sprint-btn');
const stopSprintBtn = document.getElementById('stop-sprint-btn');
const sprintTimerDisplay = document.getElementById('sprint-timer-display');
const sprintCurrentTask = document.getElementById('sprint-current-task');
const sprintTimeLeft = document.getElementById('sprint-time-left');
const sprintTasksLeft = document.getElementById('sprint-tasks-left');
const nextSprintBtn = document.getElementById('next-sprint-btn');
const skipSprintBtn = document.getElementById('skip-sprint-btn');
const sprintAutostartCheckbox = document.getElementById('sprint-autostart');

export let isSprintRunning = false;
let sprintTasks = [];
let currentSprintTaskIndex = 0;
let sprintTimerSeconds = 0;
let sprintDurationSeconds = 0;

// Load autostart preference
if (sprintAutostartCheckbox) {
    sprintAutostartCheckbox.checked = store.get('sprintAutostart', false);
    sprintAutostartCheckbox.addEventListener('change', (e) => {
        store.set('sprintAutostart', e.target.checked);
    });
}

// Presets and Custom Duration Logic
const sprintPresetsSelect = document.getElementById('sprint-presets');
const deleteSprintPresetBtn = document.getElementById('delete-sprint-preset-btn');
const saveSprintPresetBtn = document.getElementById('save-sprint-preset-btn');
const saveSprintPresetContainer = document.getElementById('save-sprint-preset-container');
const sprintPresetNameInput = document.getElementById('sprint-preset-name-input');
const confirmSaveSprintPresetBtn = document.getElementById('confirm-save-sprint-preset-btn');
const cancelSaveSprintPresetBtn = document.getElementById('cancel-save-sprint-preset-btn');
const customSprintDurationContainer = document.getElementById('custom-sprint-duration-container');
const customSprintDurationInput = document.getElementById('custom-sprint-duration');

let sprintPresets = store.get('sprintPresets', {});

function updateSprintPresetOptions() {
    if (!sprintPresetsSelect) return;
    Array.from(sprintPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            sprintPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(sprintPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        sprintPresetsSelect.appendChild(option);
    });
}
updateSprintPresetOptions();

if (sprintDurationSelect) {
    sprintDurationSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            if (customSprintDurationContainer) customSprintDurationContainer.style.display = 'block';
        } else {
            if (customSprintDurationContainer) customSprintDurationContainer.style.display = 'none';
        }
    });
}

if (sprintPresetsSelect) {
    sprintPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deleteSprintPresetBtn) {
            deleteSprintPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (sprintPresets[key]) {
                const data = sprintPresets[key];
                if (sprintDurationSelect) {
                    sprintDurationSelect.value = data.durationVal || '5';
                    sprintDurationSelect.dispatchEvent(new Event('change'));
                }
                if (data.durationVal === 'custom' && customSprintDurationInput) {
                    customSprintDurationInput.value = data.customMins || 20;
                }
                if (sprintTasksInput) sprintTasksInput.value = data.tasks || '';
                if (sprintAutostartCheckbox && data.autostart !== undefined) {
                    sprintAutostartCheckbox.checked = data.autostart;
                    store.set('sprintAutostart', data.autostart);
                }
            }
        }
    });
}

if (deleteSprintPresetBtn) {
    deleteSprintPresetBtn.addEventListener('click', () => {
        if (!sprintPresetsSelect) return;
        const val = sprintPresetsSelect.value;
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete sprintPresets[key];
                store.set('sprintPresets', sprintPresets);
                updateSprintPresetOptions();
                sprintPresetsSelect.value = 'custom';
                sprintPresetsSelect.dispatchEvent(new Event('change'));
            }
        }
    });
}

if (saveSprintPresetBtn) {
    saveSprintPresetBtn.addEventListener('click', () => {
        if (saveSprintPresetContainer) saveSprintPresetContainer.style.display = 'flex';
        if (sprintPresetNameInput) sprintPresetNameInput.focus();
    });
}

if (confirmSaveSprintPresetBtn) {
    confirmSaveSprintPresetBtn.addEventListener('click', () => {
        if (!sprintPresetNameInput) return;
        const name = sprintPresetNameInput.value;
        if (name && name.trim()) {
            sprintPresets[name.trim()] = {
                durationVal: sprintDurationSelect ? sprintDurationSelect.value : '5',
                customMins: (sprintDurationSelect && sprintDurationSelect.value === 'custom' && customSprintDurationInput) ? (parseInt(customSprintDurationInput.value, 10) || 20) : null,
                tasks: sprintTasksInput ? sprintTasksInput.value : '',
                autostart: sprintAutostartCheckbox ? sprintAutostartCheckbox.checked : false
            };
            store.set('sprintPresets', sprintPresets);
            updateSprintPresetOptions();
            if (sprintPresetsSelect) sprintPresetsSelect.value = `custom-preset-${name.trim()}`;
            sprintPresetNameInput.value = '';
            if (saveSprintPresetContainer) saveSprintPresetContainer.style.display = 'none';
        }
    });
}

if (cancelSaveSprintPresetBtn) {
    cancelSaveSprintPresetBtn.addEventListener('click', () => {
        if (sprintPresetNameInput) sprintPresetNameInput.value = '';
        if (saveSprintPresetContainer) saveSprintPresetContainer.style.display = 'none';
    });
}

function updateSprintDisplay() {
    if (sprintTimeLeft) sprintTimeLeft.innerText = formatTime(sprintTimerSeconds);
    const taskName = sprintTasks[currentSprintTaskIndex] || `Sprint ${currentSprintTaskIndex + 1}`;
    if (sprintCurrentTask) sprintCurrentTask.innerText = taskName;
    const tasksLeftText = `Remaining Tasks: ${Math.max(0, sprintTasks.length - currentSprintTaskIndex - 1)}`;
    if (sprintTasksLeft) sprintTasksLeft.innerText = tasksLeftText;

    // Update timer popup
    ipcRenderer.send('update-micro-sprint-timer', {
        task: taskName,
        timeLeft: formatTime(sprintTimerSeconds),
        percent: (sprintTimerSeconds / sprintDurationSeconds) * 100,
        tasksLeft: tasksLeftText
    });
}

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'sprint') {
        sprintTimerSeconds = data.seconds;
        updateSprintDisplay();
    }
});

ipcRenderer.on('timer-complete-sprint', () => {
    playChime();
    recordFocusSession(Math.round(sprintDurationSeconds / 60), 'Micro-Task Sprint');
    
    if (sprintAutostartCheckbox && sprintAutostartCheckbox.checked) {
        setTimeout(() => {
            currentSprintTaskIndex++;
            if (currentSprintTaskIndex >= sprintTasks.length) {
                stopSprintMode();
            } else {
                startNextSprintTask();
            }
        }, 2000); // 2 second delay before autostarting next
    } else {
        if (nextSprintBtn) nextSprintBtn.style.display = 'block';
        if (skipSprintBtn) skipSprintBtn.style.display = 'block';
    }
});

export function startNextSprintTask() {
    if (currentSprintTaskIndex >= sprintTasks.length && sprintTasks.length > 0) {
        stopSprintMode();
        if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
            setTimeout(() => { if (typeof startNextWorkflowBlock === 'function') startNextWorkflowBlock(); }, 500);
        }
        return;
    }
    if (nextSprintBtn) nextSprintBtn.style.display = 'none';
    if (skipSprintBtn) skipSprintBtn.style.display = 'block'; // Allow skipping during the sprint
    sprintTimerSeconds = sprintDurationSeconds;
    updateSprintDisplay();
    ipcRenderer.send('start-timer', { id: 'sprint', seconds: sprintTimerSeconds });
}

export function stopSprintMode() {
    isSprintRunning = false;
    ipcRenderer.send('stop-timer', 'sprint');
    ipcRenderer.send('close-micro-sprint-timer');
    if (startSprintBtn) startSprintBtn.style.display = 'block';
    if (stopSprintBtn) stopSprintBtn.style.display = 'none';
    setInputsLocked('config-micro-sprint', false);
    if (sprintTimerDisplay) sprintTimerDisplay.classList.add('hidden');
    if (nextSprintBtn) nextSprintBtn.style.display = 'none';
    if (skipSprintBtn) skipSprintBtn.style.display = 'none';
}

if (stopSprintBtn) {
    stopSprintBtn.addEventListener('click', () => {
        stopSprintMode();
        if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
            const stopWf = document.getElementById('stop-workflow-btn');
            if (stopWf) stopWf.click();
        }
    });
}

if (startSprintBtn) {
    startSprintBtn.addEventListener('click', () => {
        const rawTasks = sprintTasksInput ? sprintTasksInput.value.split('\n').map(t => t.trim()).filter(Boolean) : [];
        sprintTasks = rawTasks.length > 0 ? rawTasks : ['Unnamed Sprint'];
        currentSprintTaskIndex = 0;
        
        let durationMins = 5;
        if (sprintDurationSelect && sprintDurationSelect.value === 'custom') {
            durationMins = customSprintDurationInput ? (parseInt(customSprintDurationInput.value, 10) || 5) : 5;
        } else if (sprintDurationSelect) {
            durationMins = parseInt(sprintDurationSelect.value, 10) || 5;
        }
        sprintDurationSeconds = durationMins * 60;
        
        isSprintRunning = true;
        startSprintBtn.style.display = 'none';
        if (stopSprintBtn) stopSprintBtn.style.display = 'block';
        setInputsLocked('config-micro-sprint', true);
        if (sprintTimerDisplay) sprintTimerDisplay.classList.remove('hidden');
        
        ipcRenderer.send('open-micro-sprint-timer');
        startNextSprintTask();
    });
}

if (nextSprintBtn) {
    nextSprintBtn.addEventListener('click', () => {
        currentSprintTaskIndex++;
        if (currentSprintTaskIndex >= sprintTasks.length) {
            stopSprintMode();
        } else {
            startNextSprintTask();
        }
    });
}

if (skipSprintBtn) {
    skipSprintBtn.addEventListener('click', () => {
        ipcRenderer.send('stop-timer', 'sprint'); // Stop current sprint without recording
        currentSprintTaskIndex++;
        if (currentSprintTaskIndex >= sprintTasks.length) {
            stopSprintMode();
        } else {
            startNextSprintTask();
        }
    });
}
