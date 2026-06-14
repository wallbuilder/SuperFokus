import { store } from '../../utils/storage.js';
import { 
    currentThemeMode,
    setCurrentThemeMode,
    showHeaderDarkModeToggle,
    setShowHeaderDarkModeToggle,
    getNextThemeMode,
    applyTheme, 
    applyHeaderToggleVisibility, 
    setThemeMode,
    updateHeaderToggleButtonText
} from './theme-engine.js';

let pendingThemeMode = 'light';
let pendingShowHeaderToggle = true;
let hasPendingChanges = false;

export async function initTheme() {
    try {
        const mode = await store.get('themeMode', 'light');
        
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
        const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');

        if (themeRadioLight && mode === 'light') themeRadioLight.checked = true;
        if (themeRadioDark && mode === 'dark') themeRadioDark.checked = true;
        if (themeRadioCyberGreen && mode === 'cyber-green') themeRadioCyberGreen.checked = true;

        const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
        if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = showToggle;
        
        setupListeners();
        applyTheme();
        applyHeaderToggleVisibility();
    } catch (error) {
        console.error('Error initializing theme:', error);
        applyTheme();
        applyHeaderToggleVisibility();
    }
}

function revertPendingChanges() {
    pendingThemeMode = currentThemeMode;
    pendingShowHeaderToggle = showHeaderDarkModeToggle;
    hasPendingChanges = false;

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');
    if (themeRadioLight) themeRadioLight.checked = (pendingThemeMode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (pendingThemeMode === 'dark');
    if (themeRadioCyberGreen) themeRadioCyberGreen.checked = (pendingThemeMode === 'cyber-green');

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = pendingShowHeaderToggle;
}

function setupListeners() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const next = getNextThemeMode();
            setThemeMode(next);
            pendingThemeMode = next;
            hasPendingChanges = true;
        });
    }

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');

    const markPending = () => { hasPendingChanges = true; };

    if (themeRadioLight) themeRadioLight.addEventListener('change', () => { pendingThemeMode = 'light'; markPending(); });
    if (themeRadioDark) themeRadioDark.addEventListener('change', () => { pendingThemeMode = 'dark'; markPending(); });
    if (themeRadioCyberGreen) themeRadioCyberGreen.addEventListener('change', () => { pendingThemeMode = 'cyber-green'; markPending(); });

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

