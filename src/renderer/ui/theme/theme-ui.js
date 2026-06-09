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
let pendingCustomThemeSaved = null;
let hasPendingChanges = false;
let activeColorsForReset = {};

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
        activeColorsForReset = { ...activeColors };

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

function revertPendingChanges() {
    pendingThemeMode = currentThemeMode;
    pendingShowHeaderToggle = showHeaderDarkModeToggle;
    pendingColors = { ...activeColorsForReset };
    pendingCustomThemeSaved = null;
    hasPendingChanges = false;

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCustom = document.getElementById('theme-radio-custom');
    if (themeRadioLight) themeRadioLight.checked = (pendingThemeMode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (pendingThemeMode === 'dark');
    if (themeRadioCustom) themeRadioCustom.checked = (pendingThemeMode === 'custom');
    updateCustomThemeOptionsVisibility(pendingThemeMode);

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = pendingShowHeaderToggle;

    for (const [id, value] of Object.entries(pendingColors)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
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
            hasPendingChanges = true;
        });
    }

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCustom = document.getElementById('theme-radio-custom');

    const markPending = () => { hasPendingChanges = true; };

    if (themeRadioLight) themeRadioLight.addEventListener('change', () => { pendingThemeMode = 'light'; updateCustomThemeOptionsVisibility('light'); markPending(); });
    if (themeRadioDark) themeRadioDark.addEventListener('change', () => { pendingThemeMode = 'dark'; updateCustomThemeOptionsVisibility('dark'); markPending(); });
    if (themeRadioCustom) themeRadioCustom.addEventListener('change', () => { pendingThemeMode = 'custom'; updateCustomThemeOptionsVisibility('custom'); markPending(); });

    const colorPickers = Object.keys(CUSTOM_COLOR_MAP).map(id => document.getElementById(id));
    colorPickers.forEach(picker => {
        if (!picker) return;
        picker.addEventListener('input', (e) => {
            pendingColors[e.target.id] = e.target.value;
            markPending();
        });
        picker.addEventListener('change', (e) => {
            pendingColors[e.target.id] = e.target.value;
            markPending();
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
                pendingCustomThemeSaved = false;
                if (pendingThemeMode === 'custom') {
                    pendingThemeMode = 'light';
                    const themeRadioLight = document.getElementById('theme-radio-light');
                    if (themeRadioLight) themeRadioLight.checked = true;
                    updateCustomThemeOptionsVisibility('light');
                }
                markPending();
            }
        });
    }

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) {
        toggleHeaderDarkModeSwitch.addEventListener('change', (e) => {
            pendingShowHeaderToggle = e.target.checked;
            markPending();
        });
    }

    const saveThemeSettingsBtn = document.getElementById('save-theme-settings-btn');
    
    const performSave = () => {
        setShowHeaderDarkModeToggle(pendingShowHeaderToggle);
        
        try {
            store.set('showHeaderDarkModeToggle', showHeaderDarkModeToggle);
            
            const activeColors = {};
            for (const [id, value] of Object.entries(pendingColors)) {
                store.set(id, value);
                const el = document.getElementById(id);
                if (el) el.value = value;
                activeColors[id] = value;
            }
            setActiveCustomColors(activeColors);
            activeColorsForReset = { ...activeColors };

            if (pendingCustomThemeSaved !== null) {
                setIsCustomThemeSaved(pendingCustomThemeSaved);
                store.set('customThemeSaved', pendingCustomThemeSaved);
                pendingCustomThemeSaved = null;
            }

            if (pendingThemeMode === 'custom') {
                setIsCustomThemeSaved(true);
                store.set('customThemeSaved', true);
            }

            setThemeMode(pendingThemeMode);
            applyHeaderToggleVisibility();
            hasPendingChanges = false;

            if (saveThemeSettingsBtn) {
                const oldText = saveThemeSettingsBtn.innerText;
                saveThemeSettingsBtn.innerText = 'Saved!';
                setTimeout(() => { saveThemeSettingsBtn.innerText = oldText; }, 1500);
            }
        } catch (error) {
            console.error('Error saving theme settings:', error);
            alert('Failed to save theme settings.');
        }
    };

    if (saveThemeSettingsBtn) {
        saveThemeSettingsBtn.addEventListener('click', performSave);
    }

    // Unsaved Changes Modal Setup
    let unsavedModal = document.getElementById('unsaved-changes-modal');
    if (!unsavedModal) {
        unsavedModal = document.createElement('div');
        unsavedModal.id = 'unsaved-changes-modal';
        unsavedModal.className = 'modal-overlay';
        unsavedModal.style.zIndex = '9999';
        unsavedModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <h3 style="margin-top: 0;">Unsaved Changes</h3>
                <p style="color: var(--timer-subtext); margin-bottom: 20px;">Are you sure you want to discard your changes?</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button class="action-btn" id="unsaved-discard-btn" style="background: #e74c3c; width: auto; padding: 0.6rem 1.2rem;">Discard Changes</button>
                    <button class="action-btn" id="unsaved-save-btn" style="background: #27ae60; width: auto; padding: 0.6rem 1.2rem;">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(unsavedModal);
    }

    const customizationModal = document.getElementById('modal-customization');
    const showUnsavedChangesModal = () => {
        unsavedModal.classList.add('active');
    };

    document.getElementById('unsaved-discard-btn').addEventListener('click', () => {
        unsavedModal.classList.remove('active');
        revertPendingChanges();
        if (customizationModal) customizationModal.classList.remove('active');
    });

    document.getElementById('unsaved-save-btn').addEventListener('click', () => {
        unsavedModal.classList.remove('active');
        performSave();
        if (customizationModal) customizationModal.classList.remove('active');
    });

    if (customizationModal) {
        const closeBtn = customizationModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                if (hasPendingChanges) {
                    e.stopImmediatePropagation();
                    showUnsavedChangesModal();
                }
            }, { capture: true });
        }

        customizationModal.addEventListener('click', (e) => {
            if (e.target === customizationModal && hasPendingChanges) {
                e.stopImmediatePropagation();
                showUnsavedChangesModal();
            }
        }, { capture: true });
    }
}
