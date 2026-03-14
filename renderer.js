const { ipcRenderer } = require('electron');

// Startup Animation Logic
window.addEventListener('DOMContentLoaded', () => {
  const startupScreen = document.getElementById('startup-screen');
  // Wait 1.5 seconds, then fade out
  setTimeout(() => {
    startupScreen.style.opacity = '0';
    // Remove from DOM flow after fade transition completes
    setTimeout(() => {
      startupScreen.style.display = 'none';
    }, 1000); // matches the 1s CSS transition
  }, 1500);
});

// Mode Selection Elements
const fokusModeSelect = document.getElementById('fokus-mode');
const configSections = {
  'repeating-reminders': document.getElementById('config-repeating-reminders'),
  'pomo-style': document.getElementById('config-pomo-style'),
  'site-blocker': document.getElementById('config-site-blocker')
};

// Repeating Reminders Elements
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

// Pomo Style Elements
const pomoInfiniteLongCheckbox = document.getElementById('pomo-infinite-long');
const pomoLongBreakContainer = document.getElementById('pomo-long-break-container');
const pomoLongBreakInput = document.getElementById('pomo-long-break');
const pomoShortBreakInput = document.getElementById('pomo-short-break');
const pomoInfiniteStatus = document.getElementById('pomo-infinite-status');
const pomoErrorMsg = document.getElementById('pomo-error');
const startPomoBtn = document.getElementById('start-pomo-btn');
const pomoShortCountInput = document.getElementById('pomo-short-count');
const pomoLongCountInput = document.getElementById('pomo-long-count');
const pomoTimerDisplay = document.getElementById('pomo-timer-display');
const pomoStatusText = document.getElementById('pomo-status-text');
const pomoTimeLeft = document.getElementById('pomo-time-left');
const pomoNextText = document.getElementById('pomo-rounds-left');

// State Variables
let repeatingInterval = null;
let repeatingTimer = null;
let currentRounds = 0;
let isRepeatingRunning = false;

let pomoInterval = null;
let pomoTimer = null;
let isPomoRunning = false;
let pomoPhase = 'work'; // 'work', 'short-break', 'long-break'
let currentShortBreaks = 0;
let currentLongBreaks = 0;
let totalShortBreaks = 0;
let totalLongBreaks = 0;

// --- Event Listeners ---

// 1. Mode Switching
fokusModeSelect.addEventListener('change', (event) => {
  const selectedMode = event.target.value;

  // Hide all sections
  Object.values(configSections).forEach(section => {
    if (section) section.classList.remove('active');
  });

  // Show selected section
  if (configSections[selectedMode]) {
    configSections[selectedMode].classList.add('active');
  }
});

// 2. Repeating Reminders Infinite Rounds Toggle
infiniteRoundsCheckbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    roundsContainer.classList.add('hidden');
    infiniteStatus.style.display = 'block';
  } else {
    roundsContainer.classList.remove('hidden');
    infiniteStatus.style.display = 'none';
  }
});

// 3. Pomo Style Infinite Long Break Toggle
pomoInfiniteLongCheckbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    pomoLongBreakContainer.classList.add('hidden');
    pomoInfiniteStatus.style.display = 'block';
    pomoErrorMsg.style.display = 'none'; // Clear error when infinite
  } else {
    pomoLongBreakContainer.classList.remove('hidden');
    pomoInfiniteStatus.style.display = 'none';
    validatePomoBreaks(); // Re-validate when unchecking
  }
});

// 4. Pomo Style Validation (Short Break < Long Break)
function validatePomoBreaks() {
  if (pomoInfiniteLongCheckbox.checked) return; // No validation needed if long break is infinite

  const shortBreak = parseInt(pomoShortBreakInput.value, 10);
  const longBreak = parseInt(pomoLongBreakInput.value, 10);

  if (!isNaN(shortBreak) && !isNaN(longBreak)) {
    if (shortBreak >= longBreak) {
      pomoErrorMsg.style.display = 'block';
      return false;
    } else {
      pomoErrorMsg.style.display = 'none';
      return true;
    }
  }
  pomoErrorMsg.style.display = 'none';
  return true; // Return true if empty inputs
}

pomoShortBreakInput.addEventListener('input', validatePomoBreaks);
pomoLongBreakInput.addEventListener('input', validatePomoBreaks);

// 5. Start/Stop Button Toggle Logic
function toggleStartStopButton(btnElement) {
  if (btnElement.classList.contains('start-btn')) {
    // Switch to Stop
    btnElement.classList.remove('start-btn');
    btnElement.classList.add('stop-btn');
    btnElement.innerHTML = 'Stop \u2715';
  } else {
    // Switch to Start
    btnElement.classList.remove('stop-btn');
    btnElement.classList.add('start-btn');
    btnElement.innerHTML = 'Start \u27A4';
  }
}

// UI Locking Utility
function setInputsLocked(sectionId, locked) {
    const section = document.getElementById(sectionId);
    const inputs = section.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id !== 'start-repeating-btn' && input.id !== 'start-pomo-btn') {
            input.disabled = locked;
        }
    });
    fokusModeSelect.disabled = locked;
}

// --- Repeating Reminders Implementation ---

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

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

    if (isNaN(intervalMins) || intervalMins <= 0) {
        alert('Please enter a valid interval.');
        return;
    }
    if (!isInfinite && (isNaN(rounds) || rounds <= 0)) {
        alert('Please enter a valid number of rounds.');
        return;
    }

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
            // Trigger Popup
            ipcRenderer.send('show-popup', reminderMessageInput.value);
            
            if (!isInfinite) {
                currentRounds--;
            }

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
    if (!isRepeatingRunning) {
        startRepeatingReminders();
    } else {
        stopRepeatingReminders();
    }
});

// --- Pomo Style Implementation ---

function updatePomoDisplay() {
    pomoTimeLeft.innerText = formatTime(pomoTimer);
    
    let phaseName = '';
    let nextPhase = '';
    
    if (pomoPhase === 'work') {
        phaseName = 'Work Session';
        nextPhase = (currentShortBreaks < totalShortBreaks) ? 'Next: Short Break' : 'Next: Long Break';
    } else if (pomoPhase === 'short-break') {
        phaseName = 'Short Break';
        nextPhase = 'Next: Work Session';
    } else {
        phaseName = 'Long Break';
        nextPhase = (currentLongBreaks < totalLongBreaks || pomoInfiniteLongCheckbox.checked) ? 'Next: Work Session' : 'Pomo Finished';
    }
    
    pomoStatusText.innerText = phaseName;
    pomoNextText.innerText = nextPhase;

    // Send update to Pomo Timer window
    ipcRenderer.send('update-pomo-timer', {
        phase: phaseName,
        timeLeft: formatTime(pomoTimer),
        percent: (pomoTimer / getPomoPhaseDuration()) * 100
    });
}

function getPomoPhaseDuration() {
    if (pomoPhase === 'work') return 25 * 60; // Standard 25 mins for work
    if (pomoPhase === 'short-break') return parseInt(pomoShortBreakInput.value, 10) * 60;
    if (pomoPhase === 'long-break') return parseInt(pomoLongBreakInput.value, 10) * 60;
    return 0;
}

function startPomoStyle() {
    if (!validatePomoBreaks()) {
        alert('Please fix the break durations before starting.');
        return;
    }

    totalShortBreaks = parseInt(pomoShortCountInput.value, 10) || 0;
    totalLongBreaks = parseInt(pomoLongCountInput.value, 10) || 0;
    
    isPomoRunning = true;
    pomoPhase = 'work';
    currentShortBreaks = 0;
    currentLongBreaks = 0;
    pomoTimer = getPomoPhaseDuration();

    toggleStartStopButton(startPomoBtn);
    setInputsLocked('config-pomo-style', true);
    pomoTimerDisplay.classList.remove('hidden');
    
    ipcRenderer.send('open-pomo-timer');
    updatePomoDisplay();

    pomoInterval = setInterval(() => {
        pomoTimer--;
        if (pomoTimer < 0) {
            handlePomoTransition();
        } else {
            updatePomoDisplay();
        }
    }, 1000);
}

function handlePomoTransition() {
    const pomoAction = document.querySelector('input[name="pomo-action"]:checked').value;

    if (pomoPhase === 'work') {
        if (currentShortBreaks < totalShortBreaks) {
            pomoPhase = 'short-break';
            currentShortBreaks++;
        } else if (currentLongBreaks < totalLongBreaks || pomoInfiniteLongCheckbox.checked) {
            pomoPhase = 'long-break';
            currentLongBreaks++;
        } else {
            stopPomoStyle();
            return;
        }
        
        // Trigger break popup
        const isFullScreen = (pomoAction === 'block');
        ipcRenderer.send('show-break-popup', { 
            type: pomoPhase === 'short-break' ? 'Short Break' : 'Long Break',
            duration: getPomoPhaseDuration(),
            fullScreen: isFullScreen
        });

    } else {
        // Break finished, back to work
        pomoPhase = 'work';
        ipcRenderer.send('close-popup');
        ipcRenderer.send('close-fullscreen');
    }

    pomoTimer = getPomoPhaseDuration();
    updatePomoDisplay();
}

function stopPomoStyle() {
    isPomoRunning = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
    
    toggleStartStopButton(startPomoBtn);
    setInputsLocked('config-pomo-style', false);
    pomoTimerDisplay.classList.add('hidden');
    
    ipcRenderer.send('close-pomo-timer');
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
}

startPomoBtn.addEventListener('click', () => {
  if (!isPomoRunning) {
      startPomoStyle();
  } else {
      stopPomoStyle();
  }
});
