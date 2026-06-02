import { ipcRenderer } from '../../utils/ipc.js';
import { store } from '../../utils/storage.js';
import { CUSTOM_COLOR_MAP, modeLabels, modeNames } from './theme-config.js';

export let currentThemeMode = 'light';
export let showHeaderDarkModeToggle = true;
export let isCustomThemeSaved = false;
export let activeCustomColors = {};

export function setCurrentThemeMode(val) { currentThemeMode = val; }
export function setShowHeaderDarkModeToggle(val) { showHeaderDarkModeToggle = val; }
export function setIsCustomThemeSaved(val) { isCustomThemeSaved = val; }
export function setActiveCustomColors(colors) { activeCustomColors = { ...colors }; }

export function getNextThemeMode() {
    if (currentThemeMode === 'light') return 'dark';
    if (currentThemeMode === 'dark') return isCustomThemeSaved ? 'custom' : 'light';
    return 'light';
}

export function updateHeaderToggleButtonText() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;
    
    themeToggleBtn.innerText = modeLabels[currentThemeMode] || 'Theme';
    
    const targetState = getNextThemeMode();
    themeToggleBtn.title = `Change color to ${modeNames[targetState] || targetState}`;
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

    const themeData = {
        mode: currentThemeMode,
        isDark: currentThemeMode === 'dark',
        colors: {}
    };

    const customThemeOptions = document.getElementById('custom-theme-options');
    if (customThemeOptions) {
        // Only update UI if the mode is actually applied as custom, OR if we're in the modal and a pending change is made? 
        // We will handle modal UI separately in theme-ui.js updateCustomThemeOptionsVisibility. 
        // But for fallback here:
        if (currentThemeMode === 'custom') {
            customThemeOptions.style.opacity = '1';
            customThemeOptions.style.pointerEvents = 'auto';
        }
    }

    if (currentThemeMode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (currentThemeMode === 'custom') {
        for (const [id, variable] of Object.entries(CUSTOM_COLOR_MAP)) {
            const val = activeCustomColors[id];
            if (val) {
                document.documentElement.style.setProperty(variable, val);
                themeData.colors[variable] = val;
            }
        }
        const h1Val = activeCustomColors['custom-h1-color'];
        if (h1Val) {
            document.documentElement.style.setProperty('--heading-color', h1Val);
            themeData.colors['--heading-color'] = h1Val;
        }
        const bg2Val = activeCustomColors['custom-bg2-color'];
        if (bg2Val) {
            document.documentElement.style.setProperty('--modal-bg', bg2Val);
            themeData.colors['--modal-bg'] = bg2Val;
        }
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
    const themeRadioCustom = document.getElementById('theme-radio-custom');

    if (themeRadioLight) themeRadioLight.checked = (mode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (mode === 'dark');
    if (themeRadioCustom) themeRadioCustom.checked = (mode === 'custom');

    applyTheme();
}
