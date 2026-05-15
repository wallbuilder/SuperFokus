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

// Ensure elements exist before adding listeners or manipulating them globally
if (themeToggleBtn) { /* existing event listener below will be covered */ }
if (toggleHeaderDarkModeSwitch) { /* existing event listener below will be covered */ }
if (themeRadioLight) { /* existing event listener below will be covered */ }
if (themeRadioDark) { /* existing event listener below will be covered */ }
if (themeRadioCustom) { /* existing event listener below will be covered */ }
if (customThemeOptions) { /* handled in applyTheme */ }

// Default custom colors for reset and initial state
const DEFAULT_CUSTOM_COLORS = {
    main: '#6a11cb',
    accent: '#2575fc',
    headerTitle: '#ffffff',
    h1: '#2c3e50',
    h2: '#2c3e50',
    h3: '#2c3e50',
    text: '#4a4a4a',
    bg1: '#f5f7fa',
    bg1Grad: '#c3cfe2',
    bg2: '#ffffff',
    drawerBg: '#ffffff'
};
const customMainColor = document.getElementById('custom-main-color'); if (!customMainColor) console.warn('Missing customMainColor element');
const customAccentColor = document.getElementById('custom-accent-color'); if (!customAccentColor) console.warn('Missing customAccentColor element');
const customHeaderTitleColor = document.getElementById('custom-header-title-color'); if (!customHeaderTitleColor) console.warn('Missing customHeaderTitleColor element');
const customH1Color = document.getElementById('custom-h1-color'); if (!customH1Color) console.warn('Missing customH1Color element');
const customH2Color = document.getElementById('custom-h2-color'); if (!customH2Color) console.warn('Missing customH2Color element');
const customH3Color = document.getElementById('custom-h3-color'); if (!customH3Color) console.warn('Missing customH3Color element');
const customTextColor = document.getElementById('custom-text-color'); if (!customTextColor) console.warn('Missing customTextColor element');
const customBg1Color = document.getElementById('custom-bg1-color'); if (!customBg1Color) console.warn('Missing customBg1Color element');
const customBg1GradColor = document.getElementById('custom-bg1-grad-color'); if (!customBg1GradColor) console.warn('Missing customBg1GradColor element');
const customBg2Color = document.getElementById('custom-bg2-color'); if (!customBg2Color) console.warn('Missing customBg2Color element');
const customDrawerBg = document.getElementById('custom-drawer-bg'); if (!customDrawerBg) console.warn('Missing customDrawerBg element');
const resetThemeColorsBtn = document.getElementById('reset-theme-colors-btn'); if (!resetThemeColorsBtn) console.warn('Missing resetThemeColorsBtn element');

// Settings Dropdown Elements
const toggleOption1Btn = document.getElementById('toggle-option-1'); if (!toggleOption1Btn) console.warn('Missing toggleOption1Btn element');
const dropdownOption1 = document.getElementById('dropdown-option-1'); if (!dropdownOption1) console.warn('Missing dropdownOption1 element');
const closeDropdown1Btn = document.getElementById('close-dropdown-1'); if (!closeDropdown1Btn) console.warn('Missing closeDropdown1Btn element');
const toggleSelect1 = document.getElementById('toggle-select-1'); if (!toggleSelect1) console.warn('Missing toggleSelect1 element');

const toggleOption2Btn = document.getElementById('toggle-option-2'); if (!toggleOption2Btn) console.warn('Missing toggleOption2Btn element');
const dropdownOption2 = document.getElementById('dropdown-option-2'); if (!dropdownOption2) console.warn('Missing dropdownOption2 element');
const closeDropdown2Btn = document.getElementById('close-dropdown-2'); if (!closeDropdown2Btn) console.warn('Missing closeDropdown2Btn element');
const toggleSelect2 = document.getElementById('toggle-select-2'); if (!toggleSelect2) console.warn('Missing toggleSelect2 element');

const saveToggleSettingsBtn = document.getElementById('save-toggle-settings-btn'); if (!saveToggleSettingsBtn) console.warn('Missing saveToggleSettingsBtn element');

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
    try {
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

        if (savedMain && customMainColor) customMainColor.value = savedMain; else if (customMainColor) customMainColor.value = DEFAULT_CUSTOM_COLORS.main;
        if (savedAccent && customAccentColor) customAccentColor.value = savedAccent; else if (customAccentColor) customAccentColor.value = DEFAULT_CUSTOM_COLORS.accent;
        if (savedHeaderTitle && customHeaderTitleColor) customHeaderTitleColor.value = savedHeaderTitle; else if (customHeaderTitleColor) customHeaderTitleColor.value = DEFAULT_CUSTOM_COLORS.headerTitle;
        if (savedH1 && customH1Color) customH1Color.value = savedH1; else if (customH1Color) customH1Color.value = DEFAULT_CUSTOM_COLORS.h1;
        if (savedH2 && customH2Color) customH2Color.value = savedH2; else if (customH2Color) customH2Color.value = DEFAULT_CUSTOM_COLORS.h2;
        if (savedH3 && customH3Color) customH3Color.value = savedH3; else if (customH3Color) customH3Color.value = DEFAULT_CUSTOM_COLORS.h3;
        if (savedText && customTextColor) customTextColor.value = savedText; else if (customTextColor) customTextColor.value = DEFAULT_CUSTOM_COLORS.text;
        if (savedBg1 && customBg1Color) customBg1Color.value = savedBg1; else if (customBg1Color) customBg1Color.value = DEFAULT_CUSTOM_COLORS.bg1;
        if (savedBg1Grad && customBg1GradColor) customBg1GradColor.value = savedBg1Grad; else if (customBg1GradColor) customBg1GradColor.value = DEFAULT_CUSTOM_COLORS.bg1Grad;
        if (savedBg2 && customBg2Color) customBg2Color.value = savedBg2; else if (customBg2Color) customBg2Color.value = DEFAULT_CUSTOM_COLORS.bg2;
        if (savedDrawerBg && customDrawerBg) customDrawerBg.value = savedDrawerBg; else if (customDrawerBg) customDrawerBg.value = DEFAULT_CUSTOM_COLORS.drawerBg;
        if (toggleSelect1) toggleSelect1.value = toggleState1;
        if (toggleSelect2) toggleSelect2.value = toggleState2;
        if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = showHeaderDarkModeToggle;
        
        if (toggleOption1Btn) toggleOption1Btn.innerText = modeNames[toggleState1];
        if (toggleOption2Btn) toggleOption2Btn.innerText = modeNames[toggleState2];

        applyTheme();
        applyHeaderToggleVisibility();
    } catch (error) {
        console.error('Error initializing theme:', error);
        // Fallback to default theme if store operations fail
        currentThemeMode = 'light';
        showHeaderDarkModeToggle = true;
        toggleState1 = 'light';
        toggleState2 = 'dark';
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
    const savedMain = customMainColor ? customMainColor.value : DEFAULT_CUSTOM_COLORS.main;
    const savedAccent = customAccentColor ? customAccentColor.value : DEFAULT_CUSTOM_COLORS.accent;
    const savedHeaderTitle = customHeaderTitleColor ? customHeaderTitleColor.value : DEFAULT_CUSTOM_COLORS.headerTitle;
    const savedH1 = customH1Color ? customH1Color.value : DEFAULT_CUSTOM_COLORS.h1;
    const savedH2 = customH2Color ? customH2Color.value : DEFAULT_CUSTOM_COLORS.h2;
    const savedH3 = customH3Color ? customH3Color.value : DEFAULT_CUSTOM_COLORS.h3;
    const savedText = customTextColor ? customTextColor.value : DEFAULT_CUSTOM_COLORS.text;
    const savedBg1 = customBg1Color ? customBg1Color.value : DEFAULT_CUSTOM_COLORS.bg1;
    const savedBg1Grad = customBg1GradColor ? customBg1GradColor.value : DEFAULT_CUSTOM_COLORS.bg1Grad;
    const savedBg2 = customBg2Color ? customBg2Color.value : DEFAULT_CUSTOM_COLORS.bg2;
    const savedDrawerBg = customDrawerBg ? customDrawerBg.value : DEFAULT_CUSTOM_COLORS.drawerBg;

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
    try {
        store.set('themeMode', currentThemeMode);
    } catch (error) {
        console.error('Error saving themeMode:', error);
    }
    
    // The `darkMode` key seems redundant as `themeMode` already stores 'light', 'dark', or 'custom'.
    // If `darkMode` is used elsewhere for a distinct purpose, this change may need to be revisited.
    // if (mode === 'dark' || mode === 'light') {
    //      store.set('darkMode', mode === 'dark'); 
    // }

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

if (customMainColor) customMainColor.addEventListener('input', async (e) => { try { await store.set('customMainColor', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customMainColor:', error); } });
if (customAccentColor) customAccentColor.addEventListener('input', async (e) => { try { await store.set('customAccentColor', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customAccentColor:', error); } });
if (customHeaderTitleColor) customHeaderTitleColor.addEventListener('input', async (e) => { try { await store.set('customHeaderTitleColor', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customHeaderTitleColor:', error); } });
if (customH1Color) customH1Color.addEventListener('input', async (e) => { try { await store.set('customH1Color', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customH1Color:', error); } });
if (customH2Color) customH2Color.addEventListener('input', async (e) => { try { await store.set('customH2Color', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customH2Color:', error); } });
if (customH3Color) customH3Color.addEventListener('input', async (e) => { try { await store.set('customH3Color', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customH3Color:', error); } });
if (customTextColor) customTextColor.addEventListener('input', async (e) => { try { await store.set('customTextColor', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customTextColor:', error); } });
if (customBg1Color) customBg1Color.addEventListener('input', async (e) => { try { await store.set('customBg1Color', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customBg1Color:', error); } });
if (customBg1GradColor) customBg1GradColor.addEventListener('input', async (e) => { try { await store.set('customBg1GradColor', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customBg1GradColor:', error); } });
if (customBg2Color) customBg2Color.addEventListener('input', async (e) => { try { await store.set('customBg2Color', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customBg2Color:', error); } });
if (customDrawerBg) customDrawerBg.addEventListener('input', async (e) => { try { await store.set('customDrawerBg', e.target.value); applyColorChange(); } catch (error) { console.error('Error saving customDrawerBg:', error); } });

if (resetThemeColorsBtn) {
    resetThemeColorsBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to revert back to the default custom colors?')) {
            try {
                await store.delete('customMainColor');
                await store.delete('customAccentColor');
                await store.delete('customHeaderTitleColor');
                await store.delete('customH1Color');
                await store.delete('customH2Color');
                await store.delete('customH3Color');
                await store.delete('customTextColor');
                await store.delete('customBg1Color');
                await store.delete('customBg1GradColor');
                await store.delete('customBg2Color');
                await store.delete('customDrawerBg');
            } catch (error) {
                console.error('Error deleting custom theme colors:', error);
            }

            if (customMainColor) customMainColor.value = DEFAULT_CUSTOM_COLORS.main;
            if (customAccentColor) customAccentColor.value = DEFAULT_CUSTOM_COLORS.accent;
            if (customHeaderTitleColor) customHeaderTitleColor.value = DEFAULT_CUSTOM_COLORS.headerTitle;
            if (customH1Color) customH1Color.value = DEFAULT_CUSTOM_COLORS.h1;
            if (customH2Color) customH2Color.value = DEFAULT_CUSTOM_COLORS.h2;
            if (customH3Color) customH3Color.value = DEFAULT_CUSTOM_COLORS.h3;
            if (customTextColor) customTextColor.value = DEFAULT_CUSTOM_COLORS.text;
            if (customBg1Color) customBg1Color.value = DEFAULT_CUSTOM_COLORS.bg1;
            if (customBg1GradColor) customBg1GradColor.value = DEFAULT_CUSTOM_COLORS.bg1Grad;
            if (customBg2Color) customBg2Color.value = DEFAULT_CUSTOM_COLORS.bg2;
            if (customDrawerBg) customDrawerBg.value = DEFAULT_CUSTOM_COLORS.drawerBg;
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
        dropdownOption1.classList.toggle('active');
        if (dropdownOption2) dropdownOption2.classList.remove('active'); // Close other
    });

    if (closeDropdown1Btn) {
        closeDropdown1Btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownOption1.classList.remove('active');
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
        dropdownOption2.classList.toggle('active');
        if (dropdownOption1) dropdownOption1.classList.remove('active'); // Close other
    });

    if (closeDropdown2Btn) {
        closeDropdown2Btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownOption2.classList.remove('active');
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
    saveToggleSettingsBtn.addEventListener('click', async () => {
        toggleState1 = pendingToggleState1;
        toggleState2 = pendingToggleState2;
        showHeaderDarkModeToggle = pendingShowHeaderToggle;
        
        try {
            await store.set('toggleState1', toggleState1);
            await store.set('toggleState2', toggleState2);
            await store.set('showHeaderDarkModeToggle', showHeaderDarkModeToggle);
        } catch (error) {
            console.error('Error saving toggle settings:', error);
            alert('Failed to save toggle settings. Please try again.');
        }
        
        updateHeaderToggleButtonText();
        applyHeaderToggleVisibility();

        const oldText = saveToggleSettingsBtn.innerText;
        saveToggleSettingsBtn.innerText = 'Saved!';
        setTimeout(() => { saveToggleSettingsBtn.innerText = oldText; }, 1500);
    });
}

// Close when clicking outside
document.addEventListener('click', (e) => {
    if (dropdownOption1 && dropdownOption1.classList.contains('active') && !toggleOption1Btn.contains(e.target) && !dropdownOption1.contains(e.target)) {
        dropdownOption1.classList.remove('active');
    }
    if (dropdownOption2 && dropdownOption2.classList.contains('active') && !toggleOption2Btn.contains(e.target) && !dropdownOption2.contains(e.target)) {
        dropdownOption2.classList.remove('active');
    }
});

export { applyTheme, applyHeaderToggleVisibility };