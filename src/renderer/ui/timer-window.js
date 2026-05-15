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
    localInterval = setInterval(() => {
        const seconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        
        if (currentType === 'flow') {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            timerDisplay.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } else {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (totalDuration > 0 && currentType !== 'flow') {
            const percent = (seconds / totalDuration) * 100;
            progressBar.style.width = `${percent}%`;
        }
        
        if (seconds <= 0) {
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
});

// Generic listeners for all timer types
const timerEvents = ['pomo', 'sprint', 'flow', 'workflow-break'];

timerEvents.forEach(id => {
    ipcRenderer.on(`timer-started-${id}`, (data) => {
        if (id.includes(currentType) || (currentType === 'break' && id === 'workflow-break')) {
            startLocalTick(data.endTime, data.seconds);
        }
    });

    ipcRenderer.on(`timer-paused-${id}`, (targetId, remainingSeconds) => {
        if (id.includes(currentType) || (currentType === 'break' && id === 'workflow-break')) {
            if (localInterval) clearInterval(localInterval);
            localInterval = null;
            timerDisplay.classList.add('paused');
            // Update display manually
            const mins = Math.floor(remainingSeconds / 60);
            const secs = remainingSeconds % 60;
            timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    });

    ipcRenderer.on(`timer-resumed-${id}`, (data) => {
        if (id.includes(currentType) || (currentType === 'break' && id === 'workflow-break')) {
            timerDisplay.classList.remove('paused');
            startLocalTick(data.endTime);
        }
    });

    ipcRenderer.on(`timer-stopped-${id}`, () => {
        if (id.includes(currentType) || (currentType === 'break' && id === 'workflow-break')) {
            if (localInterval) clearInterval(localInterval);
            localInterval = null;
            timerDisplay.innerText = currentType === 'flow' ? "00:00:00" : "00:00";
            progressBar.style.width = "0%";
            timerDisplay.classList.remove('paused');
        }
    });
});

ipcRenderer.on('update-display', (data) => {
    if (data.phase || data.task) labelDisplay.innerText = data.phase || data.task;
    if (data.timeLeft) timerDisplay.innerText = data.timeLeft;
    if (data.percent !== undefined) progressBar.style.width = `${data.percent}%`;
    if (data.tasksLeft !== undefined) extraInfoDisplay.innerText = `Remaining Tasks: ${data.tasksLeft}`;
});

ipcRenderer.on('set-theme', (isDark) => {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});
