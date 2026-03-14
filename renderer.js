const fokusModeSelect = document.getElementById('fokus-mode');
const configRepeatingReminders = document.getElementById('config-repeating-reminders');
const infiniteRoundsCheckbox = document.getElementById('infinite-rounds');
const roundsContainer = document.getElementById('rounds-container');
const infiniteStatus = document.getElementById('infinite-status');

fokusModeSelect.addEventListener('change', (event) => {
  const selectedMode = event.target.value;

  // Hide all config sections first
  configRepeatingReminders.classList.remove('active');

  // Show the specific config section for the selected mode
  if (selectedMode === 'repeating-reminders') {
    configRepeatingReminders.classList.add('active');
  }
});

infiniteRoundsCheckbox.addEventListener('change', (event) => {
  if (event.target.checked) {
    roundsContainer.style.display = 'none';
    infiniteStatus.style.display = 'block';
  } else {
    roundsContainer.style.display = 'block';
    infiniteStatus.style.display = 'none';
  }
});
