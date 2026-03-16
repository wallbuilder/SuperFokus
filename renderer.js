const { ipcRenderer } = require('electron');
const Chart = require('chart.js/auto');

const store = {
    get: (key, defaultValue) => {
        const val = localStorage.getItem(key);
        return val !== null ? JSON.parse(val) : defaultValue;
    },
    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// --- Theme & Setup ---
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleModalBtn = document.getElementById('theme-toggle-modal');
const headerDarkModeToggleCheckbox = document.getElementById('toggle-header-dark-mode');

let isDarkMode = store.get('darkMode', false);
let showHeaderDarkModeToggle = store.get('showHeaderDarkModeToggle', true);

function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerText = '☀️ Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggleBtn.innerText = '🌙 Dark Mode';
    }
}

function applyHeaderToggleVisibility() {
    themeToggleBtn.style.display = showHeaderDarkModeToggle ? 'block' : 'none';
    if (headerDarkModeToggleCheckbox) {
        headerDarkModeToggleCheckbox.checked = showHeaderDarkModeToggle;
    }
}

applyTheme();
applyHeaderToggleVisibility();

function toggleTheme() {
    isDarkMode = !isDarkMode;
    store.set('darkMode', isDarkMode);
    applyTheme();
}

themeToggleBtn.addEventListener('click', toggleTheme);
if (themeToggleModalBtn) themeToggleModalBtn.addEventListener('click', toggleTheme);

if (headerDarkModeToggleCheckbox) {
    headerDarkModeToggleCheckbox.addEventListener('change', (e) => {
        showHeaderDarkModeToggle = e.target.checked;
        store.set('showHeaderDarkModeToggle', showHeaderDarkModeToggle);
        applyHeaderToggleVisibility();
    });
}

// Startup Animation Logic
window.addEventListener('DOMContentLoaded', () => {
  const startupScreen = document.getElementById('startup-screen');
  setTimeout(() => {
    startupScreen.style.opacity = '0';
    setTimeout(() => {
      startupScreen.style.display = 'none';
    }, 1000); 
  }, 2000); // v0.3.5: slightly longer to appreciate the animation
});

// --- Audio ---
const chimeAudio = document.getElementById('chime-audio');
function playChime() {
    if (chimeAudio) {
        chimeAudio.play().catch(e => console.log('Audio play failed or file missing:', e));
    }
}

// --- Side Menu & Modals ---
const menuToggleBtn = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const menuIcon = menuToggleBtn.querySelector('.icon');

function toggleSidebar() {
    const isOpen = sideMenu.classList.toggle('open');
    menuIcon.innerText = isOpen ? '✕' : '☰';
    menuIcon.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

function closeSidebar() {
    if (sideMenu.classList.contains('open')) {
        toggleSidebar();
    }
}

menuToggleBtn.addEventListener('click', toggleSidebar);

// Modal Logic
const modalOverlays = document.querySelectorAll('.modal-overlay');
const menuItems = document.querySelectorAll('.menu-item');
const modalCloses = document.querySelectorAll('.modal-close');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        const modalId = item.getAttribute('data-modal');
        const modal = document.getElementById(modalId);
        if (modal) {
            // Close other modals first to prevent stacking
            modalOverlays.forEach(m => m.classList.remove('active'));
            modal.classList.add('active');
        }
    });
});

modalCloses.forEach(close => {
    close.addEventListener('click', () => {
        close.closest('.modal-overlay').classList.remove('active');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Stats Logic
let totalFocusTime = store.get('totalFocusTime', 0); // in minutes
let completedRounds = store.get('completedRounds', 0);
let dailyStats = store.get('dailyStats', {}); // { "YYYY-MM-DD": minutes }
let sessionHistory = store.get('sessionHistory', []); // [{ time, mode, duration }]

function updateStatsUI() {
    const statTotalTimeEl = document.getElementById('stat-total-time');
    const statRoundsEl = document.getElementById('stat-rounds');
    if (statTotalTimeEl) statTotalTimeEl.innerText = `${totalFocusTime}m`;
    if (statRoundsEl) statRoundsEl.innerText = completedRounds;
    renderHistory();
}

function renderHistory() {
    const sessionHistoryLog = document.getElementById('session-history-log');
    if (!sessionHistoryLog) return;

    if (sessionHistory.length === 0) {
        sessionHistoryLog.innerHTML = '<div style="color: var(--timer-subtext); text-align: center;">No history yet.</div>';
        return;
    }
    
    sessionHistoryLog.innerHTML = sessionHistory.slice().reverse().map(session => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 8px 0;">
            <div style="font-weight: bold; color: var(--timer-text);">${session.mode}</div>
            <div style="display: flex; justify-content: space-between; color: var(--timer-subtext); font-size: 0.8rem;">
                <span>${new Date(session.time).toLocaleString()}</span>
                <span>${session.duration}m focused</span>
            </div>
        </div>
    `).join('');
}

updateStatsUI();

function recordFocusSession(minutes, mode = 'Focus Session') {
    totalFocusTime += minutes;
    completedRounds += 1;
    
    const now = new Date();
    sessionHistory.push({
        time: now.toISOString(),
        mode: mode,
        duration: minutes
    });
    
    if (sessionHistory.length > 50) sessionHistory.shift();
    
    store.set('totalFocusTime', totalFocusTime);
    store.set('completedRounds', completedRounds);
    store.set('sessionHistory', sessionHistory);
    
    const today = now.toISOString().split('T')[0];
    dailyStats[today] = (dailyStats[today] || 0) + minutes;
    store.set('dailyStats', dailyStats);
    
    updateStatsUI();
    renderChart();
}

// Chart.js
let statsChartInstance = null;
function renderChart() {
    const canvas = document.getElementById('statsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        data.push(dailyStats[dateStr] || 0);
    }

    if (statsChartInstance) {
        statsChartInstance.destroy();
    }

    statsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Focus Minutes',
                data: data,
                backgroundColor: 'rgba(106, 17, 203, 0.6)',
                borderColor: 'rgba(106, 17, 203, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
renderChart();

// --- Mode Switching ---
const fokusModeSelect = document.getElementById('fokus-mode');
const configSections = {
  'repeating-reminders': document.getElementById('config-repeating-reminders'),
  'pomo-style': document.getElementById('config-pomo-style'),
  'site-blocker': document.getElementById('config-site-blocker')
};

fokusModeSelect.addEventListener('change', (event) => {
  Object.values(configSections).forEach(section => {
    if (section) section.classList.remove('active');
  });
  if (configSections[event.target.value]) {
    configSections[event.target.value].classList.add('active');
  }
});

function setInputsLocked(sectionId, locked) {
    const section = document.getElementById(sectionId);
    const inputs = section.querySelectorAll('input, select, textarea, button:not(.start-btn):not(.stop-btn):not(.continue-btn)');
    inputs.forEach(input => {
        input.disabled = locked;
    });
    fokusModeSelect.disabled = locked;
}

function toggleStartStopButton(btnElement) {
  if (btnElement.classList.contains('start-btn')) {
    btnElement.classList.remove('start-btn');
    btnElement.classList.add('stop-btn');
    btnElement.innerHTML = 'Stop \u2715';
  } else {
    btnElement.classList.remove('stop-btn');
    btnElement.classList.add('start-btn');
    btnElement.innerHTML = 'Start \u27A4';
  }
}

// --- Dynamic Pomo Sequence ---
let pomoSequence = [
    { type: 'work', duration: 25 },
    { type: 'break', duration: 5 }
];
const sequenceListEl = document.getElementById('pomo-sequence-list');
const addWorkBtn = document.getElementById('add-work-btn');
const addBreakBtn = document.getElementById('add-break-btn');

function renderSequence() {
    sequenceListEl.innerHTML = '';
    pomoSequence.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'sequence-item';
        div.innerHTML = `
            <span>${item.type === 'work' ? 'Work' : 'Break'} Phase</span>
            <div>
                <input type="number" min="1" value="${item.duration}" data-index="${index}"> mins
                <button class="remove-btn" data-index="${index}">X</button>
            </div>
        `;
        sequenceListEl.appendChild(div);
    });

    sequenceListEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            pomoSequence[idx].duration = parseInt(e.target.value, 10) || 1;
        });
    });
    sequenceListEl.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            pomoSequence.splice(idx, 1);
            renderSequence();
        });
    });
}
renderSequence();

addWorkBtn.addEventListener('click', () => { pomoSequence.push({ type: 'work', duration: 25 }); renderSequence(); });
addBreakBtn.addEventListener('click', () => { pomoSequence.push({ type: 'break', duration: 5 }); renderSequence(); });

// Pomo State
let isPomoRunning = false;
let pomoInterval = null;
let pomoTimer = 0;
let currentPhaseIndex = 0;
let currentRepeatCount = 0;
let totalRepeatsPlanned = 1;

const startPomoBtn = document.getElementById('start-pomo-btn');
const continuePomoBtn = document.getElementById('continue-pomo-btn');
const pomoAutostartCheckbox = document.getElementById('pomo-autostart');
const pomoInfiniteCheckbox = document.getElementById('pomo-infinite');
const pomoRepeatsInput = document.getElementById('pomo-repeats');
const pomoTimerDisplay = document.getElementById('pomo-timer-display');
const pomoTimeLeft = document.getElementById('pomo-time-left');
const pomoStatusText = document.getElementById('pomo-status-text');
const pomoRoundsLeft = document.getElementById('pomo-rounds-left');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updatePomoDisplay() {
    pomoTimeLeft.innerText = formatTime(pomoTimer);
    const currentPhase = pomoSequence[currentPhaseIndex];
    pomoStatusText.innerText = currentPhase ? (currentPhase.type === 'work' ? 'Work Session' : 'Break Time') : 'Finished';
    
    const nextPhaseIdx = currentPhaseIndex + 1;
    let nextText = '--';
    if (nextPhaseIdx < pomoSequence.length) {
        const nextPhase = pomoSequence[nextPhaseIdx];
        nextText = `${nextPhase.type === 'work' ? 'Work' : 'Break'} (${nextPhase.duration}m)`;
    } else if (pomoInfiniteCheckbox.checked || currentRepeatCount + 1 < totalRepeatsPlanned) {
        const firstPhase = pomoSequence[0];
        nextText = `Repeat: ${firstPhase.type === 'work' ? 'Work' : 'Break'} (${firstPhase.duration}m)`;
    } else {
        nextText = 'Finish';
    }
    pomoRoundsLeft.innerText = `Next: ${nextText}`;

    ipcRenderer.send('update-pomo-timer', {
        phase: pomoStatusText.innerText,
        timeLeft: formatTime(pomoTimer),
        percent: currentPhase ? (pomoTimer / (currentPhase.duration * 60)) * 100 : 0
    });
}

function startPomoPhase() {
    if (currentPhaseIndex >= pomoSequence.length) {
        currentRepeatCount++;
        if (pomoInfiniteCheckbox.checked || currentRepeatCount < totalRepeatsPlanned) {
            currentPhaseIndex = 0;
        } else {
            stopPomoStyle();
            return;
        }
    }
    
    continuePomoBtn.style.display = 'none';
    const currentPhase = pomoSequence[currentPhaseIndex];
    pomoTimer = currentPhase.duration * 60;
    updatePomoDisplay();

    if (currentPhase.type === 'break') {
        const pomoAction = document.querySelector('input[name="pomo-action"]:checked').value;
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', 
            duration: currentPhase.duration * 60, 
            fullScreen: (pomoAction === 'block'),
            autoStart: pomoAutostartCheckbox.checked
        });
    }

    pomoInterval = setInterval(() => {
        pomoTimer--;
        if (pomoTimer < 0) {
            clearInterval(pomoInterval);
            handlePhaseEnd();
        } else {
            updatePomoDisplay();
        }
    }, 1000);
}

function handlePhaseEnd() {
    playChime();
    const finishedPhase = pomoSequence[currentPhaseIndex];
    if (finishedPhase.type === 'work') {
        recordFocusSession(finishedPhase.duration, 'Pomo Work');
    }
    
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
    
    currentPhaseIndex++;
    
    if (currentPhaseIndex >= pomoSequence.length && !pomoInfiniteCheckbox.checked && currentRepeatCount + 1 >= totalRepeatsPlanned) {
        stopPomoStyle();
        return;
    }

    if (pomoAutostartCheckbox.checked) {
        startPomoPhase();
    } else {
        updatePomoDisplay();
        continuePomoBtn.style.display = 'block';
    }
}

function stopPomoStyle() {
    isPomoRunning = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
    toggleStartStopButton(startPomoBtn);
    setInputsLocked('config-pomo-style', false);
    pomoTimerDisplay.classList.add('hidden');
    continuePomoBtn.style.display = 'none';
    ipcRenderer.send('close-pomo-timer');
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
}

startPomoBtn.addEventListener('click', () => {
    if (!isPomoRunning) {
        if (pomoSequence.length === 0) {
            alert('Please add at least one phase to the sequence.');
            return;
        }
        totalRepeatsPlanned = parseInt(pomoRepeatsInput.value, 10) || 1;
        isPomoRunning = true;
        currentPhaseIndex = 0;
        currentRepeatCount = 0;
        toggleStartStopButton(startPomoBtn);
        setInputsLocked('config-pomo-style', true);
        pomoTimerDisplay.classList.remove('hidden');
        ipcRenderer.send('open-pomo-timer');
        startPomoPhase();
    } else {
        stopPomoStyle();
    }
});

continuePomoBtn.addEventListener('click', startPomoPhase);

ipcRenderer.on('start-next-phase', () => {
    startPomoPhase();
});

// --- Repeating Reminders ---
const infiniteRoundsCheckbox = document.getElementById('infinite-rounds');
const roundsContainer = document.getElementById('rounds-container');
const infiniteStatus = document.getElementById('infinite-status');
const startRepeatingBtn = document.getElementById('start-repeating-btn');
const reminderIntervalInput = document.getElementById('reminder-interval');
const reminderRoundsInput = document.getElementById('reminder-rounds');
const reminderMessageInput = document.getElementById('reminder-message');
const repeatingTimerDisplay = document.getElementById('repeating-timer-display');
const repeatingTimeLeft = document.getElementById('repeating-time-left');
const repeatingRoundsLeft = document.getElementById('repeating-rounds-left');

let repeatingInterval = null;
let repeatingTimer = null;
let currentRounds = 0;
let isRepeatingRunning = false;

infiniteRoundsCheckbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    roundsContainer.classList.add('hidden');
    infiniteStatus.style.display = 'block';
  } else {
    roundsContainer.classList.remove('hidden');
    infiniteStatus.style.display = 'none';
  }
});

function updateRepeatingDisplay() {
    repeatingTimeLeft.innerText = formatTime(repeatingTimer);
    if (infiniteRoundsCheckbox.checked) {
        repeatingRoundsLeft.innerText = 'Infinite rounds remaining. Press Stop to exit this mode.';
    } else {
        repeatingRoundsLeft.innerText = `Rounds remaining: ${currentRounds}`;
    }
}

function startRepeatingReminders() {
    const intervalMins = parseInt(reminderIntervalInput.value, 10);
    const rounds = parseInt(reminderRoundsInput.value, 10);
    const isInfinite = infiniteRoundsCheckbox.checked;

    if (isNaN(intervalMins) || intervalMins <= 0) return alert('Please enter a valid interval.');
    if (!isInfinite && (isNaN(rounds) || rounds <= 0)) return alert('Please enter a valid number of rounds.');

    isRepeatingRunning = true;
    currentRounds = isInfinite ? Infinity : rounds;
    repeatingTimer = intervalMins * 60;
    
    toggleStartStopButton(startRepeatingBtn);
    setInputsLocked('config-repeating-reminders', true);
    repeatingTimerDisplay.classList.remove('hidden');
    updateRepeatingDisplay();

    repeatingInterval = setInterval(() => {
        repeatingTimer--;
        if (repeatingTimer < 0) {
            playChime();
            ipcRenderer.send('show-popup', reminderMessageInput.value);
            recordFocusSession(intervalMins, 'Repeating Reminder');
            
            if (!isInfinite) currentRounds--;

            if (currentRounds <= 0) {
                stopRepeatingReminders();
                return;
            } else {
                repeatingTimer = intervalMins * 60;
            }
        }
        updateRepeatingDisplay();
    }, 1000);
}

function stopRepeatingReminders() {
    isRepeatingRunning = false;
    clearInterval(repeatingInterval);
    repeatingInterval = null;
    toggleStartStopButton(startRepeatingBtn);
    setInputsLocked('config-repeating-reminders', false);
    repeatingTimerDisplay.classList.add('hidden');
    ipcRenderer.send('close-popup');
}

startRepeatingBtn.addEventListener('click', () => {
    if (!isRepeatingRunning) startRepeatingReminders();
    else stopRepeatingReminders();
});


// --- Site Blocker ---
const saveBlockerBtn = document.getElementById('save-blocker-btn');
const siteBlockerMode = document.getElementById('site-blocker-mode');
const domainListInput = document.getElementById('domain-list');
const urlListInput = document.getElementById('url-list');
const siteBlockerEnabled = document.getElementById('site-blocker-enabled');
const siteBlockerAlwaysRun = document.getElementById('site-blocker-always-run');

function updateBlocker() {
    const mode = siteBlockerMode.value;
    const domains = domainListInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const urls = urlListInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const active = siteBlockerEnabled.checked;
    const alwaysRun = siteBlockerAlwaysRun.checked;
    
    ipcRenderer.send('update-blocker-rules', { mode, domains, urls, active, alwaysRun });
}

saveBlockerBtn.addEventListener('click', () => {
    updateBlocker();
    saveBlockerBtn.innerText = 'Saved!';
    saveBlockerBtn.style.background = '#2ecc71';
    setTimeout(() => {
        saveBlockerBtn.innerText = 'Save & Apply Blocker';
        saveBlockerBtn.style.background = '#3498db';
    }, 2000);
});

// Sync blocker state to main if it should always run
siteBlockerEnabled.addEventListener('change', updateBlocker);
siteBlockerAlwaysRun.addEventListener('change', updateBlocker);
