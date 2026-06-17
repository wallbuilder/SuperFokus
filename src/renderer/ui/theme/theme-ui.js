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
    updateHeaderToggleButtonText,
    customToggleState1,
    customToggleState2,
    setCustomToggleState1,
    setCustomToggleState2
} from './theme-engine.js';

let pendingThemeMode = 'light';
let pendingShowHeaderToggle = true;
let pendingCustomToggleState1 = 'light';
let pendingCustomToggleState2 = 'dark';
let hasPendingChanges = false;
let savedThemeMode = 'light';

export async function initTheme() {
    try {
        const mode = await store.get('themeMode', 'light');
        savedThemeMode = mode;
        
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
                .bubble, .white-bubble, .modal-bubble, input[type="radio"], input[type="checkbox"], select {
                    background-color: var(--container-bg) !important;
                    color: var(--text-color) !important;
                }
            `;
            document.head.appendChild(style);
        }

        setCurrentThemeMode(mode);
        pendingThemeMode = mode;
        const showToggle = await store.get('showHeaderDarkModeToggle', true);
        setShowHeaderDarkModeToggle(showToggle);
        pendingShowHeaderToggle = showToggle;

        const ts1 = await store.get('customToggleState1', 'light');
        const ts2 = await store.get('customToggleState2', 'dark');
        setCustomToggleState1(ts1);
        setCustomToggleState2(ts2);
        pendingCustomToggleState1 = ts1;
        pendingCustomToggleState2 = ts2;

        const sel1 = document.getElementById('custom-toggle-state-1');
        if (sel1) sel1.value = ts1;
        const sel2 = document.getElementById('custom-toggle-state-2');
        if (sel2) sel2.value = ts2;

        const themeRadioLight = document.getElementById('theme-radio-light');
        const themeRadioDark = document.getElementById('theme-radio-dark');
        const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');
        const themeRadioCyberWhite = document.getElementById('theme-radio-cyber-white');
        const themeRadioCyberLightblue = document.getElementById('theme-radio-cyber-lightblue');
        const themeRadioCyberBlue = document.getElementById('theme-radio-cyber-blue');

        if (themeRadioLight && mode === 'light') themeRadioLight.checked = true;
        if (themeRadioDark && mode === 'dark') themeRadioDark.checked = true;
        if (themeRadioCyberGreen && mode === 'cyber-green') themeRadioCyberGreen.checked = true;
        if (themeRadioCyberWhite && mode === 'cyber-white') themeRadioCyberWhite.checked = true;
        if (themeRadioCyberLightblue && mode === 'cyber-lightblue') themeRadioCyberLightblue.checked = true;
        if (themeRadioCyberBlue && mode === 'cyber-blue') themeRadioCyberBlue.checked = true;

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
    pendingThemeMode = savedThemeMode;
    pendingShowHeaderToggle = showHeaderDarkModeToggle;
    pendingCustomToggleState1 = customToggleState1;
    pendingCustomToggleState2 = customToggleState2;
    hasPendingChanges = false;

    setCurrentThemeMode(savedThemeMode);
    applyTheme();

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');
    const themeRadioCyberWhite = document.getElementById('theme-radio-cyber-white');
    const themeRadioCyberLightblue = document.getElementById('theme-radio-cyber-lightblue');
    const themeRadioCyberBlue = document.getElementById('theme-radio-cyber-blue');
    
    if (themeRadioLight) themeRadioLight.checked = (pendingThemeMode === 'light');
    if (themeRadioDark) themeRadioDark.checked = (pendingThemeMode === 'dark');
    if (themeRadioCyberGreen) themeRadioCyberGreen.checked = (pendingThemeMode === 'cyber-green');
    if (themeRadioCyberWhite) themeRadioCyberWhite.checked = (pendingThemeMode === 'cyber-white');
    if (themeRadioCyberLightblue) themeRadioCyberLightblue.checked = (pendingThemeMode === 'cyber-lightblue');
    if (themeRadioCyberBlue) themeRadioCyberBlue.checked = (pendingThemeMode === 'cyber-blue');

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = pendingShowHeaderToggle;

    const sel1 = document.getElementById('custom-toggle-state-1');
    if (sel1) sel1.value = pendingCustomToggleState1;
    const sel2 = document.getElementById('custom-toggle-state-2');
    if (sel2) sel2.value = pendingCustomToggleState2;
}

function previewTheme(mode) {
    setCurrentThemeMode(mode);
    applyTheme();
}

function setupListeners() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const next = getNextThemeMode();
            setThemeMode(next);
            savedThemeMode = next;
            pendingThemeMode = next;
            
            // visually update the radio buttons in the background if they exist
            const rL = document.getElementById('theme-radio-light');
            if (rL) rL.checked = (next === 'light');
            const rD = document.getElementById('theme-radio-dark');
            if (rD) rD.checked = (next === 'dark');
            const rCG = document.getElementById('theme-radio-cyber-green');
            if (rCG) rCG.checked = (next === 'cyber-green');
            const rCW = document.getElementById('theme-radio-cyber-white');
            if (rCW) rCW.checked = (next === 'cyber-white');
            const rCL = document.getElementById('theme-radio-cyber-lightblue');
            if (rCL) rCL.checked = (next === 'cyber-lightblue');
            const rCB = document.getElementById('theme-radio-cyber-blue');
            if (rCB) rCB.checked = (next === 'cyber-blue');
        });
    }

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCyberGreen = document.getElementById('theme-radio-cyber-green');
    const themeRadioCyberWhite = document.getElementById('theme-radio-cyber-white');
    const themeRadioCyberLightblue = document.getElementById('theme-radio-cyber-lightblue');
    const themeRadioCyberBlue = document.getElementById('theme-radio-cyber-blue');

    const markPending = () => { hasPendingChanges = true; };

    if (themeRadioLight) themeRadioLight.addEventListener('change', () => { pendingThemeMode = 'light'; previewTheme('light'); markPending(); });
    if (themeRadioDark) themeRadioDark.addEventListener('change', () => { pendingThemeMode = 'dark'; previewTheme('dark'); markPending(); });
    if (themeRadioCyberGreen) themeRadioCyberGreen.addEventListener('change', () => { pendingThemeMode = 'cyber-green'; previewTheme('cyber-green'); markPending(); });
    if (themeRadioCyberWhite) themeRadioCyberWhite.addEventListener('change', () => { pendingThemeMode = 'cyber-white'; previewTheme('cyber-white'); markPending(); });
    if (themeRadioCyberLightblue) themeRadioCyberLightblue.addEventListener('change', () => { pendingThemeMode = 'cyber-lightblue'; previewTheme('cyber-lightblue'); markPending(); });
    if (themeRadioCyberBlue) themeRadioCyberBlue.addEventListener('change', () => { pendingThemeMode = 'cyber-blue'; previewTheme('cyber-blue'); markPending(); });

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) {
        toggleHeaderDarkModeSwitch.addEventListener('change', (e) => {
            pendingShowHeaderToggle = e.target.checked;
            markPending();
        });
    }

    const sel1 = document.getElementById('custom-toggle-state-1');
    if (sel1) sel1.addEventListener('change', (e) => { pendingCustomToggleState1 = e.target.value; markPending(); });
    const sel2 = document.getElementById('custom-toggle-state-2');
    if (sel2) sel2.addEventListener('change', (e) => { pendingCustomToggleState2 = e.target.value; markPending(); });

    const saveThemeSettingsBtn = document.getElementById('save-theme-settings-btn');
    
    const performSave = () => {
        setShowHeaderDarkModeToggle(pendingShowHeaderToggle);
        
        try {
            store.set('showHeaderDarkModeToggle', pendingShowHeaderToggle);

            setCustomToggleState1(pendingCustomToggleState1);
            setCustomToggleState2(pendingCustomToggleState2);
            store.set('customToggleState1', pendingCustomToggleState1);
            store.set('customToggleState2', pendingCustomToggleState2);
            
            savedThemeMode = pendingThemeMode;
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
