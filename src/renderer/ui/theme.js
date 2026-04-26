import { ipcRenderer } from '../utils/ipc.js';
import { store } from '../utils/storage.js';

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

export { toggleTheme, applyTheme, applyHeaderToggleVisibility };