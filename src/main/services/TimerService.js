const { ipcMain } = require('electron');
const windowManager = require('./WindowManager');

let timers = {};
let timerInterval = null;

function startTimerService() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        const now = Date.now();
        let activeTimersCount = 0;

        for (const id in timers) {
            const timer = timers[id];
            if (!timer.isRunning) continue;

            activeTimersCount++;
            const remaining = Math.max(0, Math.round((timer.endTime - now) / 1000));
            
            windowManager.broadcastToWindows('timer-tick', { id, remaining, total: timer.totalSeconds });

            if (remaining <= 0) {
                timer.isRunning = false;
                timer.remainingSeconds = 0;
                windowManager.broadcastToWindows(`timer-complete-${id}`, id);
                
                if (id.includes('break') || id.includes('pomo')) {
                    windowManager.forceKillFullscreen();
                }
            }
        }

        if (activeTimersCount === 0) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

function init() {
    windowManager.setFullscreenClosureCheck(() => {
        const breakOrPomoRunning = Object.entries(timers).some(([id, t]) => {
            if (!t.isRunning || (!id.includes('break') && !id.includes('pomo'))) return false;
            return (t.endTime - Date.now()) > 1000;
        });
        
        const justOpened = windowManager.fullscreenWindow && !windowManager.fullscreenWindow.isDestroyed() && 
                          windowManager.fullscreenWindow.openedAt && (Date.now() - windowManager.fullscreenWindow.openedAt < 1000);

        return !breakOrPomoRunning && !justOpened;
    });

    ipcMain.on('start-timer', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        const { id, seconds } = data;
        const durationMs = seconds * 1000;
        const endTime = Date.now() + durationMs;

        timers[id] = {
            totalSeconds: seconds,
            remainingSeconds: seconds,
            endTime: endTime,
            isRunning: true
        };

        windowManager.broadcastToWindows(`timer-started-${id}`, { id, endTime, seconds });
        startTimerService();
    });

    ipcMain.on('stop-timer', (event, id) => {
        if (timers[id]) {
            timers[id].isRunning = false;
            timers[id].remainingSeconds = 0;
        }
        windowManager.broadcastToWindows(`timer-stopped-${id}`, id);
        if (id && (id.includes('break') || id.includes('pomo'))) {
            windowManager.forceKillFullscreen();
        }
    });

    ipcMain.on('pause-timer', (event, id) => {
        if (timers[id] && timers[id].isRunning) {
            timers[id].isRunning = false;
            timers[id].remainingSeconds = Math.max(0, Math.round((timers[id].endTime - Date.now()) / 1000));
        }
        windowManager.broadcastToWindows(`timer-paused-${id}`, id, timers[id] ? timers[id].remainingSeconds : 0);
    });

    ipcMain.on('resume-timer', (event, id) => {
        if (timers[id] && !timers[id].isRunning && timers[id].remainingSeconds > 0) {
            const durationMs = timers[id].remainingSeconds * 1000;
            const endTime = Date.now() + durationMs;
            timers[id].endTime = endTime;
            timers[id].isRunning = true;
            
            windowManager.broadcastToWindows(`timer-resumed-${id}`, { id, endTime, seconds: timers[id].remainingSeconds });
            startTimerService();
        }
    });

    ipcMain.on('show-break-popup', (event, data) => {
        if (data.fullScreen) {
            windowManager.createFullscreenWindow(data);
        } else {
            windowManager.createPopupWindow(data.message || `Time for a ${data.type}!`, 10000, null, true);
        }
    });

    ipcMain.on('close-fullscreen', () => {
        const breakOrPomoRunning = Object.entries(timers).some(([id, t]) => {
            if (!t.isRunning || (!id.includes('break') && !id.includes('pomo'))) return false;
            return (t.endTime - Date.now()) > 1000;
        });
        
        const justOpened = windowManager.fullscreenWindow && !windowManager.fullscreenWindow.isDestroyed() && 
                          windowManager.fullscreenWindow.openedAt && (Date.now() - windowManager.fullscreenWindow.openedAt < 1000);

        if (breakOrPomoRunning || justOpened) return;

        windowManager.forceKillFullscreen();
        if (windowManager.pomoTimerWindow && !windowManager.pomoTimerWindow.isDestroyed() && windowManager.pomoTimerWindow.isVisible()) {
            windowManager.pomoTimerWindow.show();
            windowManager.pomoTimerWindow.focus();
            windowManager.pomoTimerWindow.setAlwaysOnTop(true);
        }
    });
}

function cleanup() {
    if (timerInterval) clearInterval(timerInterval);
    timers = {};
}

module.exports = {
    init,
    cleanup,
    getTimers: () => timers
};
