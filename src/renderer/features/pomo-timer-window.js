const ipcRenderer = window.electronAPI;

const phaseDisplay = document.getElementById('phase');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

let localInterval = null;
let totalDuration = 0;

function startLocalTick(endTime, duration) {
    if (duration) totalDuration = duration;
    if (localInterval) clearInterval(localInterval);
    localInterval = setInterval(() => {
        const seconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (totalDuration > 0) {
            const percent = (seconds / totalDuration) * 100;
            progressBar.style.width = `${percent}%`;
        }
        
        if (seconds <= 0) {
            clearInterval(localInterval);
            localInterval = null;
        }
    }, 1000);
}

ipcRenderer.on('timer-started-pomo', (data) => {
    startLocalTick(data.endTime, data.seconds);
});

ipcRenderer.on('timer-paused-pomo', (remainingSeconds) => {
    if (localInterval) clearInterval(localInterval);
    localInterval = null;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (totalDuration > 0) {
        const percent = (remainingSeconds / totalDuration) * 100;
        progressBar.style.width = `${percent}%`;
    }
});

ipcRenderer.on('timer-resumed-pomo', (data) => {
    startLocalTick(data.endTime);
});

ipcRenderer.on('timer-stopped-pomo', () => {
    if (localInterval) clearInterval(localInterval);
    localInterval = null;
    timerDisplay.innerText = "00:00";
    progressBar.style.width = "0%";
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
