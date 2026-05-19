const ipcRenderer = window.electronAPI;

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

ipcRenderer.on('set-theme', (themeData) => {
    // Reset any previous custom styles
    document.body.classList.remove('dark-mode');
    document.documentElement.style.cssText = '';

    if (themeData.mode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (themeData.mode === 'custom' && themeData.colors) {
        for (const [variable, value] of Object.entries(themeData.colors)) {
            document.documentElement.style.setProperty(variable, value);
        }
    }
});

ipcRenderer.on('set-fullscreen-data', (data) => {
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
    const endTime = Date.now() + (timerSeconds * 1000);
    timerInterval = setInterval(() => {
        const remaining = Math.round((endTime - Date.now()) / 1000);
        timerSeconds = Math.max(0, remaining);
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
