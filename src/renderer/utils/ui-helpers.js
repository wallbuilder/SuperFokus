export function setInputsLocked(sectionId, locked) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const inputs = section.querySelectorAll('input, select, textarea, button:not(.start-btn):not(.stop-btn):not(.continue-btn)');
    inputs.forEach(input => {
        input.disabled = locked;
    });
}

export function toggleStartStopButton(btnElement) {
  if (!btnElement) return;
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

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
