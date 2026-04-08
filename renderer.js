const { ipcRenderer } = require('electron');
const Chart = require('chart.js/auto');

// Listen for blocker errors (Site Blocker Phase)
ipcRenderer.on('blocker-error', (event, errorMsg) => {
    console.error('Site Blocker error:', errorMsg);
    customAlert(`Site Blocker Error: ${errorMsg}`);
});

// Listen for blocker status updates
ipcRenderer.on('blocker-status', (event, statusMsg) => {
    console.log('Site Blocker status:', statusMsg);
});

const store = {
    get: (key, defaultValue) => {
        const val = localStorage.getItem(key);
        return val !== null ? JSON.parse(val) : defaultValue;
    },
    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// --- Custom Modal Alert Replacement ---
function customAlert(message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert-modal');
        const msgEl = document.getElementById('custom-alert-message');
        const okBtn = document.getElementById('custom-alert-ok');
        let previousActive = document.activeElement;
        msgEl.textContent = message;
        modal.classList.add('active');
        modal.style.display = 'flex';
        okBtn.focus();
        function closeModal() {
            modal.classList.remove('active');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
            okBtn.removeEventListener('click', onOk);
            modal.removeEventListener('keydown', onKey);
            if (previousActive && typeof previousActive.focus === 'function') {
                previousActive.focus();
            }
            resolve();
        }
        function onOk() { closeModal(); }
        function onKey(e) { if (e.key === 'Enter' || e.key === 'Escape') closeModal(); }
        okBtn.addEventListener('click', onOk);
        modal.addEventListener('keydown', onKey);
    });
}

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
    ipcRenderer.send('theme-changed', isDarkMode);
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

  // Initialize button event listeners after DOM is fully loaded
  initializeButtonListeners();
});

function initializeButtonListeners() {
  // More robust pause button handling using event delegation for Repeating Reminders
  document.addEventListener('click', (e) => {
    if (e.target.id === 'pause-repeating-btn') {
      // Allow pause/resume if timer has been started, regardless of current state
      if (!isRepeatingPaused) {
        ipcRenderer.send('pause-timer', 'repeating');
        isRepeatingPaused = true;
        const repeatingDisplay = document.getElementById('repeating-timer-display');
        if (repeatingDisplay) repeatingDisplay.classList.add('paused');
        e.target.innerText = 'Resume ▶️';
      } else {
        ipcRenderer.send('resume-timer', 'repeating');
        isRepeatingPaused = false;
        const repeatingDisplay = document.getElementById('repeating-timer-display');
        if (repeatingDisplay) repeatingDisplay.classList.remove('paused');
        e.target.innerText = 'Pause ⏸';
      }
    }
  });

  // Stop button for Micro-Task Sprint Mode
  const stopSprintBtn = document.getElementById('stop-sprint-btn');
  if (stopSprintBtn) {
    stopSprintBtn.addEventListener('click', () => {
      stopSprintMode();
    });
  }
}

// --- Audio ---
const chimeAudio = document.getElementById('chime-audio');
let audioCtx = null;

function playFallbackBeep() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        
        const vol = chimeVolumeInput ? parseFloat(chimeVolumeInput.value) : 1;
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) { console.error('Beep failed:', e); }
}

function playChime() {
    if (chimeAudio && chimeAudio.src) {
        chimeAudio.currentTime = 0;
        chimeAudio.play().catch(e => {
            console.log('Audio play failed:', e);
            playFallbackBeep();
        });
    } else {
        playFallbackBeep();
    }
}

const testChimeBtn = document.getElementById('test-chime-btn');
if (testChimeBtn) {
    testChimeBtn.addEventListener('click', playChime);
}

const chimeVolumeInput = document.getElementById('chime-volume');
if (chimeVolumeInput) {
    chimeVolumeInput.addEventListener('input', (e) => {
        if (chimeAudio) {
            chimeAudio.volume = parseFloat(e.target.value);
        }
    });
}

const chimeSelector = document.getElementById('chime-selector');
const chimeFileInput = document.getElementById('chime-file-input');
const uploadChimeBtn = document.getElementById('upload-chime-btn');

// Load saved custom chime
const savedCustomChime = store.get('customChimeData', null);
if (savedCustomChime && chimeSelector) {
    chimeAudio.src = savedCustomChime;
    chimeSelector.value = 'custom';
}

if (uploadChimeBtn && chimeFileInput) {
    uploadChimeBtn.addEventListener('click', () => {
        chimeFileInput.click();
    });

    chimeFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                store.set('customChimeData', dataUrl);
                chimeAudio.src = dataUrl;
                if (chimeSelector) chimeSelector.value = 'custom';
            };
            reader.readAsDataURL(file);
        }
    });
}

if (chimeSelector) {
    chimeSelector.addEventListener('change', (e) => {
        if (e.target.value === 'custom' && store.get('customChimeData')) {
            chimeAudio.src = store.get('customChimeData');
        } else {
            chimeAudio.src = e.target.value;
        }
    });
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

// Sidebar click-outside-to-close logic
window.addEventListener('click', (e) => {
    const sidebarOpen = sideMenu.classList.contains('open');
    if (!sidebarOpen) return;
    const isSidebar = sideMenu.contains(e.target);
    const isToggle = menuToggleBtn.contains(e.target);
    if (!isSidebar && !isToggle) {
        closeSidebar();
    }
});

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
  'site-blocker': document.getElementById('config-site-blocker'),
  'micro-sprint': document.getElementById('config-micro-sprint')
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

const pomoPresetsSelect = document.getElementById('pomo-presets');
const savePomoPresetBtn = document.getElementById('save-pomo-preset-btn');
const deletePomoPresetBtn = document.getElementById('delete-pomo-preset-btn');
const savePresetContainer = document.getElementById('save-preset-container');
const presetNameInput = document.getElementById('preset-name-input');
const confirmSavePresetBtn = document.getElementById('confirm-save-preset-btn');
const cancelSavePresetBtn = document.getElementById('cancel-save-preset-btn');

let customPresets = store.get('customPomoPresets', {});

function updatePresetOptions() {
    if (!pomoPresetsSelect) return;
    // Clear existing custom presets
    Array.from(pomoPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            pomoPresetsSelect.removeChild(opt);
        }
    });
    
    Object.keys(customPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        pomoPresetsSelect.appendChild(option);
    });
}
updatePresetOptions();

if (pomoPresetsSelect) {
    pomoPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deletePomoPresetBtn) {
            deletePomoPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val === 'deep-work') {
            pomoSequence = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
        } else if (val === 'quick-study') {
            pomoSequence = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
        } else if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (customPresets[key]) {
                pomoSequence = JSON.parse(JSON.stringify(customPresets[key]));
            }
        }
        renderSequence();
    });
}

if (deletePomoPresetBtn) {
    deletePomoPresetBtn.addEventListener('click', () => {
        const val = pomoPresetsSelect.value;
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete customPresets[key];
                store.set('customPomoPresets', customPresets);
                updatePresetOptions();
                pomoPresetsSelect.value = 'custom';
                pomoPresetsSelect.dispatchEvent(new Event('change'));
            }
        }
    });
}

if (savePomoPresetBtn) {
    savePomoPresetBtn.addEventListener('click', () => {
        if (pomoSequence.length === 0) {
            customAlert('Add phases to sequence before saving as preset.');
            return;
        }
        savePresetContainer.style.display = 'flex';
        presetNameInput.focus();
    });
}

if (confirmSavePresetBtn) {
    confirmSavePresetBtn.addEventListener('click', () => {
        const name = presetNameInput.value;
        if (name && name.trim()) {
            customPresets[name.trim()] = JSON.parse(JSON.stringify(pomoSequence));
            store.set('customPomoPresets', customPresets);
            updatePresetOptions();
            pomoPresetsSelect.value = `custom-preset-${name.trim()}`;
            presetNameInput.value = '';
            savePresetContainer.style.display = 'none';
        }
    });
}

if (cancelSavePresetBtn) {
    cancelSavePresetBtn.addEventListener('click', () => {
        presetNameInput.value = '';
        savePresetContainer.style.display = 'none';
    });
}

ipcRenderer.on('pomo-popup-closed', () => {
    if (isPomoRunning) {
        stopPomoStyle();
    }
});

function renderSequence() {
    sequenceListEl.innerHTML = '';
    pomoSequence.forEach((item, index) => {
        const unit = item.unit || 'mins';
        const div = document.createElement('div');
        div.className = 'sequence-item';
        div.innerHTML = `
            <span>${item.type === 'work' ? 'Work' : 'Break'} Phase</span>
            <div style="display: flex; align-items: center;">
                <input type="number" min="1" value="${item.duration}" data-index="${index}" style="width: 90px;">
                <select data-index="${index}" style="margin-left: 5px; width: 70px; padding: 5px;">
                    <option value="mins" ${unit === 'mins' ? 'selected' : ''}>mins</option>
                    <option value="secs" ${unit === 'secs' ? 'selected' : ''}>secs</option>
                </select>
                <button class="remove-btn" data-index="${index}" style="margin-left: 10px;">X</button>
            </div>
        `;
        sequenceListEl.appendChild(div);
    });

    sequenceListEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            let val = parseInt(e.target.value, 10) || 1;
            const unitSelect = sequenceListEl.querySelector(`select[data-index="${idx}"]`);
            if (unitSelect && unitSelect.value === 'secs' && val >= 60) {
                val = 59;
                e.target.value = val;
            }
            pomoSequence[idx].duration = val;
        });
    });
    
    sequenceListEl.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            const newUnit = e.target.value;
            pomoSequence[idx].unit = newUnit;
            if (newUnit === 'secs') {
                const input = sequenceListEl.querySelector(`input[data-index="${idx}"]`);
                let val = parseInt(input.value, 10) || 1;
                if (val >= 60) {
                    val = 59;
                    input.value = val;
                    pomoSequence[idx].duration = val;
                }
            }
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
let isPomoPaused = false;
let pomoTimer = 0;
let currentPhaseIndex = 0;
let currentRepeatCount = 0;
let totalRepeatsPlanned = 1;

const startPomoBtn = document.getElementById('start-pomo-btn');
const pausePomoBtn = document.getElementById('pause-pomo-btn');
const continuePomoBtn = document.getElementById('continue-pomo-btn');
const pomoAutostartCheckbox = document.getElementById('pomo-autostart');
const pomoInfiniteCheckbox = document.getElementById('pomo-infinite');
const pomoRepeatsInput = document.getElementById('pomo-repeats');
const pomoCyclesContainer = document.getElementById('pomo-cycles-container');
const pomoInfiniteStatus = document.getElementById('pomo-infinite-status');

if (pomoInfiniteCheckbox) {
    pomoInfiniteCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (pomoCyclesContainer) pomoCyclesContainer.classList.add('hidden');
            if (pomoInfiniteStatus) pomoInfiniteStatus.style.display = 'block';
        } else {
            if (pomoCyclesContainer) pomoCyclesContainer.classList.remove('hidden');
            if (pomoInfiniteStatus) pomoInfiniteStatus.style.display = 'none';
        }
    });
}
const pomoTimerDisplay = document.getElementById('pomo-timer-display');
const pomoTimeLeft = document.getElementById('pomo-time-left');
const pomoStatusText = document.getElementById('pomo-status-text');
const pomoRoundsLeft = document.getElementById('pomo-rounds-left');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatPhaseDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0 && s > 0) return `${m}m ${s}s`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
}

let activePomoSequence = [];

function updatePomoDisplay() {
    pomoTimeLeft.innerText = formatTime(pomoTimer);
    const currentPhase = isPomoRunning ? activePomoSequence[currentPhaseIndex] : pomoSequence[0];
    pomoStatusText.innerText = currentPhase ? (currentPhase.type === 'work' ? 'Work Session' : 'Break Time') : 'Finished';
    
    const nextPhaseIdx = currentPhaseIndex + 1;
    let nextText = '--';
    const sourceSeq = isPomoRunning ? activePomoSequence : pomoSequence;
    
    function getPhaseSecs(phase) {
        if (phase.totalSeconds) return phase.totalSeconds;
        return phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
    }

    if (nextPhaseIdx < sourceSeq.length) {
        const nextPhase = sourceSeq[nextPhaseIdx];
        nextText = `${nextPhase.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(getPhaseSecs(nextPhase))})`;
    } else if (pomoInfiniteCheckbox.checked || currentRepeatCount + 1 < totalRepeatsPlanned) {
        const firstPhase = sourceSeq[0];
        if (firstPhase) {
            nextText = `Repeat: ${firstPhase.type === 'work' ? 'Work' : 'Break'} (${formatPhaseDuration(getPhaseSecs(firstPhase))})`;
        }
    } else {
        nextText = 'Finish';
    }
    pomoRoundsLeft.innerText = `Next: ${nextText}`;

    const totalSecs = currentPhase ? getPhaseSecs(currentPhase) : 1;
    ipcRenderer.send('update-pomo-timer', {
        phase: pomoStatusText.innerText,
        timeLeft: formatTime(pomoTimer),
        percent: currentPhase ? (pomoTimer / totalSecs) * 100 : 0
    });
}

ipcRenderer.on('timer-tick-pomo', (event, secondsLeft) => {
    pomoTimer = secondsLeft;
    updatePomoDisplay();
});

ipcRenderer.on('timer-complete-pomo', () => {
    handlePhaseEnd();
});

function startPomoPhase() {
    if (currentPhaseIndex >= activePomoSequence.length) {
        currentRepeatCount++;
        if (pomoInfiniteCheckbox.checked || currentRepeatCount < totalRepeatsPlanned) {
            currentPhaseIndex = 0;
        } else {
            stopPomoStyle();
            return;
        }
    }
    
    continuePomoBtn.style.display = 'none';
    const currentPhase = activePomoSequence[currentPhaseIndex];
    pomoTimer = currentPhase.totalSeconds;
    updatePomoDisplay();

    if (currentPhase.type === 'break') {
        const pomoAction = document.querySelector('input[name="pomo-action"]:checked').value;
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', 
            duration: currentPhase.totalSeconds, 
            fullScreen: (pomoAction === 'block'),
            autoStart: pomoAutostartCheckbox.checked
        });
    }

    ipcRenderer.send('start-timer', { id: 'pomo', seconds: pomoTimer });
}

function handlePhaseEnd() {
    playChime();
    const finishedPhase = activePomoSequence[currentPhaseIndex];
    if (finishedPhase.type === 'work') {
        recordFocusSession(Math.round(finishedPhase.totalSeconds / 60), 'Pomo Work');
    }
    
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
    
    currentPhaseIndex++;
    
    if (currentPhaseIndex >= activePomoSequence.length && !pomoInfiniteCheckbox.checked && currentRepeatCount + 1 >= totalRepeatsPlanned) {
        stopPomoStyle();
        return;
    }

    if (pomoAutostartCheckbox.checked) {
        startPomoPhase();
    } else {
        pomoTimer = 0; // Ensure display reads 0
        updatePomoDisplay();
        continuePomoBtn.style.display = 'block';
    }
}

function stopPomoStyle() {
    isPomoRunning = false;
    isPomoPaused = false;
    ipcRenderer.send('stop-timer', 'pomo');
    toggleStartStopButton(startPomoBtn);
    setInputsLocked('config-pomo-style', false);
    pomoTimerDisplay.classList.add('hidden');
    continuePomoBtn.style.display = 'none';
    if(pausePomoBtn) {
        pausePomoBtn.style.display = 'none';
        pausePomoBtn.innerText = 'Pause ⏸';
    }
    ipcRenderer.send('close-pomo-timer');
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
}

startPomoBtn.addEventListener('click', () => {
    if (!isPomoRunning) {
        if (pomoSequence.length === 0) {
            customAlert('Please add at least one phase to the sequence.');
            return;
        }
        
        activePomoSequence = [];
        pomoSequence.forEach(phase => {
            const phaseSecs = phase.duration * ((phase.unit || 'mins') === 'mins' ? 60 : 1);
            if (activePomoSequence.length > 0 && activePomoSequence[activePomoSequence.length - 1].type === phase.type) {
                activePomoSequence[activePomoSequence.length - 1].totalSeconds += phaseSecs;
            } else {
                activePomoSequence.push({ type: phase.type, totalSeconds: phaseSecs });
            }
        });

        totalRepeatsPlanned = parseInt(pomoRepeatsInput.value, 10) || 1;
        isPomoRunning = true;
        isPomoPaused = false;
        currentPhaseIndex = 0;
        currentRepeatCount = 0;
        toggleStartStopButton(startPomoBtn);
        setInputsLocked('config-pomo-style', true);
        pomoTimerDisplay.classList.remove('hidden');
        if(pausePomoBtn) {
            pausePomoBtn.style.display = 'block';
            pausePomoBtn.innerText = 'Pause ⏸';
        }
        ipcRenderer.send('open-pomo-timer');
        startPomoPhase();
    } else {
        stopPomoStyle();
    }
});

// More robust pause button handling for Pomo Style using event delegation
document.addEventListener('click', (e) => {
    if (e.target.id === 'pause-pomo-btn') {
        // Allow pause/resume if timer has been started, regardless of current state
        if (!isPomoPaused) {
            ipcRenderer.send('pause-timer', 'pomo');
            isPomoPaused = true;
            const timerDisplay = document.getElementById('pomo-timer-display');
            if (timerDisplay) timerDisplay.classList.add('paused');
            e.target.innerText = 'Resume ▶️';
        } else {
            ipcRenderer.send('resume-timer', 'pomo');
            isPomoPaused = false;
            const timerDisplay = document.getElementById('pomo-timer-display');
            if (timerDisplay) timerDisplay.classList.remove('paused');
            e.target.innerText = 'Pause ⏸';
        }
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
const pauseRepeatingBtn = document.getElementById('pause-repeating-btn');
const reminderIntervalInput = document.getElementById('reminder-interval');
const reminderIntervalSecondsInput = document.getElementById('reminder-interval-seconds');
const reminderRoundsInput = document.getElementById('reminder-rounds');
const reminderMessageInput = document.getElementById('reminder-message');
const repeatingTimerDisplay = document.getElementById('repeating-timer-display');
const repeatingTimeLeft = document.getElementById('repeating-time-left');
const repeatingRoundsLeft = document.getElementById('repeating-rounds-left');

let repeatingTimer = 0;
let currentRounds = 0;
let isRepeatingRunning = false;
let isRepeatingPaused = false;
let currentRepeatingTotalSeconds = 0;

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

ipcRenderer.on('timer-tick-repeating', (event, secondsLeft) => {
    repeatingTimer = secondsLeft;
    updateRepeatingDisplay();
});

ipcRenderer.on('timer-complete-repeating', () => {
    playChime();
    ipcRenderer.send('show-popup', reminderMessageInput.value);
    recordFocusSession(Math.round(currentRepeatingTotalSeconds / 60), 'Repeating Reminder');
    
    if (!infiniteRoundsCheckbox.checked) {
        currentRounds--;
    }

    if (currentRounds <= 0 && !infiniteRoundsCheckbox.checked) {
        stopRepeatingReminders();
    } else {
        repeatingTimer = currentRepeatingTotalSeconds;
        updateRepeatingDisplay();
        ipcRenderer.send('start-timer', { id: 'repeating', seconds: repeatingTimer });
    }
});

function startRepeatingReminders() {
    const intervalMins = parseInt(reminderIntervalInput.value, 10) || 0;
    const intervalSecs = parseInt(reminderIntervalSecondsInput.value, 10) || 0;
    const totalSeconds = (intervalMins * 60) + intervalSecs;
    const rounds = parseInt(reminderRoundsInput.value, 10);
    const isInfinite = infiniteRoundsCheckbox.checked;

    if (totalSeconds <= 0) {
        customAlert('Please enter a valid interval.');
        return;
    }
    if (!isInfinite && (isNaN(rounds) || rounds <= 0)) {
        customAlert('Please enter a valid number of rounds.');
        return;
    }

    currentRepeatingTotalSeconds = totalSeconds;
    isRepeatingRunning = true;
    isRepeatingPaused = false;
    currentRounds = isInfinite ? Infinity : rounds;
    repeatingTimer = totalSeconds;
    
    toggleStartStopButton(startRepeatingBtn);
    setInputsLocked('config-repeating-reminders', true);
    repeatingTimerDisplay.classList.remove('hidden');
    if (pauseRepeatingBtn) {
        pauseRepeatingBtn.style.display = 'block';
        pauseRepeatingBtn.innerText = 'Pause ⏸';
    }
    updateRepeatingDisplay();

    ipcRenderer.send('start-timer', { id: 'repeating', seconds: repeatingTimer });
}

function stopRepeatingReminders() {
    isRepeatingRunning = false;
    isRepeatingPaused = false;
    ipcRenderer.send('stop-timer', 'repeating');
    toggleStartStopButton(startRepeatingBtn);
    setInputsLocked('config-repeating-reminders', false);
    repeatingTimerDisplay.classList.add('hidden');
    if (pauseRepeatingBtn) {
        pauseRepeatingBtn.style.display = 'none';
        pauseRepeatingBtn.innerText = 'Pause ⏸';
    }
    ipcRenderer.send('close-popup');
}

startRepeatingBtn.addEventListener('click', () => {
    if (!isRepeatingRunning) startRepeatingReminders();
    else stopRepeatingReminders();
});

// --- Site Blocker ---
const saveBlockerBtn = document.getElementById('save-blocker-btn');
const clearBlockerBtn = document.getElementById('clear-blocker-btn');
const clearBlockerModalBtn = document.getElementById('clear-blocker-modal-btn');
const siteBlockerMode = document.getElementById('site-blocker-mode');
const domainListInput = document.getElementById('domain-list');
const urlListInput = document.getElementById('url-list');
const siteBlockerEnabled = document.getElementById('site-blocker-enabled');
const siteBlockerAlwaysRun = document.getElementById('site-blocker-always-run');

function normalizeHost(value) {
    const input = value.trim();
    if (!input) return null;

    let host = null;
    try {
        let url = input;
        if (!/^https?:\/\//i.test(url)) {
            url = `http://${url}`;
        }
        host = new URL(url).hostname.toLowerCase();
    } catch (err) {
        // fallback: remove protocol, path, query and fragment
        host = input.replace(/^https?:\/\//i, '')
            .split(/[\/?#]/)[0]
            .toLowerCase();
    }

    // Strip any port numbers
    host = host.split(':')[0];

    // Reject localhost as a blocker target
    if (host === 'localhost') return null;
    if (!host) return null;

    return host;
}

function updateBlocker() {
    const mode = siteBlockerMode.value;
    const rawDomains = domainListInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const rawUrls = urlListInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const active = siteBlockerEnabled.checked;
    const alwaysRun = siteBlockerAlwaysRun.checked;

    const domainSet = new Set();

    function addBlockingHost(host) {
        if (!host) return;
        host = host.toLowerCase();
        domainSet.add(host);
        if (!host.startsWith('www.')) {
            domainSet.add(`www.${host}`);
        } else {
            // also add root domain if user typed www
            const root = host.replace(/^www\./, '');
            if (root) domainSet.add(root);
        }
    }

    rawDomains.forEach(d => {
        const host = normalizeHost(d);
        if (host) addBlockingHost(host);
    });

    rawUrls.forEach(u => {
        const host = normalizeHost(u);
        if (host) addBlockingHost(host);
    });

    const domains = Array.from(domainSet).sort();

    ipcRenderer.send('update-blocker-rules', { mode, domains, urls: rawUrls, active, alwaysRun });
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

function handleClearBlocks(btn) {
    if (confirm('Are you sure you want to clear all SuperFokus block entries from your system hosts file?')) {
        ipcRenderer.send('clear-all-blocks');
        const oldText = btn.innerText;
        const oldBg = btn.style.background;
        btn.innerText = 'Cleared!';
        btn.style.background = '#2ecc71';
        setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = oldBg;
        }, 2000);
    }
}

if (clearBlockerBtn) {
    clearBlockerBtn.addEventListener('click', () => handleClearBlocks(clearBlockerBtn));
}

if (clearBlockerModalBtn) {
    clearBlockerModalBtn.addEventListener('click', () => handleClearBlocks(clearBlockerModalBtn));
}

// Sync blocker state to main if it should always run
siteBlockerEnabled.addEventListener('change', updateBlocker);
siteBlockerAlwaysRun.addEventListener('change', updateBlocker);

// --- Health & Posture Mode ---
const startHealthBtn = document.getElementById('start-health-btn');
const stopHealthBtn = document.getElementById('stop-health-btn');
const healthEyeSaver = document.getElementById('health-eye-saver');
const healthPostureCheck = document.getElementById('health-posture-check');
const healthStatus = document.getElementById('health-status');

let isHealthRunning = false;

startHealthBtn.addEventListener('click', () => {
    isHealthRunning = true;
    startHealthBtn.style.display = 'none';
    stopHealthBtn.style.display = 'block';
    healthStatus.style.display = 'block';
    setInputsLocked('modal-health', true);

    ipcRenderer.send('start-health-mode', {
        eyeSaver: healthEyeSaver.checked,
        postureCheck: healthPostureCheck.checked
    });
});

stopHealthBtn.addEventListener('click', () => {
    isHealthRunning = false;
    startHealthBtn.style.display = 'block';
    stopHealthBtn.style.display = 'none';
    healthStatus.style.display = 'none';
    setInputsLocked('modal-health', false);

    ipcRenderer.send('stop-health-mode');
});
// --- Micro-Task Sprint Mode ---
const sprintDurationSelect = document.getElementById('sprint-duration');
const sprintTasksInput = document.getElementById('sprint-tasks');
const startSprintBtn = document.getElementById('start-sprint-btn');
const stopSprintBtn = document.getElementById('stop-sprint-btn');
const sprintTimerDisplay = document.getElementById('sprint-timer-display');
const sprintCurrentTask = document.getElementById('sprint-current-task');
const sprintTimeLeft = document.getElementById('sprint-time-left');
const sprintTasksLeft = document.getElementById('sprint-tasks-left');
const nextSprintBtn = document.getElementById('next-sprint-btn');

let isSprintRunning = false;
let sprintTasks = [];
let currentSprintTaskIndex = 0;
let sprintTimerSeconds = 0;
let sprintDurationSeconds = 0;

function updateSprintDisplay() {
    sprintTimeLeft.innerText = formatTime(sprintTimerSeconds);
    const taskName = sprintTasks[currentSprintTaskIndex] || `Sprint ${currentSprintTaskIndex + 1}`;
    sprintCurrentTask.innerText = taskName;
    sprintTasksLeft.innerText = `Remaining Tasks: ${Math.max(0, sprintTasks.length - currentSprintTaskIndex - 1)}`;
}

ipcRenderer.on('timer-tick-sprint', (event, secondsLeft) => {
    sprintTimerSeconds = secondsLeft;
    updateSprintDisplay();
});

ipcRenderer.on('timer-complete-sprint', () => {
    playChime();
    recordFocusSession(Math.round(sprintDurationSeconds / 60), 'Micro-Task Sprint');
    nextSprintBtn.style.display = 'block';
});

function startNextSprintTask() {
    if (currentSprintTaskIndex >= sprintTasks.length && sprintTasks.length > 0) {
        stopSprintMode();
        return;
    }
    nextSprintBtn.style.display = 'none';
    sprintTimerSeconds = sprintDurationSeconds;
    updateSprintDisplay();
    ipcRenderer.send('start-timer', { id: 'sprint', seconds: sprintTimerSeconds });
}

function stopSprintMode() {
    isSprintRunning = false;
    ipcRenderer.send('stop-timer', 'sprint');
    startSprintBtn.style.display = 'block';
    stopSprintBtn.style.display = 'none';
    setInputsLocked('config-micro-sprint', false);
    sprintTimerDisplay.classList.add('hidden');
    nextSprintBtn.style.display = 'none';
}

startSprintBtn.addEventListener('click', () => {
    const rawTasks = sprintTasksInput.value.split('\n').map(t => t.trim()).filter(Boolean);
    sprintTasks = rawTasks.length > 0 ? rawTasks : ['Unnamed Sprint'];
    currentSprintTaskIndex = 0;
    
    sprintDurationSeconds = parseInt(sprintDurationSelect.value, 10) * 60;
    
    isSprintRunning = true;
    startSprintBtn.style.display = 'none';
    stopSprintBtn.style.display = 'block';
    setInputsLocked('config-micro-sprint', true);
    sprintTimerDisplay.classList.remove('hidden');
    
    startNextSprintTask();
});

nextSprintBtn.addEventListener('click', () => {
    currentSprintTaskIndex++;
    if (currentSprintTaskIndex >= sprintTasks.length) {
        stopSprintMode();
    } else {
        startNextSprintTask();
    }
});
