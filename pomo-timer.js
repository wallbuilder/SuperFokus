const { ipcRenderer } = require('electron');

const phaseEl = document.getElementById('phase');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');

ipcRenderer.on('update-display', (event, data) => {
    phaseEl.innerText = data.phase;
    timerEl.innerText = data.timeLeft;
    progressBar.style.width = `${data.percent}%`;
    
    // Change color based on phase
    if (data.phase.includes('Work')) {
        progressBar.style.backgroundColor = '#27ae60';
    } else {
        progressBar.style.backgroundColor = '#e67e22';
    }
});