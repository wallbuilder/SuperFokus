const ipcRenderer = window.electronAPI;

const taskDisplay = document.getElementById('task');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const tasksLeftDisplay = document.getElementById('tasks-left');

let localInterval = null;

function startLocalTick(endTime) {
    if (localInterval) clearInterval(localInterval);
    localInterval = setInterval(() => {
        const seconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (seconds <= 0) {
            clearInterval(localInterval);
            localInterval = null;
        }
    }, 1000);
}

ipcRenderer.on('timer-started-sprint', (data) => {
    startLocalTick(data.endTime);
});

ipcRenderer.on('timer-stopped-sprint', () => {
    if (localInterval) clearInterval(localInterval);
    localInterval = null;
    timerDisplay.innerText = "00:00";
});

ipcRenderer.on('update-display', (data) => {
    if (data.task) taskDisplay.innerText = data.task;
    if (data.timeLeft) timerDisplay.innerText = data.timeLeft;
    if (data.percent !== undefined) progressBar.style.width = `${data.percent}%`;
    if (data.tasksLeft !== undefined) tasksLeftDisplay.innerText = data.tasksLeft;
});

ipcRenderer.on('set-theme', (isDark) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});
