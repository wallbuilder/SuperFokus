import { store } from '../../utils/storage.js';
import { 
    DEFAULT_CUSTOM_COLORS, 
    CUSTOM_COLOR_MAP
} from './theme-config.js';
import { 
    currentThemeMode,
    setCurrentThemeMode,
    showHeaderDarkModeToggle,
    setShowHeaderDarkModeToggle,
    isCustomThemeSaved,
    setIsCustomThemeSaved,
    getNextThemeMode,
    setActiveCustomColors,
    applyTheme, 
    applyHeaderToggleVisibility, 
    setThemeMode,
    updateHeaderToggleButtonText
} from './theme-engine.js';

let pendingThemeMode = 'light';
let pendingShowHeaderToggle = true;
let pendingColors = {};

export async function initTheme() {
    try {
        const mode = await store.get('themeMode', 'light');
        const customSaved = await store.get('customThemeSaved', false);
        setIsCustomThemeSaved(customSaved);
        
        if (!document.getElementById('modal-theme-style')) {
            const style = document.createElement('style');
            style.id = 'modal-theme-style';
            style.textContent = `
                .modal-overlay > div, .modal-container {
                    background-color: var(--bg-grad-1) !important;
                }
                .modal-content {
                    background-color: var(--container-bg) !important;
                }
                .bubble, .white-bubble, .modal-bubble, input[type="radio"], input[type="checkbox"] {
                    background-color: var(--container-bg) !important;
                }
            `;
            document.head.appendChild(style);
        }

        setCurrentThemeMode(mode);
        pendingThemeMode = mode;
        const showToggle = await store.get('showHeaderDarkModeToggle', true);
        setShowHeaderDarkModeToggle(showToggle);
        pendingShowHeaderToggle = showToggle;

        const themeRadioLight = document.getElementById('theme-radio-light');
        const themeRadioDark = document.getElementById('theme-radio-dark');
        const themeRadioCustom = document.getElementById('theme-radio-custom');

        if (themeRadioLight && mode === 'light') themeRadioLight.checked = true;
        if (themeRadioDark && mode === 'dark') themeRadioDark.checked = true;
        if (themeRadioCustom && mode === 'custom') themeRadioCustom.checked = true;

        const activeColors = {};
        for (const id of Object.keys(CUSTOM_COLOR_MAP)) {
            const el = document.getElementById(id);
            const savedValue = await store.get(id, DEFAULT_CUSTOM_COLORS[id]);
            pendingColors[id] = savedValue;
            activeColors[id] = savedValue;
            if (el) {
                el.value = savedValue;
            }
        }
        setActiveCustomColors(activeColors);

        const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
        if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = showToggle;
        
        setupListeners();
        updateCustomThemeOptionsVisibility(mode);
        applyTheme();
        applyHeaderToggleVisibility();
    } catch (error) {
        console.error('Error initializing theme:', error);
        applyTheme();
        applyHeaderToggleVisibility();
    }
}

function updateCustomThemeOptionsVisibility(mode) {
    const customThemeOptions = document.getElementById('custom-theme-options');
    if (customThemeOptions) {
        if (mode === 'custom') {
            customThemeOptions.style.opacity = '1';
            customThemeOptions.style.pointerEvents = 'auto';
        } else {
            customThemeOptions.style.opacity = '0.5';
            customThemeOptions.style.pointerEvents = 'none';
        }
    }
}

function setupListeners() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const next = getNextThemeMode();
            setThemeMode(next);
            pendingThemeMode = next;
            updateCustomThemeOptionsVisibility(next);
        });
    }

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCustom = document.getElementById('theme-radio-custom');

    if (themeRadioLight) themeRadioLight.addEventListener('change', () => { pendingThemeMode = 'light'; updateCustomThemeOptionsVisibility('light'); });
    if (themeRadioDark) themeRadioDark.addEventListener('change', () => { pendingThemeMode = 'dark'; updateCustomThemeOptionsVisibility('dark'); });
    if (themeRadioCustom) themeRadioCustom.addEventListener('change', () => { pendingThemeMode = 'custom'; updateCustomThemeOptionsVisibility('custom'); });

    const colorPickers = Object.keys(CUSTOM_COLOR_MAP).map(id => document.getElementById(id));
    colorPickers.forEach(picker => {
        if (!picker) return;
        picker.addEventListener('input', (e) => {
            pendingColors[e.target.id] = e.target.value;
        });
        picker.addEventListener('change', (e) => {
            pendingColors[e.target.id] = e.target.value;
        });
    });

    const resetThemeColorsBtn = document.getElementById('reset-theme-colors-btn');
    if (resetThemeColorsBtn) {
        resetThemeColorsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to revert back to the default custom colors?')) {
                for (const id of Object.keys(DEFAULT_CUSTOM_COLORS)) {
                    pendingColors[id] = DEFAULT_CUSTOM_COLORS[id];
                    const el = document.getElementById(id);
                    if (el) el.value = DEFAULT_CUSTOM_COLORS[id];
                }
            }
        });
    }

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) {
        toggleHeaderDarkModeSwitch.addEventListener('change', (e) => {
            pendingShowHeaderToggle = e.target.checked;
        });
    }

    const saveThemeSettingsBtn = document.getElementById('save-theme-settings-btn');
    if (saveThemeSettingsBtn) {
        saveThemeSettingsBtn.addEventListener('click', () => {
            setShowHeaderDarkModeToggle(pendingShowHeaderToggle);
            
            try {
                store.set('showHeaderDarkModeToggle', showHeaderDarkModeToggle);
                
                // Save custom colors
                const activeColors = {};
                for (const [id, value] of Object.entries(pendingColors)) {
                    store.set(id, value);
                    const el = document.getElementById(id);
                    if (el) el.value = value;
                    activeColors[id] = value;
                }
                setActiveCustomColors(activeColors);

                if (pendingThemeMode === 'custom') {
                    setIsCustomThemeSaved(true);
                    store.set('customThemeSaved', true);
                }

                setThemeMode(pendingThemeMode);
                applyHeaderToggleVisibility();

                const oldText = saveThemeSettingsBtn.innerText;
                saveThemeSettingsBtn.innerText = 'Saved!';
                setTimeout(() => { saveThemeSettingsBtn.innerText = oldText; }, 1500);
            } catch (error) {
                console.error('Error saving theme settings:', error);
                alert('Failed to save theme settings.');
            }
        });
    }
}
