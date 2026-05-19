import { ipcRenderer } from '../../utils/ipc.js';
import { sharedState } from '../../utils/state.js';
import { customAlert } from '../../ui/modals.js';
import { playChime } from '../../utils/audio.js';
import { startPomoStyle, stopPomoStyle, pomoState } from '../pomo-timer.js';
import { startRepeatingReminders, stopRepeatingReminders, repeatingState } from '../repeating.js';
import { startSprintMode, stopSprintMode, sprintState } from '../micro-sprint.js';
import { formatTime } from '../../utils/ui-helpers.js';
import { showOSNotification } from '../../utils/notifications.js';
import { workflowState, workflowBlocks } from './workflows-state.js';
import { switchMode } from '../../renderer.js';

const startWorkflowBtn = document.getElementById('start-workflow-btn');
const stopWorkflowBtn = document.getElementById('stop-workflow-btn');

export function resetWorkflowState() {
    workflowState.isWorkflowRunning = false;
    sharedState.isWorkflowRunning = false;
    workflowState.currentBlockIndex = 0;
    workflowState.currentCycle = 0;
    if (startWorkflowBtn) startWorkflowBtn.style.display = 'block';
    if (stopWorkflowBtn) stopWorkflowBtn.style.display = 'none';
}

export function startNextWorkflowBlock() {
    if (!workflowState.isWorkflowRunning) return;

    if (workflowState.currentBlockIndex >= workflowBlocks.length) {
        customAlert('Workflow Complete!');
        resetWorkflowState();
        switchMode('workflows');
        return;
    }

    const currentBlock = workflowBlocks[workflowState.currentBlockIndex];
    
    if (workflowState.currentCycle >= currentBlock.cycles) {
        workflowState.currentBlockIndex++;
        workflowState.currentCycle = 0;
        startNextWorkflowBlock();
        return;
    }

    workflowState.currentCycle++;
    
    // Execute Break Block if it is next in the Workflow
    if (currentBlock.type === 'break') {
        const durationSecs = (currentBlock.duration || 5) * 60;
        
        // Ensure timer is registered in main BEFORE showing the popup
        ipcRenderer.send('start-timer', { id: 'workflow-break', seconds: durationSecs });
        
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', 
            duration: durationSecs, 
            fullScreen: currentBlock.blocksScreen,
            autoStart: true 
        });
        
        if (!currentBlock.blocksScreen) {
            ipcRenderer.send('open-timer-window', 'pomo');
            ipcRenderer.send('update-timer-window', {
                phase: 'Break Time',
                timeLeft: formatTime(durationSecs),
                percent: 100
            });
        }
        return;
    }
    
    const modeMap = {
        'pomo': 'pomo-style',
        'sprint': 'micro-sprint',
        'repeating': 'repeating-reminders'
    };
    
    switchMode(modeMap[currentBlock.type]);

    setTimeout(() => {
        if (currentBlock.type === 'pomo') {
            const pomoPresetsSelect = document.getElementById('pomo-presets');
            if (pomoPresetsSelect) {
                pomoPresetsSelect.value = currentBlock.presetKey;
                pomoPresetsSelect.dispatchEvent(new Event('change'));
                startPomoStyle();
            }
        } else if (currentBlock.type === 'sprint') {
            const sprintPresetsSelect = document.getElementById('sprint-presets');
            if (sprintPresetsSelect) {
                sprintPresetsSelect.value = currentBlock.presetKey;
                sprintPresetsSelect.dispatchEvent(new Event('change'));
                startSprintMode();
            }
        } else if (currentBlock.type === 'repeating') {
            const repeatingPresetsSelect = document.getElementById('repeating-presets');
            if (repeatingPresetsSelect) {
                repeatingPresetsSelect.value = currentBlock.presetKey;
                repeatingPresetsSelect.dispatchEvent(new Event('change'));
                
                const reminderRoundsInput = document.getElementById('reminder-rounds');
                if (reminderRoundsInput) reminderRoundsInput.value = 1; // 1 round per cycle
                
                startRepeatingReminders();
            }
        }
    }, 100); // slight delay to ensure UI updates after switching modes
}

export function setupEngineListeners() {
    if (startWorkflowBtn) {
        startWorkflowBtn.addEventListener('click', () => {
            if (workflowBlocks.length === 0) {
                customAlert('Please add blocks to your Building Stack first.');
                return;
            }
            workflowState.isWorkflowRunning = true;
            sharedState.isWorkflowRunning = true;
            sharedState.triggerNextWorkflowBlock = startNextWorkflowBlock;
            workflowState.currentBlockIndex = 0;
            workflowState.currentCycle = 0;
            startWorkflowBtn.style.display = 'none';
            if (stopWorkflowBtn) stopWorkflowBtn.style.display = 'block';
            startNextWorkflowBlock();
        });
    }

    if (stopWorkflowBtn) {
        stopWorkflowBtn.addEventListener('click', () => {
            workflowState.isWorkflowRunning = false;
            
            ipcRenderer.send('stop-timer', 'workflow-break');
            ipcRenderer.send('close-popup');
            ipcRenderer.send('close-fullscreen');
            ipcRenderer.send('close-timer-window');

            if (pomoState.isPomoRunning) stopPomoStyle();
            if (repeatingState.isRepeatingRunning) stopRepeatingReminders();
            if (sprintState.isSprintRunning) stopSprintMode();
            
            resetWorkflowState();
            switchMode('workflows');
        });
    }

    ipcRenderer.on('timer-tick', (data) => {
        if (data.id === 'workflow-break') {
            const currentBlock = workflowBlocks[workflowState.currentBlockIndex];
            if (currentBlock && currentBlock.type === 'break') {
                ipcRenderer.send('update-pomo-timer', {
                    phase: 'Break Time',
                    timeLeft: formatTime(data.remaining),
                    percent: data.total > 0 ? (data.remaining / data.total) * 100 : 0
                });
            }
        }
    });

    ipcRenderer.on('timer-complete-workflow-break', () => {
        playChime('session-start');
        showOSNotification('start');
        ipcRenderer.send('close-popup');
        ipcRenderer.send('close-fullscreen');
        ipcRenderer.send('close-pomo-timer');
        
        if (workflowState.isWorkflowRunning || sharedState.isWorkflowRunning) {
            setTimeout(() => { if (typeof sharedState.triggerNextWorkflowBlock === 'function') sharedState.triggerNextWorkflowBlock(); }, 500);
        }
    });
}
