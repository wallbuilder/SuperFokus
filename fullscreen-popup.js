const { ipcRenderer } = require('electron');

let timerSeconds = 0;
let timerInterval = null;
let isAutoStart = true;

const timerDisplay = document.getElementById('timer');
const nextBtn = document.getElementById('next-btn');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

ipcRenderer.on('set-fullscreen-data', (event, data) => {
    document.getElementById('title').innerText = `${data.type} Time`;
    timerSeconds = data.duration;
    isAutoStart = data.autoStart;
    
    updateDisplay();
    startTimer();
});

function updateDisplay() {
    timerDisplay.innerText = formatTime(timerSeconds);
}

function startTimer() {
    timerInterval = setInterval(() => {
        timerSeconds--;
        if (timerSeconds <= 0) {
            timerSeconds = 0;
            clearInterval(timerInterval);
            onTimerComplete();
        }
        updateDisplay();
    }, 1000);
}

function onTimerComplete() {
    if (isAutoStart) {
        // Automatically close when time is up if autostart is on
        // The main process usually handles this but we'll show button as fallback
    } else {
        nextBtn.style.display = 'block';
    }
}

nextBtn.addEventListener('click', () => {
    ipcRenderer.send('next-phase-triggered');
});
