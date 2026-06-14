const ipcRenderer = window.electronAPI;

const labelDisplay = document.getElementById('label');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const extraInfoDisplay = document.getElementById('extra-info');

let currentType = 'pomo';
let totalDuration = 0;

function setThemeColor(type) {
    let color = '#6a11cb';
    let color2 = '#2575fc';
    
    if (type === 'pomo') {
        color = '#6a11cb';
        color2 = '#2575fc';
        progressContainer.style.display = 'block';
    } else if (type === 'sprint') {
        color = '#3498db';
        color2 = '#2980b9';
        progressContainer.style.display = 'block';
        extraInfoDisplay.style.display = 'block';
    } else if (type === 'flow') {
        color = '#27ae60';
        color2 = '#2ecc71';
        progressContainer.style.display = 'none';
        extraInfoDisplay.style.display = 'none';
    } else if (type === 'break') {
        color = '#f1c40f';
        color2 = '#f39c12';
        progressContainer.style.display = 'block';
    }
    
    document.body.style.setProperty('--theme-color', color);
    document.body.style.setProperty('--theme-color-2', color2);
}

function formatTime(seconds) {
    if (currentType === 'flow') {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

ipcRenderer.on('timer-tick', (batchedTicks) => {
    // Find the relevant tick for currentType or any active timer
    // In timer-window, we usually only care about the primary active timer
    const data = batchedTicks.find(t => t.id === currentType) || batchedTicks[0];
    if (data) {
        if (currentType === 'flow') {
            timerDisplay.innerText = formatTime(data.total - data.remaining);
        } else {
            timerDisplay.innerText = formatTime(data.remaining);
            if (data.total > 0) {
                const percent = (data.remaining / data.total) * 100;
                progressBar.style.width = `${percent}%`;
            }
        }
    }
});

ipcRenderer.on('init-timer', (type) => {
    currentType = type;
    setThemeColor(type);
    if (type === 'pomo') {
        labelDisplay.innerText = 'Work Session';
        document.title = 'Pomo Timer';
    } else if (type === 'sprint') {
        labelDisplay.innerText = 'Sprint Task';
        document.title = 'Micro-Sprint Timer';
    } else if (type === 'flow') {
        labelDisplay.innerText = 'Flow State';
        document.title = 'Flow State Timer';
    } else if (type === 'break') {
        labelDisplay.innerText = 'Break Time';
        document.title = 'Break Timer';
    }
    
    ipcRenderer.send('request-initial-timer-update', type);
});

ipcRenderer.on('update-timer-window', (data) => {
    if (data.phase || data.task) labelDisplay.innerText = data.phase || data.task;
    if (data.timeLeft) timerDisplay.innerText = data.timeLeft;
    if (data.percent !== undefined) progressBar.style.width = `${data.percent}%`;
    if (data.tasksLeft !== undefined) extraInfoDisplay.innerText = `Remaining Tasks: ${data.tasksLeft}`;
});

ipcRenderer.on('set-theme', (themeData) => {
    // Reset any previous custom styles
    document.body.classList.remove('dark-mode');
    document.body.classList.remove('cyber-green-mode');
    document.documentElement.style.cssText = '';

    if (themeData.mode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (themeData.mode === 'cyber-green') {
        document.body.classList.add('cyber-green-mode');
    } else if (themeData.mode === 'custom' && themeData.colors) {
        for (const [variable, value] of Object.entries(themeData.colors)) {
            document.documentElement.style.setProperty(variable, value);
        }
    }
});
