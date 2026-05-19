import { ipcRenderer } from '../../utils/ipc.js';
import { store } from '../../utils/storage.js';
import { CUSTOM_COLOR_MAP, modeLabels } from './theme-config.js';

export let currentThemeMode = 'light';
export let showHeaderDarkModeToggle = true;
export let toggleState1 = 'light';
export let toggleState2 = 'dark';

export function setCurrentThemeMode(val) { currentThemeMode = val; }
export function setShowHeaderDarkModeToggle(val) { showHeaderDarkModeToggle = val; }
export function setToggleState1(val) { toggleState1 = val; }
export function setToggleState2(val) { toggleState2 = val; }

export function updateHeaderToggleButtonText() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;
    
    let targetState = toggleState2;
    if (currentThemeMode === toggleState2) {
        targetState = toggleState1;
    } else if (currentThemeMode !== toggleState1 && currentThemeMode !== toggleState2) {
        targetState = toggleState1;
    }

    themeToggleBtn.innerText = modeLabels[targetState] || 'Toggle Mode';
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
        if (currentThemeMode === 'custom') {
            customThemeOptions.style.opacity = '1';
            customThemeOptions.style.pointerEvents = 'auto';
        } else {
            customThemeOptions.style.opacity = '0.5';
            customThemeOptions.style.pointerEvents = 'none';
        }
    }

    if (currentThemeMode === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (currentThemeMode === 'custom') {
        for (const [id, variable] of Object.entries(CUSTOM_COLOR_MAP)) {
            const el = document.getElementById(id);
            if (el) {
                document.documentElement.style.setProperty(variable, el.value);
                themeData.colors[variable] = el.value;
            }
        }
        const h1 = document.getElementById('custom-h1-color');
        if (h1) {
            document.documentElement.style.setProperty('--heading-color', h1.value);
            themeData.colors['--heading-color'] = h1.value;
        }
        const bg2 = document.getElementById('custom-bg2-color');
        if (bg2) {
            document.documentElement.style.setProperty('--modal-bg', bg2.value);
            themeData.colors['--modal-bg'] = bg2.value;
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
