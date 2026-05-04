export function setInputsLocked(sectionId, locked) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const inputs = section.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
        const text = input.textContent ? input.textContent.toLowerCase() : '';
        const isStopBtn = text.includes('stop') || input.id.includes('stop') || input.className.includes('stop');
        const isContinueBtn = text.includes('continue') || input.id.includes('continue') || input.className.includes('continue');
        
        if (isStopBtn || isContinueBtn) {
            input.disabled = false; // Always enabled
        } else {
            input.disabled = locked;
        }
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
