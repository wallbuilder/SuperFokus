const ipcRenderer = window.electronAPI;
// Chart loaded from window

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
const customAlertModal = document.getElementById('custom-alert-modal');
const customAlertMsgEl = document.getElementById('custom-alert-message');
const customAlertOkBtn = document.getElementById('custom-alert-ok');

function customAlert(message, options = {}) {
    return new Promise((resolve) => {
        const modal = customAlertModal || document.getElementById('custom-alert-modal');
        const msgEl = customAlertMsgEl || document.getElementById('custom-alert-message');
        const okBtn = customAlertOkBtn || document.getElementById('custom-alert-ok');
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
  try {
    const startupScreen = document.getElementById('startup-screen');
    if (!startupScreen) {
      console.error('Startup screen element not found!');
      return;
    }
    
    // Wait 1.5 seconds, then fade out
    setTimeout(() => {
      startupScreen.style.opacity = '0';
      // Remove from DOM flow after fade transition completes
      setTimeout(() => {
        startupScreen.style.display = 'none';
      }, 1000); // matches the 1s CSS transition
    }, 1500);
    
    // Initialize DOM elements after DOM is loaded
    initializeDomElements();
    
    // Initialize button event listeners after DOM is fully loaded
    initializeButtonListeners();
  } catch (error) {
    console.error('[Startup] Error during initialization:', error);
  }
});

function initializeDomElements() {
  try {
    // Workflow elements
    window.workflowStack = document.getElementById('workflow-stack');
    window.workflowStackPlaceholder = document.getElementById('workflow-stack-placeholder');
    window.workflowTotalDurationEl = document.getElementById('workflow-total-duration');
    
    // Other elements that might be accessed early
    window.workflowPaletteItems = document.querySelectorAll('.workflow-palette-item');
    
    // Set up workflow event listeners
    setupWorkflowEventListeners();
    
    // Set up workflow presets event listeners
    setupWorkflowPresetsEventListeners();
  } catch (error) {
    console.error('[Startup] Error initializing DOM elements:', error);
  }
}

function setupWorkflowEventListeners() {
    try {
        if (window.workflowPaletteItems) {
            window.workflowPaletteItems.forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', e.target.getAttribute('data-type'));
                    e.target.style.opacity = '0.5';
                });
                item.addEventListener('dragend', (e) => {
                    e.target.style.opacity = '1';
                });
            });
        }

        if (window.workflowStack) {
            window.workflowStack.addEventListener('dragover', (e) => {
                e.preventDefault();
                window.workflowStack.style.background = 'var(--timer-bg)';
            });

            window.workflowStack.addEventListener('dragleave', (e) => {
                e.preventDefault();
                window.workflowStack.style.background = 'var(--input-bg)';
            });

            window.workflowStack.addEventListener('drop', (e) => {
                e.preventDefault();
                window.workflowStack.style.background = 'var(--input-bg)';
                const type = e.dataTransfer.getData('text/plain');
                if (type === 'pomo' || type === 'sprint' || type === 'repeating') {
                    addWorkflowBlock(type);
                }
            });

            // Event delegation for block interactions
            window.workflowStack.addEventListener('change', (e) => {
                if (e.target.classList.contains('block-preset-input')) {
                    const idx = parseInt(e.target.getAttribute('data-index'), 10);
                    if (!isNaN(idx) && workflowBlocks[idx]) {
                        workflowBlocks[idx].presetKey = e.target.value;
                        renderWorkflowStack();
                    }
                } else if (e.target.classList.contains('block-cycles-input')) {
                    const idx = parseInt(e.target.getAttribute('data-index'), 10);
                    if (!isNaN(idx) && workflowBlocks[idx]) {
                        workflowBlocks[idx].cycles = parseInt(e.target.value, 10) || 1;
                        renderWorkflowStack();
                    }
                }
            });

            window.workflowStack.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-block-btn')) {
                    const idx = parseInt(e.target.getAttribute('data-index'), 10);
                    if (!isNaN(idx) && workflowBlocks[idx]) {
                        workflowBlocks.splice(idx, 1);
                        renderWorkflowStack();
                    }
                }
            });
        }
    } catch (error) {
        console.error('[Startup] Error setting up workflow event listeners:', error);
    }
}

function setupWorkflowPresetsEventListeners() {
    try {
        const workflowPresetsSelect = document.getElementById('workflow-presets');
        const deleteWorkflowPresetBtn = document.getElementById('delete-workflow-preset-btn');
        const saveWorkflowPresetBtn = document.getElementById('save-workflow-preset-btn');
        const confirmSaveWorkflowPresetBtn = document.getElementById('confirm-save-workflow-preset-btn');
        const cancelSaveWorkflowPresetBtn = document.getElementById('cancel-save-workflow-preset-btn');
        const saveWorkflowPresetContainer = document.getElementById('save-workflow-preset-container');
        const workflowPresetNameInput = document.getElementById('workflow-preset-name-input');
        
        if (workflowPresetsSelect) {
            workflowPresetsSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (deleteWorkflowPresetBtn) {
                    deleteWorkflowPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
                }
                if (val.startsWith('custom-preset-')) {
                    const key = val.replace('custom-preset-', '');
                    if (workflowPresets[key]) {
                        workflowBlocks = JSON.parse(JSON.stringify(workflowPresets[key]));
                        renderWorkflowStack();
                    }
                }
                updateWorkflowCurrentPresetDisplay();
            });
        }

        if (deleteWorkflowPresetBtn) {
            deleteWorkflowPresetBtn.addEventListener('click', () => {
                const val = workflowPresetsSelect.value;
                if (val.startsWith('custom-preset-')) {
                    const key = val.replace('custom-preset-', '');
                    if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                        delete workflowPresets[key];
                        store.set('workflowPresets', workflowPresets);
                        updateWorkflowPresetOptions();
                        workflowPresetsSelect.value = 'custom';
                        workflowPresetsSelect.dispatchEvent(new Event('change'));
                    }
                }
            });
        }

        if (saveWorkflowPresetBtn) {
            saveWorkflowPresetBtn.addEventListener('click', () => {
                if (workflowBlocks.length === 0) {
                    customAlert('Add blocks to the stack before saving as preset.');
                    return;
                }
                if (saveWorkflowPresetContainer) saveWorkflowPresetContainer.style.display = 'flex';
                if (workflowPresetNameInput) workflowPresetNameInput.focus();
            });
        }

        if (confirmSaveWorkflowPresetBtn) {
            confirmSaveWorkflowPresetBtn.addEventListener('click', () => {
                const name = workflowPresetNameInput.value;
                if (name && name.trim()) {
                    workflowPresets[name.trim()] = JSON.parse(JSON.stringify(workflowBlocks));
                    store.set('workflowPresets', workflowPresets);
                    updateWorkflowPresetOptions();
                    workflowPresetsSelect.value = `custom-preset-${name.trim()}`;
                    workflowPresetNameInput.value = '';
                    if (saveWorkflowPresetContainer) saveWorkflowPresetContainer.style.display = 'none';
                    updateWorkflowCurrentPresetDisplay();
                }
            });
        }

        if (cancelSaveWorkflowPresetBtn) {
            cancelSaveWorkflowPresetBtn.addEventListener('click', () => {
                if (workflowPresetNameInput) workflowPresetNameInput.value = '';
                if (saveWorkflowPresetContainer) saveWorkflowPresetContainer.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('[Startup] Error setting up workflow presets event listeners:', error);
    }
}

function initializeButtonListeners() {
  try {
    // More robust pause button handling using event delegation for Repeating Reminders
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#pause-repeating-btn');
      if (btn) {
        // Allow pause/resume if timer has been started, regardless of current state
        if (!isRepeatingPaused) {
          ipcRenderer.send('pause-timer', 'repeating');
          isRepeatingPaused = true;
          const repeatingDisplay = document.getElementById('repeating-timer-display');
          if (repeatingDisplay) repeatingDisplay.classList.add('paused');
          btn.innerText = 'Resume ▶️';
        } else {
          ipcRenderer.send('resume-timer', 'repeating');
          isRepeatingPaused = false;
          const repeatingDisplay = document.getElementById('repeating-timer-display');
          if (repeatingDisplay) repeatingDisplay.classList.remove('paused');
          btn.innerText = 'Pause ⏸';
        }
      }
    });
  } catch (error) {
    console.error('[Startup] Error initializing button listeners:', error);
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
    const extraModeModal = document.getElementById('choose-extra-mode');
    if (extraModeModal && extraModeModal.classList.contains('active')) {
        return; // Sidebar lockout
    }
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
    
    const today = now.toISOString().split('T')[0];
    dailyStats[today] = (dailyStats[today] || 0) + minutes;
    
    setTimeout(() => {
        store.set('totalFocusTime', totalFocusTime);
        store.set('completedRounds', completedRounds);
        store.set('sessionHistory', sessionHistory);
        store.set('dailyStats', dailyStats);
    }, 0);
    
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
        statsChartInstance.data.labels = labels;
        statsChartInstance.data.datasets[0].data = data;
        statsChartInstance.update();
        return;
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
const homeMenu = document.getElementById('home-menu');
const dashboardTitle = document.getElementById('dashboard-title');
const headerTitle = document.getElementById('header-title');

const configSections = {
  'repeating-reminders': document.getElementById('config-repeating-reminders'),
  'pomo-style': document.getElementById('config-pomo-style'),
  'site-blocker': document.getElementById('config-site-blocker'),
  'micro-sprint': document.getElementById('config-micro-sprint'),
  'flow-state': document.getElementById('config-flow-state'),
  'workflows': document.getElementById('config-workflows')
};

document.querySelectorAll('.home-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-mode');
    
    homeMenu.style.display = 'none';
    Object.values(configSections).forEach(section => {
      if (section) section.classList.remove('active');
    });
    if (configSections[mode]) {
      configSections[mode].classList.add('active');
      const titleText = btn.innerText.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
      // Remove any leading icon characters like ⟳ ✓ ☑ ⏱ ⚙
      dashboardTitle.innerText = titleText.replace(/^[⟳✓☑⏱⚙]\s*/, '');
    }

    const dashboardSubtitle = document.getElementById('dashboard-subtitle');
    if (dashboardSubtitle) {
        dashboardSubtitle.innerHTML = '<span id="select-another-mode-btn" style="text-decoration: underline; cursor: pointer; color: var(--header-grad-1);">Select another Fokus Mode</span>';
        const selectAnotherBtn = document.getElementById('select-another-mode-btn');
        if (selectAnotherBtn) {
            selectAnotherBtn.addEventListener('click', () => {
                const modal = document.getElementById('choose-extra-mode');
                if (modal) {
                    if (typeof closeSidebar === 'function') closeSidebar();
                    document.querySelectorAll('.extra-mode-btn').forEach(mBtn => {
                        if (mBtn.getAttribute('data-switch-mode') === mode) {
                            mBtn.style.display = 'none';
                        } else {
                            mBtn.style.display = 'block';
                        }
                    });
                    modal.classList.add('active');
                }
            });
        }
    }
  });
});

document.querySelectorAll('.extra-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-switch-mode');
        const modal = document.getElementById('choose-extra-mode');
        if (modal) modal.classList.remove('active');
        
        if (mode === 'site-blocker') {
            const siteBlockerModal = document.getElementById('modal-site-blocker');
            if (siteBlockerModal) {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
                siteBlockerModal.classList.add('active');
            }
            return;
        }

        const targetHomeBtn = document.querySelector(`.home-btn[data-mode="${mode}"]`);
        if (targetHomeBtn) {
            targetHomeBtn.click();
        }
    });
});

headerTitle.addEventListener('click', () => {
    returnToHome();
});

function returnToHome() {
    if (typeof isPomoRunning !== 'undefined' && isPomoRunning) stopPomoStyle();
    if (typeof isRepeatingRunning !== 'undefined' && isRepeatingRunning) stopRepeatingReminders();
    if (typeof isSprintRunning !== 'undefined' && isSprintRunning) stopSprintMode();
    if (typeof isFlowRunning !== 'undefined' && isFlowRunning) stopFlowState();
    
    Object.values(configSections).forEach(section => {
      if (section) section.classList.remove('active');
    });
    homeMenu.style.display = 'grid';
    dashboardTitle.innerText = 'Dashboard';
    const dashboardSubtitle = document.getElementById('dashboard-subtitle');
    if (dashboardSubtitle) {
        dashboardSubtitle.innerHTML = '<span style="color: var(--timer-subtext);">Select a Fokus Mode to get started</span>';
    }
}

function setInputsLocked(sectionId, locked) {
    const section = document.getElementById(sectionId);
    const inputs = section.querySelectorAll('input, select, textarea, button:not(.start-btn):not(.stop-btn):not(.continue-btn)');
    inputs.forEach(input => {
        input.disabled = locked;
    });
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
}

sequenceListEl.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        const idx = e.target.getAttribute('data-index');
        if (idx !== null) {
            let val = parseInt(e.target.value, 10) || 1;
            const unitSelect = sequenceListEl.querySelector(`select[data-index="${idx}"]`);
            if (unitSelect && unitSelect.value === 'secs' && val >= 60) {
                val = 59;
                e.target.value = val;
            }
            pomoSequence[idx].duration = val;
        }
    } else if (e.target.tagName === 'SELECT') {
        const idx = e.target.getAttribute('data-index');
        if (idx !== null) {
            const newUnit = e.target.value;
            pomoSequence[idx].unit = newUnit;
            if (newUnit === 'secs') {
                const input = sequenceListEl.querySelector(`input[data-index="${idx}"]`);
                if (input) {
                    let val = parseInt(input.value, 10) || 1;
                    if (val >= 60) {
                        val = 59;
                        input.value = val;
                        pomoSequence[idx].duration = val;
                    }
                }
            }
        }
    }
});

sequenceListEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
        const idx = e.target.getAttribute('data-index');
        if (idx !== null) {
            pomoSequence.splice(idx, 1);
            renderSequence();
        }
    }
});
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

ipcRenderer.on('timer-tick', (event, data) => {
    if (data.id === 'pomo') {
        pomoTimer = data.seconds;
        updatePomoDisplay();
    } else if (data.id === 'repeating') {
        repeatingTimer = data.seconds;
        updateRepeatingDisplay();
    } else if (data.id === 'sprint') {
        sprintTimerSeconds = data.seconds;
        updateSprintDisplay();
    }
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

let repeatingLocalInterval = null;
function updateLocalRepeatingTimer(endTime) {
    // Local timer removed in v0.9.2 - now synced via timer-tick IPC from main.js
}

ipcRenderer.on('timer-started-repeating', (event, endTime) => updateLocalRepeatingTimer(endTime));
ipcRenderer.on('timer-resumed-repeating', (event, endTime) => updateLocalRepeatingTimer(endTime));
ipcRenderer.on('timer-paused-repeating', () => {
    if (repeatingLocalInterval) clearInterval(repeatingLocalInterval);
});
ipcRenderer.on('timer-stopped-repeating', () => {
    if (repeatingLocalInterval) clearInterval(repeatingLocalInterval);
    repeatingTimer = 0;
    updateRepeatingDisplay();
});

ipcRenderer.on('timer-complete-repeating', () => {
    playChime();
    const autocloseSecs = reminderAutocloseInput ? (parseInt(reminderAutocloseInput.value, 10) || 10) : 10;
    ipcRenderer.send('show-popup', {
        message: reminderMessageInput.value,
        closeDelay: autocloseSecs * 1000,
        type: 'Repeating Reminder',
        isAutoclose: true
    });
    recordFocusSession(Math.round(currentRepeatingTotalSeconds / 60), 'Repeating Reminder');
    
    if (!infiniteRoundsCheckbox.checked) {
        currentRounds--;
    }

    if (currentRounds <= 0 && !infiniteRoundsCheckbox.checked) {
        stopRepeatingReminders(false);
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

// Repeating Reminders Presets
const repeatingPresetsSelect = document.getElementById('repeating-presets');
const deleteRepeatingPresetBtn = document.getElementById('delete-repeating-preset-btn');
const saveRepeatingPresetBtn = document.getElementById('save-repeating-preset-btn');
const saveRepeatingPresetContainer = document.getElementById('save-repeating-preset-container');
const repeatingPresetNameInput = document.getElementById('repeating-preset-name-input');
const confirmSaveRepeatingPresetBtn = document.getElementById('confirm-save-repeating-preset-btn');
const cancelSaveRepeatingPresetBtn = document.getElementById('cancel-save-repeating-preset-btn');

let repeatingPresets = store.get('repeatingPresets', {});

function updateRepeatingPresetOptions() {
    if (!repeatingPresetsSelect) return;
    Array.from(repeatingPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            repeatingPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(repeatingPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        repeatingPresetsSelect.appendChild(option);
    });
}
updateRepeatingPresetOptions();

if (repeatingPresetsSelect) {
    repeatingPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deleteRepeatingPresetBtn) {
            deleteRepeatingPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (repeatingPresets[key]) {
                const data = repeatingPresets[key];
                reminderIntervalInput.value = data.intervalMins || 0;
                reminderIntervalSecondsInput.value = data.intervalSecs || 0;
                reminderRoundsInput.value = data.rounds || 5;
                reminderMessageInput.value = data.message || '';
            }
        }
    });
}

if (deleteRepeatingPresetBtn) {
    deleteRepeatingPresetBtn.addEventListener('click', () => {
        const val = repeatingPresetsSelect.value;
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete repeatingPresets[key];
                store.set('repeatingPresets', repeatingPresets);
                updateRepeatingPresetOptions();
                repeatingPresetsSelect.value = 'custom';
                repeatingPresetsSelect.dispatchEvent(new Event('change'));
            }
        }
    });
}

if (saveRepeatingPresetBtn) {
    saveRepeatingPresetBtn.addEventListener('click', () => {
        if (infiniteRoundsCheckbox.checked) {
            customAlert("Cannot save preset with 'Infinite Rounds' enabled.");
            return;
        }
        saveRepeatingPresetContainer.style.display = 'flex';
        repeatingPresetNameInput.focus();
    });
}

if (confirmSaveRepeatingPresetBtn) {
    confirmSaveRepeatingPresetBtn.addEventListener('click', () => {
        const name = repeatingPresetNameInput.value;
        if (name && name.trim()) {
            repeatingPresets[name.trim()] = {
                intervalMins: parseInt(reminderIntervalInput.value, 10) || 0,
                intervalSecs: parseInt(reminderIntervalSecondsInput.value, 10) || 0,
                rounds: parseInt(reminderRoundsInput.value, 10) || 5,
                message: reminderMessageInput.value
            };
            store.set('repeatingPresets', repeatingPresets);
            updateRepeatingPresetOptions();
            repeatingPresetsSelect.value = `custom-preset-${name.trim()}`;
            repeatingPresetNameInput.value = '';
            saveRepeatingPresetContainer.style.display = 'none';
        }
    });
}

if (cancelSaveRepeatingPresetBtn) {
    cancelSaveRepeatingPresetBtn.addEventListener('click', () => {
        repeatingPresetNameInput.value = '';
        saveRepeatingPresetContainer.style.display = 'none';
    });
}

// --- Site Blocker ---
const saveBlockerBtn = document.getElementById('save-blocker-btn');
const clearBlockerBtn = document.getElementById('clear-blocker-btn');
const clearBlockerModalBtn = document.getElementById('clear-blocker-modal-btn');
const siteBlockerMode = document.getElementById('site-blocker-mode');
const domainListInput = document.getElementById('domain-list');
const urlListInput = document.getElementById('url-list');
const siteBlockerEnabled = document.getElementById('site-blocker-enabled');
const siteBlockerAlwaysRun = document.getElementById('site-blocker-always-run');

// Show/hide mode messages based on selection
siteBlockerMode.addEventListener('change', () => {
    const proxyMsg = document.getElementById('proxy-message');
    const blockMsg = document.getElementById('block-message');
    if (siteBlockerMode.value === 'allow') {
        proxyMsg.style.display = 'block';
        blockMsg.style.display = 'none';
    } else {
        proxyMsg.style.display = 'none';
        blockMsg.style.display = 'block';
    }
    // Trigger change on load too
    window.addEventListener('load', () => {
        const currentMode = siteBlockerMode.value;
        if (currentMode === 'allow') {
            proxyMsg.style.display = 'block';
            blockMsg.style.display = 'none';
        } else {
            proxyMsg.style.display = 'none';
            blockMsg.style.display = 'block';
        }
    });
});

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
    
    // Validation
    if (active && domains.length === 0) {
        alert('⚠️ No domains entered! Please add domains/URLs to block before enabling.');
        siteBlockerEnabled.checked = false;
        return;
    }

    console.log('[Blocker]', {mode, active, domainCount: domains.length, domains});
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
const skipSprintBtn = document.getElementById('skip-sprint-btn');

let isSprintRunning = false;
let sprintTasks = [];
let currentSprintTaskIndex = 0;
let sprintTimerSeconds = 0;
let sprintDurationSeconds = 0;

// Presets and Custom Duration Logic
const sprintPresetsSelect = document.getElementById('sprint-presets');
const deleteSprintPresetBtn = document.getElementById('delete-sprint-preset-btn');
const saveSprintPresetBtn = document.getElementById('save-sprint-preset-btn');
const saveSprintPresetContainer = document.getElementById('save-sprint-preset-container');
const sprintPresetNameInput = document.getElementById('sprint-preset-name-input');
const confirmSaveSprintPresetBtn = document.getElementById('confirm-save-sprint-preset-btn');
const cancelSaveSprintPresetBtn = document.getElementById('cancel-save-sprint-preset-btn');
const customSprintDurationContainer = document.getElementById('custom-sprint-duration-container');
const customSprintDurationInput = document.getElementById('custom-sprint-duration');

let sprintPresets = store.get('sprintPresets', {});

function updateSprintPresetOptions() {
    if (!sprintPresetsSelect) return;
    Array.from(sprintPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            sprintPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(sprintPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        sprintPresetsSelect.appendChild(option);
    });
}
updateSprintPresetOptions();

sprintDurationSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customSprintDurationContainer.style.display = 'block';
    } else {
        customSprintDurationContainer.style.display = 'none';
    }
});

if (sprintPresetsSelect) {
    sprintPresetsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (deleteSprintPresetBtn) {
            deleteSprintPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
        }
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (sprintPresets[key]) {
                const data = sprintPresets[key];
                sprintDurationSelect.value = data.durationVal || '5';
                sprintDurationSelect.dispatchEvent(new Event('change'));
                if (data.durationVal === 'custom') {
                    customSprintDurationInput.value = data.customMins || 20;
                }
                sprintTasksInput.value = data.tasks || '';
            }
        }
    });
}

if (deleteSprintPresetBtn) {
    deleteSprintPresetBtn.addEventListener('click', () => {
        const val = sprintPresetsSelect.value;
        if (val.startsWith('custom-preset-')) {
            const key = val.replace('custom-preset-', '');
            if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                delete sprintPresets[key];
                store.set('sprintPresets', sprintPresets);
                updateSprintPresetOptions();
                sprintPresetsSelect.value = 'custom';
                sprintPresetsSelect.dispatchEvent(new Event('change'));
            }
        }
    });
}

if (saveSprintPresetBtn) {
    saveSprintPresetBtn.addEventListener('click', () => {
        saveSprintPresetContainer.style.display = 'flex';
        sprintPresetNameInput.focus();
    });
}

if (confirmSaveSprintPresetBtn) {
    confirmSaveSprintPresetBtn.addEventListener('click', () => {
        const name = sprintPresetNameInput.value;
        if (name && name.trim()) {
            sprintPresets[name.trim()] = {
                durationVal: sprintDurationSelect.value,
                customMins: sprintDurationSelect.value === 'custom' ? (parseInt(customSprintDurationInput.value, 10) || 20) : null,
                tasks: sprintTasksInput.value
            };
            store.set('sprintPresets', sprintPresets);
            updateSprintPresetOptions();
            sprintPresetsSelect.value = `custom-preset-${name.trim()}`;
            sprintPresetNameInput.value = '';
            saveSprintPresetContainer.style.display = 'none';
        }
    });
}

if (cancelSaveSprintPresetBtn) {
    cancelSaveSprintPresetBtn.addEventListener('click', () => {
        sprintPresetNameInput.value = '';
        saveSprintPresetContainer.style.display = 'none';
    });
}

function updateSprintDisplay() {
    sprintTimeLeft.innerText = formatTime(sprintTimerSeconds);
    const taskName = sprintTasks[currentSprintTaskIndex] || `Sprint ${currentSprintTaskIndex + 1}`;
    sprintCurrentTask.innerText = taskName;
    sprintTasksLeft.innerText = `Remaining Tasks: ${Math.max(0, sprintTasks.length - currentSprintTaskIndex - 1)}`;
}



ipcRenderer.on('timer-complete-sprint', () => {
    playChime();
    recordFocusSession(Math.round(sprintDurationSeconds / 60), 'Micro-Task Sprint');
    nextSprintBtn.style.display = 'block';
    skipSprintBtn.style.display = 'block';
});

function startNextSprintTask() {
    if (currentSprintTaskIndex >= sprintTasks.length && sprintTasks.length > 0) {
        stopSprintMode();
        return;
    }
    nextSprintBtn.style.display = 'none';
    skipSprintBtn.style.display = 'block'; // Allow skipping during the sprint
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
    skipSprintBtn.style.display = 'none';
}

stopSprintBtn.addEventListener('click', stopSprintMode);

startSprintBtn.addEventListener('click', () => {
    const rawTasks = sprintTasksInput.value.split('\n').map(t => t.trim()).filter(Boolean);
    sprintTasks = rawTasks.length > 0 ? rawTasks : ['Unnamed Sprint'];
    currentSprintTaskIndex = 0;
    
    let durationMins = 5;
    if (sprintDurationSelect.value === 'custom') {
        durationMins = parseInt(customSprintDurationInput.value, 10) || 5;
    } else {
        durationMins = parseInt(sprintDurationSelect.value, 10);
    }
    sprintDurationSeconds = durationMins * 60;
    
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

skipSprintBtn.addEventListener('click', () => {
    ipcRenderer.send('stop-timer', 'sprint'); // Stop current sprint without recording
    currentSprintTaskIndex++;
    if (currentSprintTaskIndex >= sprintTasks.length) {
        stopSprintMode();
    } else {
        startNextSprintTask();
    }
});

// --- Flow State Stopwatch Mode ---
const flowChimeIntervalInput = document.getElementById('flow-chime-interval');
const startFlowBtn = document.getElementById('start-flow-btn');
const stopFlowBtn = document.getElementById('stop-flow-btn');
const flowTimerDisplay = document.getElementById('flow-timer-display');
const flowTimeElapsed = document.getElementById('flow-time-elapsed');

let isFlowRunning = false;
let flowStartTime = 0;
let flowInterval = null;

function updateFlowDisplay(elapsedSeconds) {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    flowTimeElapsed.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function startFlowState() {
    isFlowRunning = true;
    startFlowBtn.style.display = 'none';
    stopFlowBtn.style.display = 'block';
    setInputsLocked('config-flow-state', true);
    flowTimerDisplay.classList.remove('hidden');
    
    flowStartTime = Date.now();
    let chimeIntervalMinutes = parseInt(flowChimeIntervalInput.value, 10) || 0;
    let nextChimeSeconds = chimeIntervalMinutes > 0 ? chimeIntervalMinutes * 60 : 0;
    
    updateFlowDisplay(0);
    
    flowInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - flowStartTime) / 1000);
        updateFlowDisplay(elapsedSeconds);
        
        if (nextChimeSeconds > 0 && elapsedSeconds >= nextChimeSeconds) {
            playChime();
            nextChimeSeconds += chimeIntervalMinutes * 60;
        }
    }, 1000);
}

function stopFlowState() {
    if (!isFlowRunning) return;
    isFlowRunning = false;
    startFlowBtn.style.display = 'block';
    stopFlowBtn.style.display = 'none';
    setInputsLocked('config-flow-state', false);
    flowTimerDisplay.classList.add('hidden');
    
    if (flowInterval) {
        clearInterval(flowInterval);
        flowInterval = null;
    }
    
    const elapsedSeconds = Math.floor((Date.now() - flowStartTime) / 1000);
    const elapsedMinutes = Math.round(elapsedSeconds / 60);
    if (elapsedMinutes > 0) {
        recordFocusSession(elapsedMinutes, 'Flow State');
    }
}

startFlowBtn.addEventListener('click', startFlowState);
stopFlowBtn.addEventListener('click', stopFlowState);

// Workflow elements will be initialized in initializeDomElements()
let workflowBlocks = [];
let workflowPresets = store.get('workflowPresets', {});

function updateWorkflowPresetOptions() {
    if (!workflowPresetsSelect) return;
    Array.from(workflowPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            workflowPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(workflowPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        workflowPresetsSelect.appendChild(option);
    });
}
updateWorkflowPresetOptions();

function updateWorkflowCurrentPresetDisplay() {
    const presetDisplay = document.getElementById('workflow-current-preset');
    if (!presetDisplay) return;
    
    const val = workflowPresetsSelect.value;
    if (val === 'custom') {
        presetDisplay.innerText = 'Custom';
    } else if (val.startsWith('custom-preset-')) {
        const key = val.replace('custom-preset-', '');
        presetDisplay.innerText = key;
    } else {
        presetDisplay.innerText = 'Custom';
    }
}

// Helper: Get available presets for a given type
function getAvailablePresetsForType(type) {
    const presets = [];
    if (type === 'pomo') {
        presets.push({ key: 'deep-work', label: 'Deep Work - 50/10' });
        presets.push({ key: 'quick-study', label: 'Quick Study - 25/5' });
        presets.push({ key: 'homework', label: 'Homework - 45/15' });
        Object.keys(customPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    } else if (type === 'sprint') {
        presets.push({ key: 'custom', label: 'Custom' });
        Object.keys(sprintPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    } else if (type === 'repeating') {
        presets.push({ key: 'custom', label: 'Custom' });
        Object.keys(repeatingPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    }
    return presets;
}

// Helper: Get preset details based on type and presetKey
function getPresetDetails(type, presetKey) {
    const details = {
        type: type,
        presetKey: presetKey,
        displayName: '',
        sequence: null,
        duration: null,
        rounds: null,
        interval: null
    };

    if (type === 'pomo') {
        let seq = null;
        if (presetKey === 'deep-work') {
            seq = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
            details.displayName = 'Deep Work - 50/10';
        } else if (presetKey === 'quick-study') {
            seq = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
            details.displayName = 'Quick Study - 25/5';
        } else if (presetKey === 'homework') {
            seq = [{ type: 'work', duration: 45 }, { type: 'break', duration: 15 }];
            details.displayName = 'Homework - 45/15';
        } else if (presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (customPresets[key]) {
                seq = customPresets[key];
                details.displayName = `Custom: ${key}`;
            }
        }
        if (seq) {
            details.sequence = seq;
            const totalMins = seq.reduce((acc, p) => acc + (p.unit === 'secs' ? p.duration/60 : p.duration), 0);
            details.duration = Math.round(totalMins * 10) / 10;
        }
    } else if (type === 'sprint') {
        if (presetKey === 'custom') {
            details.displayName = 'Custom Sprint';
            details.duration = parseInt(sprintDurationSelect.value, 10) || 15;
        } else if (presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (sprintPresets[key]) {
                details.displayName = `Custom: ${key}`;
                details.duration = sprintPresets[key].duration || 15;
            }
        }
    } else if (type === 'repeating') {
        if (presetKey === 'custom') {
            details.displayName = 'Custom Reminders';
            const intervalMins = parseInt(reminderIntervalInput.value, 10) || 0;
            const intervalSecs = parseInt(reminderIntervalSecondsInput.value, 10) || 0;
            const rounds = parseInt(reminderRoundsInput.value, 10) || 1;
            details.interval = { mins: intervalMins, secs: intervalSecs };
            details.rounds = rounds;
            details.duration = Math.round(((intervalMins * 60 + intervalSecs) * rounds) / 60);
        } else if (presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (repeatingPresets[key]) {
                details.displayName = `Custom: ${key}`;
                details.interval = repeatingPresets[key].interval;
                details.rounds = repeatingPresets[key].rounds;
                const minsTotal = repeatingPresets[key].interval.mins;
                const secsTotal = repeatingPresets[key].interval.secs;
                details.duration = Math.round(((minsTotal * 60 + secsTotal) * repeatingPresets[key].rounds) / 60);
            }
        }
    }

    return details;
}

function calculateBlockDuration(block) {
    let baseMins = 0;
    
    // If block has presetKey, use it for calculation
    if (block.presetKey) {
        const details = getPresetDetails(block.type, block.presetKey);
        baseMins = details.duration || 0;
    } else {
        // Fallback to old behavior for blocks without presetKey
        if (block.type === 'pomo') {
            baseMins = pomoSequence.reduce((acc, p) => acc + (p.unit === 'secs' ? p.duration/60 : p.duration), 0);
        } else if (block.type === 'sprint') {
            let dur = sprintDurationSelect.value;
            baseMins = dur === 'custom' ? (parseInt(customSprintDurationInput.value, 10) || 20) : parseInt(dur, 10);
        } else if (block.type === 'repeating') {
            const intervalMins = parseInt(reminderIntervalInput.value, 10) || 0;
            const intervalSecs = parseInt(reminderIntervalSecondsInput.value, 10) || 0;
            const rounds = parseInt(reminderRoundsInput.value, 10) || 1;
            baseMins = ((intervalMins * 60 + intervalSecs) * rounds) / 60;
        }
    }
    
    return Math.max(1, Math.round(baseMins * block.cycles));
}

function addWorkflowBlock(type) {
    // Get the first available preset as default
    const availablePresets = getAvailablePresetsForType(type);
    const defaultPresetKey = availablePresets.length > 0 ? availablePresets[0].key : 'custom';

    const block = {
        id: 'block-' + Date.now(),
        type: type,
        name: type === 'pomo' ? 'Pomo Session' : (type === 'sprint' ? 'Micro-Sprint' : 'Repeating Reminder'),
        cycles: 1,
        presetKey: defaultPresetKey
    };
    workflowBlocks.push(block);
    renderWorkflowStack();
}

function renderWorkflowStack() {
    try {
        if (!window.workflowStack) {
            console.error('[Startup] workflowStack element not found!');
            return;
        }
        
        const existingBlocks = window.workflowStack.querySelectorAll('.workflow-block');
        existingBlocks.forEach(b => b.remove());

        if (workflowBlocks.length === 0) {
        if (window.workflowStackPlaceholder) window.workflowStackPlaceholder.style.display = 'block';
        if (window.workflowTotalDurationEl) window.workflowTotalDurationEl.innerText = '0m';
        return;
    }

    if (window.workflowStackPlaceholder) window.workflowStackPlaceholder.style.display = 'none';
        let totalDuration = 0;

        workflowBlocks.forEach((block, index) => {
            const dur = calculateBlockDuration(block);
            totalDuration += dur;

        const blockEl = document.createElement('div');
        blockEl.className = 'workflow-block';
        
        let typeIcon = '';
        let typeColor = 'var(--header-grad-1)';
        if (block.type === 'pomo') {
            typeIcon = '✓';
        } else if (block.type === 'sprint') {
            typeIcon = '☑';
            typeColor = '#3498db';
        } else if (block.type === 'repeating') {
            typeIcon = '⟳';
            typeColor = '#27ae60';
        }

        const availablePresets = getAvailablePresetsForType(block.type);
        const presetDetails = getPresetDetails(block.type, block.presetKey);

        let presetSelectHtml = '<select class="block-preset-input" data-index="' + index + '" style="flex: 1; padding: 6px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--text-color); font-size: 0.9rem;">';
        availablePresets.forEach(preset => {
            const selected = preset.key === block.presetKey ? 'selected' : '';
            presetSelectHtml += '<option value="' + preset.key + '" ' + selected + '>' + preset.label + '</option>';
        });
        presetSelectHtml += '</select>';

        // Create preset details content
        let phaseDetailsHtml = '';
        if (block.type === 'pomo' && presetDetails.sequence) {
            presetDetails.sequence.forEach(phase => {
                const phaseType = phase.type === 'work' ? 'Work' : 'Break';
                const phaseDuration = phase.unit === 'secs' ? `${phase.duration}s` : `${phase.duration}m`;
                phaseDetailsHtml += `<div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--timer-text); margin-bottom: 4px;"><span>${phaseType} Phase for</span><span style="font-weight: 600;">${phaseDuration}</span></div>`;
            });
        } else if (block.type === 'sprint') {
            phaseDetailsHtml = `<div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--timer-text);"><span>Sprint Duration for</span><span style="font-weight: 600;">${presetDetails.duration}m</span></div>`;
        } else if (block.type === 'repeating') {
            const interval = presetDetails.interval;
            phaseDetailsHtml = `<div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--timer-text); margin-bottom: 4px;"><span>Interval Phase for</span><span style="font-weight: 600;">${interval.mins}m ${interval.secs}s</span></div><div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--timer-text);"><span>Rounds per cycle</span><span style="font-weight: 600;">${presetDetails.rounds}</span></div>`;
        }

        blockEl.style.cssText = `
            background: var(--container-bg);
            border-radius: 12px;
            border: 2px solid ${typeColor}40;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transition: all 0.2s ease;
            overflow: hidden;
        `;

        blockEl.innerHTML = `
            <!-- Colored Header -->
            <div style="background: linear-gradient(135deg, ${typeColor} 0%, ${typeColor}dd 100%); padding: 12px 15px; color: white; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <div style="font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 6px;">${typeIcon}</div>
                    <div style="font-weight: 600; font-size: 1.05rem;">${block.type === 'pomo' ? 'Pomo Style' : block.type === 'sprint' ? 'Micro-Task Sprint' : 'Repeating Reminders'}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-weight: 600; font-size: 0.95rem;">${dur > 60 ? Math.floor(dur/60) + ' hr ' + (dur%60) + ' m' : dur + ' m'}</div>
                    <button class="remove-block-btn" data-index="${index}" style="margin: 0; width: auto; padding: 4px 8px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.8rem; transition: all 0.2s;">×</button>
                </div>
            </div>

            <!-- Block Content -->
            <div style="padding: 15px; display: flex; flex-direction: column; gap: 12px; background: var(--container-bg);">
                <!-- Preset Selector Row -->
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 600; color: var(--text-color); font-size: 0.95rem;">Preset:</span>
                    ${presetSelectHtml}
                </div>

                <!-- Info Label -->
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--heading-color); margin-top: 4px;">Info</div>

                <!-- Phase Details -->
                <div style="background: var(--timer-bg); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px;">
                    ${phaseDetailsHtml}
                </div>

                <!-- Cycles Input Row -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                    <span style="font-weight: 600; color: var(--text-color); font-size: 0.95rem;">Cycles:</span>
                    <div style="display: flex; align-items: center;">
                        <input type="number" class="block-cycles-input" value="${block.cycles}" min="1" data-index="${index}" style="width: 70px; padding: 6px; text-align: center; border: 1px solid var(--input-border); border-radius: 6px; background: var(--input-bg); font-weight: 600; color: var(--heading-color);">
                    </div>
                </div>
            </div>
        `;

        window.workflowStack.appendChild(blockEl);
    });

    if (window.workflowTotalDurationEl) window.workflowTotalDurationEl.innerText = `${totalDuration}m`;
  } catch (error) {
    console.error('[Startup] Error rendering workflow stack:', error);
  }
}

// --- Workflow Execution ---
const startWorkflowBtn = document.getElementById('start-workflow-btn');
const stopWorkflowBtn = document.getElementById('stop-workflow-btn');

let isWorkflowRunning = false;
let currentWorkflowBlockIndex = 0;
let workflowMonitorInterval = null;

function startNextWorkflowBlock() {
    if (currentWorkflowBlockIndex >= workflowBlocks.length || !isWorkflowRunning) {
        stopWorkflowExecution();
        return;
    }
    
    const block = workflowBlocks[currentWorkflowBlockIndex];
    
    // Set the respective presets based on block
    if (block.type === 'pomo') {
        const presetsSelect = document.getElementById('pomo-presets');
        if (presetsSelect) {
            presetsSelect.value = block.presetKey;
            presetsSelect.dispatchEvent(new Event('change'));
        }
        const repeatsInput = document.getElementById('pomo-repeats');
        if (repeatsInput) repeatsInput.value = block.cycles;
        
        document.querySelector('.home-btn[data-mode="pomo-style"]').click();
        
        // Wait a small delay for UI transition, then start
        setTimeout(() => {
            const startBtn = document.getElementById('start-pomo-btn');
            if (startBtn && !isPomoRunning) startBtn.click();
            monitorActiveBlock();
        }, 300);
        
    } else if (block.type === 'sprint') {
        const presetsSelect = document.getElementById('sprint-presets');
        if (presetsSelect) {
            presetsSelect.value = block.presetKey;
            presetsSelect.dispatchEvent(new Event('change'));
        }
        document.querySelector('.home-btn[data-mode="micro-sprint"]').click();
        
        setTimeout(() => {
            const startBtn = document.getElementById('start-sprint-btn');
            if (startBtn && !isSprintRunning) startBtn.click();
            monitorActiveBlock();
        }, 300);
        
    } else if (block.type === 'repeating') {
        const presetsSelect = document.getElementById('repeating-presets');
        if (presetsSelect) {
            presetsSelect.value = block.presetKey;
            presetsSelect.dispatchEvent(new Event('change'));
        }
        const roundsInput = document.getElementById('reminder-rounds');
        if (roundsInput) roundsInput.value = block.cycles;
        
        document.querySelector('.home-btn[data-mode="repeating-reminders"]').click();
        
        setTimeout(() => {
            const startBtn = document.getElementById('start-repeating-btn');
            if (startBtn && !isRepeatingRunning) startBtn.click();
            monitorActiveBlock();
        }, 300);
    }
}

function monitorActiveBlock() {
    if (workflowMonitorInterval) clearInterval(workflowMonitorInterval);
    
    // Give the timer a second to set its 'isRunning' flag to true
    setTimeout(() => {
        workflowMonitorInterval = setInterval(() => {
            if (!isWorkflowRunning) {
                clearInterval(workflowMonitorInterval);
                return;
            }
            
            const block = workflowBlocks[currentWorkflowBlockIndex];
            let isRunning = false;
            
            if (block.type === 'pomo') isRunning = isPomoRunning;
            else if (block.type === 'sprint') isRunning = isSprintRunning;
            else if (block.type === 'repeating') isRunning = isRepeatingRunning;
            
            if (!isRunning) {
                clearInterval(workflowMonitorInterval);
                currentWorkflowBlockIndex++;
                startNextWorkflowBlock();
            }
        }, 1000);
    }, 1000);
}

function stopWorkflowExecution() {
    isWorkflowRunning = false;
    currentWorkflowBlockIndex = 0;
    if (workflowMonitorInterval) clearInterval(workflowMonitorInterval);
    
    if (startWorkflowBtn) startWorkflowBtn.style.display = 'block';
    if (stopWorkflowBtn) stopWorkflowBtn.style.display = 'none';
    
    setInputsLocked('config-workflows', false);
    
    if (isPomoRunning) stopPomoStyle();
    if (isSprintRunning) stopSprintMode();
    if (isRepeatingRunning) stopRepeatingReminders();
    
    const workflowBtn = document.querySelector('.home-btn[data-mode="workflows"]');
    if (workflowBtn) workflowBtn.click();
}

if (startWorkflowBtn) {
    startWorkflowBtn.addEventListener('click', () => {
        if (workflowBlocks.length === 0) {
            customAlert('Please add blocks to your Building Stack before starting.');
            return;
        }
        
        isWorkflowRunning = true;
        currentWorkflowBlockIndex = 0;
        
        if (startWorkflowBtn) startWorkflowBtn.style.display = 'none';
        if (stopWorkflowBtn) stopWorkflowBtn.style.display = 'block';
        
        setInputsLocked('config-workflows', true);
        
        startNextWorkflowBlock();
    });
}

if (stopWorkflowBtn) {
    stopWorkflowBtn.addEventListener('click', stopWorkflowExecution);
}



