const ipcRenderer = window.electronAPI;

const phaseDisplay = document.getElementById('phase');
const timerDisplay = document.getElementById('timer');

ipcRenderer.on('update-display', (data) => {
    if (data.phase) phaseDisplay.innerText = data.phase;
    if (data.timeLeft) timerDisplay.innerText = data.timeLeft;
});

ipcRenderer.on('set-theme', (isDark) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});
