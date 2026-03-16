const { ipcRenderer } = require('electron');

const phaseDisplay = document.getElementById('phase');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

ipcRenderer.on('update-display', (event, data) => {
    phaseDisplay.innerText = data.phase;
    timerDisplay.innerText = data.timeLeft;
    progressBar.style.width = `${data.percent}%`;
});
