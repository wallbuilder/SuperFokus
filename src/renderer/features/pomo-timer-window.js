const ipcRenderer = window.electronAPI;

const phaseDisplay = document.getElementById('phase');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'pomo') {
        const mins = Math.floor(data.seconds / 60);
        const secs = data.seconds % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (data.phase) phaseDisplay.innerText = data.phase;
        if (data.percent !== undefined) progressBar.style.width = `${data.percent}%`;
    }
});

// Fallback or explicit update events
ipcRenderer.on('update-display', (data) => {
    if (data.phase) phaseDisplay.innerText = data.phase;
    if (data.timeLeft) timerDisplay.innerText = data.timeLeft;
    if (data.percent !== undefined) progressBar.style.width = `${data.percent}%`;
});

ipcRenderer.on('set-theme', (isDark) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});
