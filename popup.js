const { ipcRenderer } = require('electron');

let autoCloseTimer = null;
let timeRemaining = 0;
const closeBtn = document.getElementById('close-btn');
const timerSpan = document.getElementById('timer');

function startAutoClose(delayMs = 10000) {
    timeRemaining = Math.round(delayMs / 1000);
    updateTimerDisplay();
    
    autoCloseTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 1) {
            closeBtn.disabled = true;
        }
        
        if (timeRemaining <= 0) {
            clearInterval(autoCloseTimer);
            window.close();
        }
    }, 1000);
}

function updateTimerDisplay() {
    timerSpan.innerText = timeRemaining;
}

function stopAutoClose() {
    if (autoCloseTimer) {
        clearInterval(autoCloseTimer);
        autoCloseTimer = null;
    }
    closeBtn.disabled = false;
    closeBtn.innerText = 'Closes in (10)';
}

closeBtn.addEventListener('click', () => {
    stopAutoClose();
    window.close();
});

closeBtn.addEventListener('mouseenter', () => {
    if (!closeBtn.disabled) {
        closeBtn.innerText = 'Close now';
    }
});

closeBtn.addEventListener('mouseleave', () => {
    if (autoCloseTimer) {
        closeBtn.innerText = `Closes in (${timeRemaining})`;
    }
});

window.addEventListener('beforeunload', () => {
    stopAutoClose();
});

ipcRenderer.on('display-message', (event, data) => {
    // Handle both old format (string) and new format (object with message and closeDelay)
    const message = typeof data === 'string' ? data : data.message;
    const closeDelay = typeof data === 'string' ? 10000 : (data.closeDelay || 10000);
    
    document.getElementById('message-content').innerText = message;
    startAutoClose(closeDelay);
});