import { setInputsLocked } from '../utils/ui-helpers.js';
import { recordFocusSession } from '../utils/stats.js';
import { playChime } from '../utils/audio.js';
import { ipcRenderer } from '../utils/ipc.js';

// --- Flow State Stopwatch Mode ---
const flowChimeIntervalInput = document.getElementById('flow-chime-interval');
const flowChimeIntervalSecondsInput = document.getElementById('flow-chime-interval-seconds');
const startFlowBtn = document.getElementById('start-flow-btn');
const stopFlowBtn = document.getElementById('stop-flow-btn');
const flowTimerDisplay = document.getElementById('flow-timer-display');
const flowTimeElapsed = document.getElementById('flow-time-elapsed');

let isFlowRunning = false;
let flowStartTime = 0;
let flowInterval = null;

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
    isFlowRunning = true;
    startFlowBtn.style.display = 'none';
    stopFlowBtn.style.display = 'block';
    setInputsLocked('config-flow-state', true);
    flowTimerDisplay.classList.remove('hidden');
    
    flowStartTime = Date.now();
    let chimeIntervalMinutes = parseInt(flowChimeIntervalInput.value, 10) || 0;
    let chimeIntervalSeconds = parseInt(flowChimeIntervalSecondsInput.value, 10) || 0;
    let totalChimeIntervalSeconds = (chimeIntervalMinutes * 60) + chimeIntervalSeconds;
    let nextChimeSeconds = totalChimeIntervalSeconds > 0 ? totalChimeIntervalSeconds : 0;
    
    updateFlowDisplay(0);
    ipcRenderer.send('open-flow-timer');
    
    flowInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - flowStartTime) / 1000);
        updateFlowDisplay(elapsedSeconds);
        
        if (nextChimeSeconds > 0 && elapsedSeconds >= nextChimeSeconds) {
            playChime();
            nextChimeSeconds += totalChimeIntervalSeconds;
        }
    }, 1000);
}

function stopFlowState() {
    if (!isFlowRunning) return;
    isFlowRunning = false;
    startFlowBtn.style.display = 'block';
    stopFlowBtn.style.display = 'none';
    setInputsLocked('config-flow-state', false);
    flowTimerDisplay.classList.add('hidden');
    
    if (flowInterval) {
        clearInterval(flowInterval);
        flowInterval = null;
    }
    
    ipcRenderer.send('close-flow-timer');
    
    const elapsedSeconds = Math.floor((Date.now() - flowStartTime) / 1000);
    const elapsedMinutes = Math.round(elapsedSeconds / 60);
    if (elapsedMinutes > 0) {
        recordFocusSession(elapsedMinutes, 'Flow State');
    }
}

startFlowBtn.addEventListener('click', startFlowState);
stopFlowBtn.addEventListener('click', stopFlowState);

ipcRenderer.on('flow-popup-closed', () => {
    if (isFlowRunning) {
        stopFlowState();
    }
});

export { startFlowState, stopFlowState, isFlowRunning };