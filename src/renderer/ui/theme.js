import { ipcRenderer } from '../utils/ipc.js';
import { store } from '../utils/storage.js';

// --- Theme & Setup ---
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleModalBtn = document.getElementById('theme-toggle-modal');
const headerDarkModeToggleCheckbox = document.getElementById('toggle-header-dark-mode');

const customMainColor = document.getElementById('custom-main-color');
const customAccentColor = document.getElementById('custom-accent-color');
const resetThemeColorsBtn = document.getElementById('reset-theme-colors-btn');
const githubToggle = document.getElementById('github-browser-toggle');

let isDarkMode = false;
let showHeaderDarkModeToggle = true;

export async function initTheme() {
    isDarkMode = await store.get('darkMode', false);
    showHeaderDarkModeToggle = await store.get('showHeaderDarkModeToggle', true);
    
    const savedMain = await store.get('customMainColor', null);
    const savedAccent = await store.get('customAccentColor', null);
    if (savedMain) {
        document.documentElement.style.setProperty('--header-grad-1', savedMain);
        if (customMainColor) customMainColor.value = savedMain;
    }
    if (savedAccent) {
        document.documentElement.style.setProperty('--header-grad-2', savedAccent);
        if (customAccentColor) customAccentColor.value = savedAccent;
    }

    if (githubToggle) {
        const useExternal = await store.get('githubExternalBrowser', true);
        githubToggle.checked = useExternal;
    }

    applyTheme();
    applyHeaderToggleVisibility();
}

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

if (customMainColor) {
    customMainColor.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--header-grad-1', e.target.value);
        store.set('customMainColor', e.target.value);
    });
}

if (customAccentColor) {
    customAccentColor.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--header-grad-2', e.target.value);
        store.set('customAccentColor', e.target.value);
    });
}

if (resetThemeColorsBtn) {
    resetThemeColorsBtn.addEventListener('click', () => {
        document.documentElement.style.removeProperty('--header-grad-1');
        document.documentElement.style.removeProperty('--header-grad-2');
        store.delete('customMainColor');
        store.delete('customAccentColor');
        if (customMainColor) customMainColor.value = '#6a11cb';
        if (customAccentColor) customAccentColor.value = '#2575fc';
    });
}

if (githubToggle) {
    githubToggle.addEventListener('change', (e) => {
        store.set('githubExternalBrowser', e.target.checked);
    });
}

export { toggleTheme, applyTheme, applyHeaderToggleVisibility };
