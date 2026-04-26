const ipcRenderer = window.electronAPI;

let expandInterval = null;
let autoCloseInterval = null;

function clearCountdown() {
    if (expandInterval) {
        clearInterval(expandInterval);
        expandInterval = null;
    }
    const el = document.getElementById('popup-countdown');
    if (el) el.remove();
}

function createOrUpdateCountdown(seconds) {
    let el = document.getElementById('popup-countdown');
    if (!el) {
        el = document.createElement('div');
        el.id = 'popup-countdown';
        document.body.appendChild(el);
    }
    el.innerText = `Expanding in ${seconds}s`;
}

function startCountdown(delaySeconds, fullscreenData) {
    clearCountdown();
    let remaining = Math.max(0, Math.floor(delaySeconds));
    createOrUpdateCountdown(remaining);
    expandInterval = setInterval(() => {
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
    const btnText = document.getElementById('close-btn-text');
    if (!btnText) return;

    const isHovered = closeBtn.matches(':hover');

    if (remaining > 1) {
        closeBtn.disabled = false;
        closeBtn.title = 'Click to close now';
        btnText.innerText = isHovered ? 'Close now' : `Closes in (${remaining})`;
    } else if (remaining === 1) {
        closeBtn.disabled = true; // final lock at 1s
        closeBtn.title = 'Auto-closing momentarily';
        btnText.innerText = `Closes in (1)`;
    } else {
        closeBtn.disabled = true;
        closeBtn.title = '';
        btnText.innerText = `Closing...`;
    }
}

function startAutoCloseCountdown(totalSeconds) {
    let remaining = totalSeconds;
    const closeBtn = document.getElementById('close-btn');
    
    setCloseButtonState(closeBtn, remaining);

    if (autoCloseInterval) clearInterval(autoCloseInterval);
    autoCloseInterval = setInterval(() => {
        remaining -= 1;
        setCloseButtonState(closeBtn, Math.max(0, remaining));

        if (remaining <= 0) {
            clearInterval(autoCloseInterval);
            autoCloseInterval = null;
            ipcRenderer.send('close-popup');
        }
    }, 1000);
}

ipcRenderer.on('set-theme', (isDark) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});

ipcRenderer.on('display-message', (payload) => {
    clearCountdown();
    
    if (autoCloseInterval) {
        clearInterval(autoCloseInterval);
        autoCloseInterval = null;
    }

    let message = '';
    let delay = null;
    let fullscreenData = null;
    let healthType = null;
    let isBlocking = false;
    let closeDelay = 10000; // default 10s
    let isAutoclose = false;

    if (typeof payload === 'string') {
        message = payload;
    } else if (payload && typeof payload === 'object') {
        message = payload.message || payload.text || (payload.type ? `Time for a ${payload.type}!` : '');
        delay = payload.delaySeconds || payload.delay || null;
        fullscreenData = payload.fullscreenData || payload.data || null;
        healthType = payload.healthType || null;
        isBlocking = payload.isBlocking || false;
        closeDelay = payload.closeDelay || 10000;
        isAutoclose = payload.isAutoclose || false;
        
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
    if (window.electronAPI.platform === 'darwin' && delay && Number(delay) > 0 && isBlocking) {
        startCountdown(Number(delay), fullscreenData);
    }
    
    // Start auto-close countdown for health breaks and repeating reminders
    if (healthType || isAutoclose) {
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
        closeBtn.addEventListener('mouseenter', () => {
            if (!closeBtn.disabled) {
                const btnText = document.getElementById('close-btn-text');
                if (btnText) btnText.innerText = 'Close now';
            }
        });
    }
});