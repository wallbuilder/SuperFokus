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

    requestAnimationFrame(() => {
        if (currentBlock.type === 'pomo') {
            import('../pomo-timer.js').then(module => module.setPresetAndStart(currentBlock.presetKey));
        } else if (currentBlock.type === 'sprint') {
            import('../micro-sprint.js').then(module => module.setPresetAndStart(currentBlock.presetKey));
        } else if (currentBlock.type === 'repeating') {
            import('../repeating.js').then(module => module.setPresetAndStart(currentBlock.presetKey));
        }
    }); // slight delay to ensure UI updates after switching modes
}

// Track listeners to prevent duplicates and enable cleanup
let engineListenersInitialized = false;
let cleanupTimerTick = null;
let cleanupTimerEvent = null;

export function setupEngineListeners() {
    // Prevent duplicate listener registration
    if (engineListenersInitialized) {
        return;
    }

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

    cleanupTimerTick = ipcRenderer.on('timer-tick', (batchedTicks) => {
        const data = batchedTicks.find(t => t.id === 'workflow-break');
        if (data) {
            const currentBlock = workflowBlocks[workflowState.currentBlockIndex];
            if (currentBlock && currentBlock.type === 'break') {
                ipcRenderer.send('update-timer-window', {
                    phase: 'Break Time',
                    timeLeft: formatTime(data.remaining),
                    percent: data.total > 0 ? (data.remaining / data.total) * 100 : 0
                });
            }
        }
    });

    cleanupTimerEvent = ipcRenderer.on('timer-event', (payload) => {
        if (payload.type === 'workflow-break' && payload.event === 'complete') {
            playChime('session-start');
            showOSNotification('start');
            ipcRenderer.send('close-popup');
            ipcRenderer.send('close-fullscreen');
            ipcRenderer.send('close-timer-window');
            
            if (workflowState.isWorkflowRunning || sharedState.isWorkflowRunning) {
                setTimeout(() => { if (typeof sharedState.triggerNextWorkflowBlock === 'function') sharedState.triggerNextWorkflowBlock(); }, 500);
            }
        }
    });

    engineListenersInitialized = true;
}

export function cleanupEngineListeners() {
    if (!engineListenersInitialized) return;
    
    if (typeof cleanupTimerTick === 'function') {
        cleanupTimerTick();
    }
    if (typeof cleanupTimerEvent === 'function') {
        cleanupTimerEvent();
    }
    
    engineListenersInitialized = false;
    cleanupTimerTick = null;
    cleanupTimerEvent = null;
}
