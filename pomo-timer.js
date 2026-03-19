const { ipcRenderer } = require('electron');

const phaseDisplay = document.getElementById('phase');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

ipcRenderer.on('update-display', (event, data) => {
    phaseDisplay.innerText = data.phase;
    timerDisplay.innerText = data.timeLeft;
    progressBar.style.width = `${data.percent}%`;
});

ipcRenderer.on('set-theme', (event, isDark) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});
