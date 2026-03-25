const { ipcRenderer } = require('electron');

let countdownInterval = null;
let autoCloseTimer = null;

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

function setCloseButtonState(closeBtn, remaining) {
    if (!closeBtn) return;

    if (remaining > 1) {
        closeBtn.disabled = false;
        closeBtn.style.backgroundColor = '#2c3e50';
        closeBtn.style.color = 'white';
        closeBtn.style.boxShadow = '0 0 10px rgba(0,0,0,0.25)';
        closeBtn.title = 'Click to close now';
    } else if (remaining === 1) {
        closeBtn.disabled = true; // final lock at 1s
        closeBtn.style.backgroundColor = '#b0bec5';
        closeBtn.style.color = '#495057';
        closeBtn.style.boxShadow = 'none';
        closeBtn.title = 'Auto-closing momentarily';
    } else {
        closeBtn.disabled = true;
        closeBtn.style.backgroundColor = '#9e9e9e';
        closeBtn.style.color = '#ffffff';
        closeBtn.title = '';
    }
}

function startAutoCloseCountdown(totalSeconds) {
    let remaining = totalSeconds;
    const timerEl = document.getElementById('timer');
    const closeBtn = document.getElementById('close-btn');
    
    if (timerEl) timerEl.innerText = remaining;
    setCloseButtonState(closeBtn, remaining);

    countdownInterval = setInterval(() => {
        remaining -= 1;
        if (timerEl) timerEl.innerText = Math.max(0, remaining);

        setCloseButtonState(closeBtn, Math.max(0, remaining));

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, 1000);
}

ipcRenderer.on('display-message', (event, payload) => {
    clearCountdown();
    
    if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
    }

    let message = '';
    let delay = null;
    let fullscreenData = null;
    let healthType = null;
    let isBlocking = false;
    let closeDelay = 10000; // default 10s

    if (typeof payload === 'string') {
        message = payload;
    } else if (payload && typeof payload === 'object') {
        message = payload.message || payload.text || (payload.type ? `Time for a ${payload.type}!` : '');
        delay = payload.delaySeconds || payload.delay || null;
        fullscreenData = payload.fullscreenData || payload.data || null;
        healthType = payload.healthType || null;
        isBlocking = payload.isBlocking || false;
        closeDelay = payload.closeDelay || 10000;
        
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
    
    // Apply blocking style if in fullscreen mode
    if (isBlocking) {
        document.body.classList.add('blocking');
    } else {
        document.body.classList.remove('blocking');
    }

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
    
    // Start auto-close countdown for health breaks
    if (healthType) {
        // Convert ms to seconds for display
        const closeDelaySeconds = Math.ceil(closeDelay / 1000);
        startAutoCloseCountdown(closeDelaySeconds);
    }
});

// Handle close button click
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (!closeBtn.disabled) {
                ipcRenderer.send('close-popup');
            }
        });
    }
});