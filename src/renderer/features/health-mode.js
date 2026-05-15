import { ipcRenderer } from '../utils/ipc.js';
import { setInputsLocked } from '../utils/ui-helpers.js';

// --- Health & Posture Mode ---
const startHealthBtn = document.getElementById('start-health-btn');
const stopHealthBtn = document.getElementById('stop-health-btn');
const healthEyeSaver = document.getElementById('health-eye-saver');
const healthPostureCheck = document.getElementById('health-posture-check');
const healthStatus = document.getElementById('health-status');

let isHealthRunning = false;

if (startHealthBtn) {
    startHealthBtn.addEventListener('click', () => {
        isHealthRunning = true;
        if (startHealthBtn) startHealthBtn.style.display = 'none';
        if (stopHealthBtn) stopHealthBtn.style.display = 'block';
        if (healthStatus) healthStatus.style.display = 'block';
        setInputsLocked('config-health-mode', true);

        ipcRenderer.send('start-health-mode', {
            eyeSaver: healthEyeSaver ? healthEyeSaver.checked : false,
            postureCheck: healthPostureCheck ? healthPostureCheck.checked : false,
            blockingMode: 'popup' // Default for now
        });
    });
}

if (stopHealthBtn) {
    stopHealthBtn.addEventListener('click', () => {
        isHealthRunning = false;
        if (startHealthBtn) startHealthBtn.style.display = 'block';
        if (stopHealthBtn) stopHealthBtn.style.display = 'none';
        if (healthStatus) healthStatus.style.display = 'none';
        setInputsLocked('config-health-mode', false);

        ipcRenderer.send('stop-health-mode');
    });
}