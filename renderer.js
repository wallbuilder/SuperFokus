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

// Pomo Style Elements
const pomoInfiniteLongCheckbox = document.getElementById('pomo-infinite-long');
const pomoLongBreakContainer = document.getElementById('pomo-long-break-container');
const pomoLongBreakInput = document.getElementById('pomo-long-break');
const pomoShortBreakInput = document.getElementById('pomo-short-break');
const pomoInfiniteStatus = document.getElementById('pomo-infinite-status');
const pomoErrorMsg = document.getElementById('pomo-error');
const startPomoBtn = document.getElementById('start-pomo-btn');

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
    btnElement.innerHTML = 'Stop ✕';
  } else {
    // Switch to Start
    btnElement.classList.remove('stop-btn');
    btnElement.classList.add('start-btn');
    btnElement.innerHTML = 'Start ➤';
  }
}

startRepeatingBtn.addEventListener('click', () => {
  toggleStartStopButton(startRepeatingBtn);
});

startPomoBtn.addEventListener('click', () => {
  // Validate before "starting" if switching from start to stop
  if (startPomoBtn.classList.contains('start-btn')) {
     if (!validatePomoBreaks()) {
         alert('Please fix the break durations before starting.');
         return; // Prevent starting
     }
  }
  toggleStartStopButton(startPomoBtn);
});
