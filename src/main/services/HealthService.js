const { ipcMain } = require('electron');
const windowManager = require('./WindowManager');

let healthIntervals = { eye: null, posture: null };
let healthConfig = {
    eyeSaver: false,
    postureCheck: false,
    blockingMode: 'popup', 
    eyeSaverInterval: 20 * 60 * 1000, 
    postureInterval: 45 * 60 * 1000, 
    eyeBreakDuration: 20 * 1000, 
    postureBreakDuration: 50 * 1000 
};

function init() {
    ipcMain.on('start-health-mode', (event, data) => {
        if (healthIntervals.eye) clearInterval(healthIntervals.eye);
        if (healthIntervals.posture) clearInterval(healthIntervals.posture);
        
        healthConfig.eyeSaver = data.eyeSaver || false;
        healthConfig.postureCheck = data.postureCheck || false;
        healthConfig.blockingMode = data.blockingMode || 'popup';
        if (data.eyeSaverInterval) healthConfig.eyeSaverInterval = data.eyeSaverInterval;
        if (data.postureInterval) healthConfig.postureInterval = data.postureInterval;
        if (data.eyeBreakDuration) healthConfig.eyeBreakDuration = data.eyeBreakDuration;
        if (data.postureBreakDuration) healthConfig.postureBreakDuration = data.postureBreakDuration;
        
        if (healthConfig.eyeSaver) {
            healthIntervals.eye = setInterval(() => {
                windowManager.createPopupWindow("Eye Saver: Look at something 20 feet away for 20 seconds.", healthConfig.eyeBreakDuration, 'eye', false, healthConfig);
            }, healthConfig.eyeSaverInterval);
        }
        if (healthConfig.postureCheck) {
            healthIntervals.posture = setInterval(() => {
                windowManager.createPopupWindow("Posture Check: Time to sit up straight and stretch for a minute.", healthConfig.postureBreakDuration, 'posture', false, healthConfig);
            }, healthConfig.postureInterval);
        }
    });

    ipcMain.on('stop-health-mode', () => {
        if (healthIntervals.eye) clearInterval(healthIntervals.eye);
        if (healthIntervals.posture) clearInterval(healthIntervals.posture);
        if (windowManager.popupWindow && !windowManager.popupWindow.isDestroyed()) windowManager.popupWindow.close();
    });
}

function cleanup() {
    if (healthIntervals.eye) clearInterval(healthIntervals.eye);
    if (healthIntervals.posture) clearInterval(healthIntervals.posture);
}

module.exports = {
    init,
    cleanup
};
