import { ipcRenderer } from '../utils/ipc.js';
import { store } from '../utils/storage.js';

// --- Theme & Setup ---
const themeToggleBtn = document.getElementById('theme-toggle'); // Header toggle
const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');

// Modal Elements
const themeRadioLight = document.getElementById('theme-radio-light');
const themeRadioDark = document.getElementById('theme-radio-dark');
const themeRadioCustom = document.getElementById('theme-radio-custom');
const customThemeOptions = document.getElementById('custom-theme-options');

// Default custom colors
const DEFAULT_CUSTOM_COLORS = {
    'custom-main-color': '#6a11cb',
    'custom-accent-color': '#2575fc',
    'custom-header-title-color': '#ffffff',
    'custom-h1-color': '#2c3e50',
    'custom-h2-color': '#2c3e50',
    'custom-h3-color': '#2c3e50',
    'custom-text-color': '#4a4a4a',
    'custom-bg1-color': '#f5f7fa',
    'custom-bg1-grad-color': '#c3cfe2',
    'custom-bg2-color': '#ffffff',
    'custom-drawer-bg': '#ffffff'
};

// Mapping for CSS variables
const CUSTOM_COLOR_MAP = {
    'custom-main-color': '--header-grad-1',
    'custom-accent-color': '--header-grad-2',
    'custom-header-title-color': '--header-title-color',
    'custom-h1-color': '--h1-color',
    'custom-h2-color': '--h2-color',
    'custom-h3-color': '--h3-color',
    'custom-text-color': '--text-color',
    'custom-bg1-color': '--bg-grad-1',
    'custom-bg1-grad-color': '--bg-grad-2',
    'custom-bg2-color': '--container-bg',
    'custom-drawer-bg': '--drawer-bg'
};

const colorPickers = Object.keys(CUSTOM_COLOR_MAP).map(id => document.getElementById(id));
const resetThemeColorsBtn = document.getElementById('reset-theme-colors-btn');

// Settings Dropdown Elements
const toggleOption1Btn = document.getElementById('toggle-option-1');
const dropdownOption1 = document.getElementById('dropdown-option-1');
const closeDropdown1Btn = document.getElementById('close-dropdown-1');
const toggleSelect1 = document.getElementById('toggle-select-1');

const toggleOption2Btn = document.getElementById('toggle-option-2');
const dropdownOption2 = document.getElementById('dropdown-option-2');
const closeDropdown2Btn = document.getElementById('close-dropdown-2');
const toggleSelect2 = document.getElementById('toggle-select-2');

const saveToggleSettingsBtn = document.getElementById('save-toggle-settings-btn');

let currentThemeMode = 'light'; 
let showHeaderDarkModeToggle = true;

let toggleState1 = 'light';
let toggleState2 = 'dark';

let pendingToggleState1 = 'light';
let pendingToggleState2 = 'dark';
let pendingShowHeaderToggle = true;

const modeLabels = {
    'light': '☀️ Light Mode',
    'dark': '🌙 Dark Mode',
    'custom': '🖌️ Custom Theme'
};

const modeNames = {
    'light': 'Light Mode',
    'dark': 'Dark Mode',
    'custom': 'Custom Theme'
};

export async function initTheme() {
    try {
        currentThemeMode = await store.get('themeMode', 'light');
        showHeaderDarkModeToggle = await store.get('showHeaderDarkModeToggle', true);
        toggleState1 = await store.get('toggleState1', 'light');
        toggleState2 = await store.get('toggleState2', 'dark');
        
        pendingToggleState1 = toggleState1;
        pendingToggleState2 = toggleState2;
        pendingShowHeaderToggle = showHeaderDarkModeToggle;

        if (themeRadioLight && currentThemeMode === 'light') themeRadioLight.checked = true;
        if (themeRadioDark && currentThemeMode === 'dark') themeRadioDark.checked = true;
        if (themeRadioCustom && currentThemeMode === 'custom') themeRadioCustom.checked = true;

        // Load custom colors
        for (const id of Object.keys(CUSTOM_COLOR_MAP)) {
            const el = document.getElementById(id);
            if (el) {
                const savedValue = await store.get(id, DEFAULT_CUSTOM_COLORS[id]);
                el.value = savedValue;
            }
        }

        if (toggleSelect1) toggleSelect1.value = toggleState1;
        if (toggleSelect2) toggleSelect2.value = toggleState2;
        if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = showHeaderDarkModeToggle;
        
        if (toggleOption1Btn) toggleOption1Btn.innerText = modeNames[toggleState1];
        if (toggleOption2Btn) toggleOption2Btn.innerText = modeNames[toggleState2];

        applyTheme();
        applyHeaderToggleVisibility();
    } catch (error) {
        console.error('Error initializing theme:', error);
        applyTheme();
        applyHeaderToggleVisibility();
    }
}

function updateHeaderToggleButtonText() {
    if (!themeToggleBtn) return;
    
    let targetState = toggleState2;
    if (currentThemeMode === toggleState2) {
        targetState = toggleState1;
    } else if (currentThemeMode !== toggleState1 && currentThemeMode !== toggleState2) {
        targetState = toggleState1;
    }

    themeToggleBtn.innerText = modeLabels[targetState] || 'Toggle Mode';
}

function applyTheme() {
    // Reset standard styles
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
    document.body.classList.remove('dark-mode');

    const themeData = {
        mode: currentThemeMode,
        isDark: currentThemeMode === 'dark',
        colors: {}
    };

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
        // Sync generic heading color from H1 for better coverage
        const h1 = document.getElementById('custom-h1-color');
        if (h1) {
            document.documentElement.style.setProperty('--heading-color', h1.value);
            themeData.colors['--heading-color'] = h1.value;
        }
    }

    ipcRenderer.send('theme-changed', themeData);
    updateHeaderToggleButtonText();
}

function applyHeaderToggleVisibility() {
    if (themeToggleBtn) {
        themeToggleBtn.style.display = showHeaderDarkModeToggle ? 'block' : 'none';
    }
}

function setThemeMode(mode) {
    currentThemeMode = mode;
    store.set('themeMode', currentThemeMode);
    
    if (themeRadioLight) themeRadioLight.checked = (mode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (mode === 'dark');
    if (themeRadioCustom) themeRadioCustom.checked = (mode === 'custom');

    applyTheme();
}

// Header Toggle (Quick Switch)
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        let targetState = toggleState2;
        if (currentThemeMode === toggleState2) {
            targetState = toggleState1;
        } else if (currentThemeMode !== toggleState1 && currentThemeMode !== toggleState2) {
            targetState = toggleState1;
        }
        setThemeMode(targetState);
    });
}

// Modal Radio Buttons
if (themeRadioLight) themeRadioLight.addEventListener('change', () => setThemeMode('light'));
if (themeRadioDark) themeRadioDark.addEventListener('change', () => setThemeMode('dark'));
if (themeRadioCustom) themeRadioCustom.addEventListener('change', () => setThemeMode('custom'));

// Custom Theme Pickers logic
colorPickers.forEach(picker => {
    if (!picker) return;
    
    // Live preview on input (no store save for performance)
    picker.addEventListener('input', () => {
        if (currentThemeMode === 'custom') {
            applyTheme();
        }
    });

    // Save to store only when user finishes dragging/picking
    picker.addEventListener('change', (e) => {
        store.set(e.target.id, e.target.value);
    });
});

if (resetThemeColorsBtn) {
    resetThemeColorsBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to revert back to the default custom colors?')) {
            try {
                for (const id of Object.keys(DEFAULT_CUSTOM_COLORS)) {
                    store.delete(id);
                    const el = document.getElementById(id);
                    if (el) el.value = DEFAULT_CUSTOM_COLORS[id];
                }
                if (currentThemeMode === 'custom') applyTheme();
            } catch (error) {
                console.error('Error resetting custom theme colors:', error);
            }
        }
    });
}

// Toggle Settings Logic
if (toggleHeaderDarkModeSwitch) {
    toggleHeaderDarkModeSwitch.addEventListener('change', (e) => {
        pendingShowHeaderToggle = e.target.checked;
    });
}

const setupDropdown = (btn, dropdown, closeBtn, select, pendingStateKey) => {
    if (!btn || !dropdown) return;
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        // Close other dropdowns
        document.querySelectorAll('.dropdown-option').forEach(d => {
            if (d !== dropdown) d.classList.remove('active');
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.remove('active');
        });
    }

    if (select) {
        select.addEventListener('change', (e) => {
            if (pendingStateKey === 1) pendingToggleState1 = e.target.value;
            else pendingToggleState2 = e.target.value;
            btn.innerText = modeNames[e.target.value];
        });
    }
};

setupDropdown(toggleOption1Btn, dropdownOption1, closeDropdown1Btn, toggleSelect1, 1);
setupDropdown(toggleOption2Btn, dropdownOption2, closeDropdown2Btn, toggleSelect2, 2);

if (saveToggleSettingsBtn) {
    saveToggleSettingsBtn.addEventListener('click', async () => {
        toggleState1 = pendingToggleState1;
        toggleState2 = pendingToggleState2;
        showHeaderDarkModeToggle = pendingShowHeaderToggle;
        
        try {
            store.set('toggleState1', toggleState1);
            store.set('toggleState2', toggleState2);
            store.set('showHeaderDarkModeToggle', showHeaderDarkModeToggle);
            
            updateHeaderToggleButtonText();
            applyHeaderToggleVisibility();

            const oldText = saveToggleSettingsBtn.innerText;
            saveToggleSettingsBtn.innerText = 'Saved!';
            setTimeout(() => { saveToggleSettingsBtn.innerText = oldText; }, 1500);
        } catch (error) {
            console.error('Error saving toggle settings:', error);
            alert('Failed to save toggle settings.');
        }
    });
}

document.addEventListener('click', (e) => {
    if (dropdownOption1 && dropdownOption1.classList.contains('active') && !toggleOption1Btn.contains(e.target) && !dropdownOption1.contains(e.target)) {
        dropdownOption1.classList.remove('active');
    }
    if (dropdownOption2 && dropdownOption2.classList.contains('active') && !toggleOption2Btn.contains(e.target) && !dropdownOption2.contains(e.target)) {
        dropdownOption2.classList.remove('active');
    }
});

export { applyTheme, applyHeaderToggleVisibility };