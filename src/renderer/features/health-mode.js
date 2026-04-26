import { ipcRenderer } from '../utils/ipc.js';
import { setInputsLocked } from '../utils/ui-helpers.js';

// --- Health & Posture Mode ---
const startHealthBtn = document.getElementById('start-health-btn');
const stopHealthBtn = document.getElementById('stop-health-btn');
const healthEyeSaver = document.getElementById('health-eye-saver');
const healthPostureCheck = document.getElementById('health-posture-check');
const healthStatus = document.getElementById('health-status');

let isHealthRunning = false;

startHealthBtn.addEventListener('click', () => {
    isHealthRunning = true;
    startHealthBtn.style.display = 'none';
    stopHealthBtn.style.display = 'block';
    healthStatus.style.display = 'block';
    setInputsLocked('modal-health', true);

    ipcRenderer.send('start-health-mode', {
        eyeSaver: healthEyeSaver.checked,
        postureCheck: healthPostureCheck.checked
    });
});

stopHealthBtn.addEventListener('click', () => {
    isHealthRunning = false;
    startHealthBtn.style.display = 'block';
    stopHealthBtn.style.display = 'none';
    healthStatus.style.display = 'none';
    setInputsLocked('modal-health', false);

    ipcRenderer.send('stop-health-mode');
});