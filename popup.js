const { ipcRenderer } = require('electron');

let countdownInterval = null;

function clearCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    const el = document.getElementById('popup-countdown');
    if (el) el.remove();
}

function createOrUpdateCountdown(seconds) {
    let el = document.getElementById('popup-countdown');
    if (!el) {
        el = document.createElement('div');
        el.id = 'popup-countdown';
        el.style.position = 'absolute';
        el.style.right = '12px';
        el.style.bottom = '12px';
        el.style.padding = '6px 10px';
        el.style.background = 'rgba(0,0,0,0.6)';
        el.style.color = 'white';
        el.style.borderRadius = '6px';
        el.style.fontSize = '14px';
        el.style.zIndex = 9999;
        document.body.appendChild(el);
    }
    el.innerText = `Expanding in ${seconds}s`;
}

function startCountdown(delaySeconds, fullscreenData) {
    clearCountdown();
    let remaining = Math.max(0, Math.floor(delaySeconds));
    createOrUpdateCountdown(remaining);
    countdownInterval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearCountdown();
            ipcRenderer.send('blocker-expand-fullscreen', fullscreenData || {});
        } else {
            createOrUpdateCountdown(remaining);
        }
    }, 1000);
}

ipcRenderer.on('display-message', (event, payload) => {
    clearCountdown();

    let message = '';
    let delay = null;
    let fullscreenData = null;

    if (typeof payload === 'string') {
        message = payload;
    } else if (payload && typeof payload === 'object') {
        // Some callers pass an object (e.g., { type, duration, fullScreen, autoStart })
        message = payload.message || payload.text || (payload.type ? `Time for a ${payload.type}!` : '');
        delay = payload.delaySeconds || payload.delay || null;
        fullscreenData = payload.fullscreenData || payload.data || null;
        // If no explicit fullscreenData provided, build one from common fields
        if (!fullscreenData) {
            fullscreenData = {
                type: payload.type || 'Break',
                duration: payload.duration || payload.seconds || 0,
                autoStart: payload.autoStart || false,
                fullScreen: payload.fullScreen || false
            };
        }
    }

    const msgEl = document.getElementById('message-content');
    if (msgEl) msgEl.innerText = message;

    // Determine effective delay: payload -> localStorage -> default 5s
    const stored = localStorage.getItem('macPopupDelay');
    const defaultDelay = 5;
    if (delay == null) {
        if (stored !== null) {
            const parsed = parseInt(stored, 10);
            delay = Number.isNaN(parsed) ? defaultDelay : parsed;
        } else {
            delay = defaultDelay;
        }
    }

    // Only auto-start countdown on macOS; on other platforms show message only
    if (process.platform === 'darwin' && delay && Number(delay) > 0) {
        startCountdown(Number(delay), fullscreenData);
    }
});