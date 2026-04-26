const ipcRenderer = window.electronAPI;

const taskDisplay = document.getElementById('task');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const tasksLeftDisplay = document.getElementById('tasks-left');

ipcRenderer.on('timer-tick', (data) => {
    if (data.id === 'sprint') {
        const mins = Math.floor(data.seconds / 60);
        const secs = data.seconds % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (data.percent !== undefined) progressBar.style.width = `${data.percent}%`;
    }
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
