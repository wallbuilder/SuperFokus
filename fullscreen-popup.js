const { ipcRenderer } = require('electron');

const breakTypeEl = document.getElementById('break-type');
const timerEl = document.getElementById('timer');

let timeLeft = 0;
let timerInterval = null;

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

ipcRenderer.on('set-fullscreen-data', (event, data) => {
    breakTypeEl.innerText = data.type;
    timeLeft = data.duration;
    timerEl.innerText = formatTime(timeLeft);
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) {
            clearInterval(timerInterval);
        } else {
            timerEl.innerText = formatTime(timeLeft);
        }
    }, 1000);
});