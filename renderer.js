const fokusModeSelect = document.getElementById('fokus-mode');
const configRepeatingReminders = document.getElementById('config-repeating-reminders');

fokusModeSelect.addEventListener('change', (event) => {
  const selectedMode = event.target.value;

  // Hide all config sections first
  configRepeatingReminders.classList.remove('active');

  // Show the specific config section for the selected mode
  if (selectedMode === 'repeating-reminders') {
    configRepeatingReminders.classList.add('active');
  }
});
