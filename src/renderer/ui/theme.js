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

// Custom Theme Colors
const customMainColor = document.getElementById('custom-main-color');
const customAccentColor = document.getElementById('custom-accent-color');
const customHeaderTitleColor = document.getElementById('custom-header-title-color');
const customH1Color = document.getElementById('custom-h1-color');
const customH2Color = document.getElementById('custom-h2-color');
const customH3Color = document.getElementById('custom-h3-color');
const customTextColor = document.getElementById('custom-text-color');
const customBg1Color = document.getElementById('custom-bg1-color');
const customBg1GradColor = document.getElementById('custom-bg1-grad-color');
const customBg2Color = document.getElementById('custom-bg2-color');
const customDrawerBg = document.getElementById('custom-drawer-bg');
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

let currentThemeMode = 'light'; // 'light', 'dark', or 'custom'
let showHeaderDarkModeToggle = true;

let toggleState1 = 'light';
let toggleState2 = 'dark';

// Pending states for toggle settings (before hitting save)
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
    currentThemeMode = await store.get('themeMode', 'light');
    showHeaderDarkModeToggle = await store.get('showHeaderDarkModeToggle', true);
    toggleState1 = await store.get('toggleState1', 'light');
    toggleState2 = await store.get('toggleState2', 'dark');
    
    pendingToggleState1 = toggleState1;
    pendingToggleState2 = toggleState2;
    pendingShowHeaderToggle = showHeaderDarkModeToggle;

    // Set initial radio state
    if (themeRadioLight && currentThemeMode === 'light') themeRadioLight.checked = true;
    if (themeRadioDark && currentThemeMode === 'dark') themeRadioDark.checked = true;
    if (themeRadioCustom && currentThemeMode === 'custom') themeRadioCustom.checked = true;

    const savedMain = await store.get('customMainColor', null);
    const savedAccent = await store.get('customAccentColor', null);
    const savedHeaderTitle = await store.get('customHeaderTitleColor', null);
    const savedH1 = await store.get('customH1Color', null);
    const savedH2 = await store.get('customH2Color', null);
    const savedH3 = await store.get('customH3Color', null);
    const savedText = await store.get('customTextColor', null);
    const savedBg1 = await store.get('customBg1Color', null);
    const savedBg1Grad = await store.get('customBg1GradColor', null);
    const savedBg2 = await store.get('customBg2Color', null);
    const savedDrawerBg = await store.get('customDrawerBg', null);

    if (savedMain && customMainColor) customMainColor.value = savedMain;
    if (savedAccent && customAccentColor) customAccentColor.value = savedAccent;
    if (savedHeaderTitle && customHeaderTitleColor) customHeaderTitleColor.value = savedHeaderTitle;
    if (savedH1 && customH1Color) customH1Color.value = savedH1;
    if (savedH2 && customH2Color) customH2Color.value = savedH2;
    if (savedH3 && customH3Color) customH3Color.value = savedH3;
    if (savedText && customTextColor) customTextColor.value = savedText;
    if (savedBg1 && customBg1Color) customBg1Color.value = savedBg1;
    if (savedBg1Grad && customBg1GradColor) customBg1GradColor.value = savedBg1Grad;
    if (savedBg2 && customBg2Color) customBg2Color.value = savedBg2;
    if (savedDrawerBg && customDrawerBg) customDrawerBg.value = savedDrawerBg;
    if (toggleSelect1) toggleSelect1.value = toggleState1;
    if (toggleSelect2) toggleSelect2.value = toggleState2;
    if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = showHeaderDarkModeToggle;
    
    if (toggleOption1Btn) toggleOption1Btn.innerText = modeNames[toggleState1];
    if (toggleOption2Btn) toggleOption2Btn.innerText = modeNames[toggleState2];

    applyTheme();
    applyHeaderToggleVisibility();
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
    const savedMain = customMainColor ? customMainColor.value : '#6a11cb';
    const savedAccent = customAccentColor ? customAccentColor.value : '#2575fc';
    const savedHeaderTitle = customHeaderTitleColor ? customHeaderTitleColor.value : '#ffffff';
    const savedH1 = customH1Color ? customH1Color.value : '#2c3e50';
    const savedH2 = customH2Color ? customH2Color.value : '#2c3e50';
    const savedH3 = customH3Color ? customH3Color.value : '#2c3e50';
    const savedText = customTextColor ? customTextColor.value : '#4a4a4a';
    const savedBg1 = customBg1Color ? customBg1Color.value : '#f5f7fa';
    const savedBg1Grad = customBg1GradColor ? customBg1GradColor.value : '#c3cfe2';
    const savedBg2 = customBg2Color ? customBg2Color.value : '#ffffff';
    const savedDrawerBg = customDrawerBg ? customDrawerBg.value : '#ffffff';

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
    document.body.classList.remove('dark-mode');

    // UI state for Custom section
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
        ipcRenderer.send('theme-changed', true);
    } else if (currentThemeMode === 'light') {
        ipcRenderer.send('theme-changed', false);
    } else if (currentThemeMode === 'custom') {
        document.documentElement.style.setProperty('--header-grad-1', savedMain);
        document.documentElement.style.setProperty('--header-grad-2', savedAccent);
        document.documentElement.style.setProperty('--header-title-color', savedHeaderTitle);
        document.documentElement.style.setProperty('--h1-color', savedH1);
        document.documentElement.style.setProperty('--h2-color', savedH2);
        document.documentElement.style.setProperty('--h3-color', savedH3);
        document.documentElement.style.setProperty('--text-color', savedText);
        document.documentElement.style.setProperty('--bg-grad-1', savedBg1);
        document.documentElement.style.setProperty('--bg-grad-2', savedBg1Grad);
        document.documentElement.style.setProperty('--container-bg', savedBg2);
        document.documentElement.style.setProperty('--drawer-bg', savedDrawerBg);
        ipcRenderer.send('theme-changed', false);
    }

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
    
    if (mode === 'dark' || mode === 'light') {
         store.set('darkMode', mode === 'dark'); 
    }

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


// Custom Theme Pickers
const applyColorChange = () => { if (currentThemeMode === 'custom') applyTheme(); };

if (customMainColor) customMainColor.addEventListener('input', (e) => { store.set('customMainColor', e.target.value); applyColorChange(); });
if (customAccentColor) customAccentColor.addEventListener('input', (e) => { store.set('customAccentColor', e.target.value); applyColorChange(); });
if (customHeaderTitleColor) customHeaderTitleColor.addEventListener('input', (e) => { store.set('customHeaderTitleColor', e.target.value); applyColorChange(); });
if (customH1Color) customH1Color.addEventListener('input', (e) => { store.set('customH1Color', e.target.value); applyColorChange(); });
if (customH2Color) customH2Color.addEventListener('input', (e) => { store.set('customH2Color', e.target.value); applyColorChange(); });
if (customH3Color) customH3Color.addEventListener('input', (e) => { store.set('customH3Color', e.target.value); applyColorChange(); });
if (customTextColor) customTextColor.addEventListener('input', (e) => { store.set('customTextColor', e.target.value); applyColorChange(); });
if (customBg1Color) customBg1Color.addEventListener('input', (e) => { store.set('customBg1Color', e.target.value); applyColorChange(); });
if (customBg1GradColor) customBg1GradColor.addEventListener('input', (e) => { store.set('customBg1GradColor', e.target.value); applyColorChange(); });
if (customBg2Color) customBg2Color.addEventListener('input', (e) => { store.set('customBg2Color', e.target.value); applyColorChange(); });
if (customDrawerBg) customDrawerBg.addEventListener('input', (e) => { store.set('customDrawerBg', e.target.value); applyColorChange(); });

if (resetThemeColorsBtn) {
    resetThemeColorsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to revert back to the default custom colors?')) {
            store.delete('customMainColor');
            store.delete('customAccentColor');
            store.delete('customHeaderTitleColor');
            store.delete('customH1Color');
            store.delete('customH2Color');
            store.delete('customH3Color');
            store.delete('customTextColor');
            store.delete('customBg1Color');
            store.delete('customBg1GradColor');
            store.delete('customBg2Color');
            store.delete('customDrawerBg');

            if (customMainColor) customMainColor.value = '#6a11cb';
            if (customAccentColor) customAccentColor.value = '#2575fc';
            if (customHeaderTitleColor) customHeaderTitleColor.value = '#ffffff';
            if (customH1Color) customH1Color.value = '#2c3e50';
            if (customH2Color) customH2Color.value = '#2c3e50';
            if (customH3Color) customH3Color.value = '#2c3e50';
            if (customTextColor) customTextColor.value = '#4a4a4a';
            if (customBg1Color) customBg1Color.value = '#f5f7fa';
            if (customBg1GradColor) customBg1GradColor.value = '#c3cfe2';
            if (customBg2Color) customBg2Color.value = '#ffffff';
            if (customDrawerBg) customDrawerBg.value = '#ffffff';
            applyColorChange();
        }
    });
}

// Toggle Settings Logic (Pending Changes)
if (toggleHeaderDarkModeSwitch) {
    toggleHeaderDarkModeSwitch.addEventListener('change', (e) => {
        pendingShowHeaderToggle = e.target.checked;
    });
}

// Dropdown Logic for Option 1
if (toggleOption1Btn && dropdownOption1) {
    toggleOption1Btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownOption1.style.display = dropdownOption1.style.display === 'block' ? 'none' : 'block';
        if (dropdownOption2) dropdownOption2.style.display = 'none'; // Close other
    });

    if (closeDropdown1Btn) {
        closeDropdown1Btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownOption1.style.display = 'none';
        });
    }

    if (toggleSelect1) {
        toggleSelect1.addEventListener('change', (e) => {
            pendingToggleState1 = e.target.value;
            toggleOption1Btn.innerText = modeNames[pendingToggleState1];
        });
    }
}

// Dropdown Logic for Option 2
if (toggleOption2Btn && dropdownOption2) {
    toggleOption2Btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownOption2.style.display = dropdownOption2.style.display === 'block' ? 'none' : 'block';
        if (dropdownOption1) dropdownOption1.style.display = 'none'; // Close other
    });

    if (closeDropdown2Btn) {
        closeDropdown2Btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownOption2.style.display = 'none';
        });
    }

    if (toggleSelect2) {
        toggleSelect2.addEventListener('change', (e) => {
            pendingToggleState2 = e.target.value;
            toggleOption2Btn.innerText = modeNames[pendingToggleState2];
        });
    }
}

// Save Toggle Settings
if (saveToggleSettingsBtn) {
    saveToggleSettingsBtn.addEventListener('click', () => {
        toggleState1 = pendingToggleState1;
        toggleState2 = pendingToggleState2;
        showHeaderDarkModeToggle = pendingShowHeaderToggle;
        
        store.set('toggleState1', toggleState1);
        store.set('toggleState2', toggleState2);
        store.set('showHeaderDarkModeToggle', showHeaderDarkModeToggle);
        
        updateHeaderToggleButtonText();
        applyHeaderToggleVisibility();

        const oldText = saveToggleSettingsBtn.innerText;
        saveToggleSettingsBtn.innerText = 'Saved!';
        setTimeout(() => { saveToggleSettingsBtn.innerText = oldText; }, 1500);
    });
}

// Close when clicking outside
document.addEventListener('click', (e) => {
    if (dropdownOption1 && dropdownOption1.style.display === 'block' && !toggleOption1Btn.contains(e.target) && !dropdownOption1.contains(e.target)) {
        dropdownOption1.style.display = 'none';
    }
    if (dropdownOption2 && dropdownOption2.style.display === 'block' && !toggleOption2Btn.contains(e.target) && !dropdownOption2.contains(e.target)) {
        dropdownOption2.style.display = 'none';
    }
});

export { applyTheme, applyHeaderToggleVisibility };