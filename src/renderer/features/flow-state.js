import { setInputsLocked } from '../utils/ui-helpers.js';
import { recordFocusSession } from '../utils/stats.js';
import { playChime } from '../utils/audio.js';
import { ipcRenderer } from '../utils/ipc.js';

// --- Flow State ---
export const flowState = {
    isFlowRunning: false,
    flowStartTime: 0,
    currentFlowElapsed: 0,
    totalChimeIntervalSeconds: 0,
    nextChimeSeconds: 0
};

const flowChimeIntervalInput = document.getElementById('flow-chime-interval');
const flowChimeIntervalSecondsInput = document.getElementById('flow-chime-interval-seconds');
const startFlowBtn = document.getElementById('start-flow-btn');
const stopFlowBtn = document.getElementById('stop-flow-btn');
const flowTimerDisplay = document.getElementById('flow-timer-display');
const flowTimeElapsed = document.getElementById('flow-time-elapsed');

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'flow') {
        flowState.currentFlowElapsed = data.total - data.remaining;
        updateFlowDisplay(flowState.currentFlowElapsed);
        
        if (flowState.totalChimeIntervalSeconds > 0 && flowState.currentFlowElapsed >= flowState.nextChimeSeconds) {
            playChime();
            flowState.nextChimeSeconds += flowState.totalChimeIntervalSeconds;
        }
    }
});

function formatFlowTime(elapsedSeconds) {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateFlowDisplay(elapsedSeconds) {
    const timeStr = formatFlowTime(elapsedSeconds);
    flowTimeElapsed.innerText = timeStr;
    ipcRenderer.send('update-flow-timer', {
        timeLeft: timeStr
    });
}

function startFlowState() {
    flowState.isFlowRunning = true;
    startFlowBtn.style.display = 'none';
    stopFlowBtn.style.display = 'block';
    setInputsLocked('config-flow-state', true);
    flowTimerDisplay.classList.remove('hidden');
    
    flowState.flowStartTime = Date.now();
    flowState.currentFlowElapsed = 0;
    let chimeIntervalMinutes = parseInt(flowChimeIntervalInput.value, 10) || 0;
    let chimeIntervalSeconds = parseInt(flowChimeIntervalSecondsInput.value, 10) || 0;
    flowState.totalChimeIntervalSeconds = (chimeIntervalMinutes * 60) + chimeIntervalSeconds;
    flowState.nextChimeSeconds = flowState.totalChimeIntervalSeconds > 0 ? flowState.totalChimeIntervalSeconds : 0;
    
    updateFlowDisplay(0);
    ipcRenderer.send('open-flow-timer');
    // Start a long-running timer (24h) in Main to receive ticks for the stopwatch
    ipcRenderer.send('start-timer', { id: 'flow', seconds: 86400 });
}

function stopFlowState() {
    if (!flowState.isFlowRunning) return;
    flowState.isFlowRunning = false;
    startFlowBtn.style.display = 'block';
    stopFlowBtn.style.display = 'none';
    setInputsLocked('config-flow-state', false);
    flowTimerDisplay.classList.add('hidden');
    
    ipcRenderer.send('stop-timer', 'flow');
    ipcRenderer.send('close-flow-timer');
    
    const elapsedMinutes = Math.round(flowState.currentFlowElapsed / 60);
    if (elapsedMinutes > 0) {
        recordFocusSession(elapsedMinutes, 'Flow State');
    }
}

export async function initFlow() {
    // No specific presets to load for Flow State currently, 
    // but follows the initialization pattern of other modules.
}

startFlowBtn.addEventListener('click', startFlowState);
stopFlowBtn.addEventListener('click', stopFlowState);

ipcRenderer.on('flow-popup-closed', () => {
    if (flowState.isFlowRunning) {
        stopFlowState();
    }
});

export { startFlowState, stopFlowState };