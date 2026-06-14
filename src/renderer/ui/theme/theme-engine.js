import { ipcRenderer } from '../../utils/ipc.js';
import { store } from '../../utils/storage.js';
import { modeLabels, modeNames } from './theme-config.js';

export let currentThemeMode = 'light';
export let showHeaderDarkModeToggle = true;

export function setCurrentThemeMode(val) { currentThemeMode = val; }
export function setShowHeaderDarkModeToggle(val) { showHeaderDarkModeToggle = val; }

export function getNextThemeMode() {
    if (currentThemeMode === 'light') return 'dark';
    if (currentThemeMode === 'dark') return 'cyber-green';
    return 'light';
}

export function updateHeaderToggleButtonText() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;
    
    themeToggleBtn.innerText = modeLabels[currentThemeMode] || 'Theme';
    
    const targetState = getNextThemeMode();
    themeToggleBtn.title = `Change to ${modeNames[targetState] || targetState}`;
}

export function applyTheme() {
    document.documentElement.style.removeProperty('--header-grad-1');
    document.documentElement.style.removeProperty('--header-grad-2');
    document.documentElement.style.removeProperty('--header-title-color');
    document.documentElement.style.removeProperty('--h1-color');
    document.documentElement.style.removeProperty('--h2-color');
    document.documentElement.style.removeProperty('--h3-color');
    document.documentElement.style.removeProperty('--text-color');
    document.documentElement.style.removeProperty('--bg-grad-1');
    document.documentElement.style.removeProperty('--bg-grad-2');
    document.documentElement.style.removeProperty('--container-bg');
    document.documentElement.style.removeProperty('--drawer-bg');
    document.documentElement.style.removeProperty('--heading-color');
    document.documentElement.style.removeProperty('--modal-bg');
    document.body.classList.remove('dark-mode');
    document.body.classList.remove('cyber-green-mode');

    const themeData = {
        mode: currentThemeMode,
        isDark: currentThemeMode === 'dark' || currentThemeMode === 'cyber-green',
        colors: {}
    };

    if (currentThemeMode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (currentThemeMode === 'cyber-green') {
        document.body.classList.add('cyber-green-mode');
    }

    ipcRenderer.send('theme-changed', themeData);
    updateHeaderToggleButtonText();
}

export function applyHeaderToggleVisibility() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.style.display = showHeaderDarkModeToggle ? 'block' : 'none';
    }
}

export function setThemeMode(mode) {
    currentThemeMode = mode;
    store.set('themeMode', currentThemeMode);
    
    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');

    if (themeRadioLight) themeRadioLight.checked = (mode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (mode === 'dark');
    if (themeRadioCyberGreen) themeRadioCyberGreen.checked = (mode === 'cyber-green');

    applyTheme();
}
