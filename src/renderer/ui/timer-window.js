const ipcRenderer = window.electronAPI;

const labelDisplay = document.getElementById('label');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const extraInfoDisplay = document.getElementById('extra-info');

let currentType = 'pomo';
let localInterval = null;
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

function startLocalTick(endTime, duration) {
    if (duration) totalDuration = duration;
    if (localInterval) clearInterval(localInterval);
    const startTime = endTime - (totalDuration * 1000);

    localInterval = setInterval(() => {
        const now = Date.now();
        const secondsRemaining = Math.max(0, Math.round((endTime - now) / 1000));
        const secondsElapsed = Math.round((now - startTime) / 1000);
        
        if (currentType === 'flow') {
            const h = Math.floor(secondsElapsed / 3600);
            const m = Math.floor((secondsElapsed % 3600) / 60);
            const s = secondsElapsed % 60;
            timerDisplay.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } else {
            const mins = Math.floor(secondsRemaining / 60);
            const secs = secondsRemaining % 60;
            timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (totalDuration > 0 && currentType !== 'flow') {
            const percent = (secondsRemaining / totalDuration) * 100;
            progressBar.style.width = `${percent}%`;
        }
        
        if (secondsRemaining <= 0 && currentType !== 'flow') {
            clearInterval(localInterval);
            localInterval = null;
        }
    }, 1000);
}

ipcRenderer.on('init-timer', (type) => {
    currentType = type;
    setThemeColor(type);
    if (type === 'pomo') labelDisplay.innerText = 'Work Session';
    else if (type === 'sprint') labelDisplay.innerText = 'Sprint Task';
    else if (type === 'flow') labelDisplay.innerText = 'Flow State';
    else if (type === 'break') labelDisplay.innerText = 'Break Time';
    
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
    document.documentElement.style.cssText = '';

    if (themeData.mode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (themeData.mode === 'custom' && themeData.colors) {
        for (const [variable, value] of Object.entries(themeData.colors)) {
            document.documentElement.style.setProperty(variable, value);
        }
    }
});
