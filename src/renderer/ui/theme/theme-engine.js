import { ipcRenderer } from '../../utils/ipc.js';
import { store } from '../../utils/storage.js';
import { modeLabels, modeNames } from './theme-config.js';

export let currentThemeMode = 'light';
export let showHeaderDarkModeToggle = true;

export function setCurrentThemeMode(val) { currentThemeMode = val; }
export function setShowHeaderDarkModeToggle(val) { showHeaderDarkModeToggle = val; }

export function getNextThemeMode() {
    if (currentThemeMode === customToggleState1) return customToggleState2;
    return customToggleState1;
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
    document.body.classList.remove('cyber-white-mode');
    document.body.classList.remove('cyber-lightblue-mode');
    document.body.classList.remove('cyber-blue-mode');

    const themeData = {
        mode: currentThemeMode,
        isDark: currentThemeMode === 'dark' || currentThemeMode.startsWith('cyber-'),
        colors: {}
    };

    if (currentThemeMode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (currentThemeMode.startsWith('cyber-')) {
        document.body.classList.add(currentThemeMode + '-mode');
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
    const themeRadioCyberWhite = document.getElementById('theme-radio-cyber-white');
    const themeRadioCyberLightblue = document.getElementById('theme-radio-cyber-lightblue');
    const themeRadioCyberBlue = document.getElementById('theme-radio-cyber-blue');

    if (themeRadioLight) themeRadioLight.checked = (mode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (mode === 'dark');
    if (themeRadioCyberGreen) themeRadioCyberGreen.checked = (mode === 'cyber-green');
    if (themeRadioCyberWhite) themeRadioCyberWhite.checked = (mode === 'cyber-white');
    if (themeRadioCyberLightblue) themeRadioCyberLightblue.checked = (mode === 'cyber-lightblue');
    if (themeRadioCyberBlue) themeRadioCyberBlue.checked = (mode === 'cyber-blue');

    applyTheme();
}

export let customToggleState1 = 'light';
export let customToggleState2 = 'dark';
export function setCustomToggleState1(val) { customToggleState1 = val; }
export function setCustomToggleState2(val) { customToggleState2 = val; }
