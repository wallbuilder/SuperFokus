import { store } from '../../utils/storage.js';
import { 
    DEFAULT_CUSTOM_COLORS, 
    CUSTOM_COLOR_MAP, 
    modeNames 
} from './theme-config.js';
import { 
    currentThemeMode,
    setCurrentThemeMode,
    showHeaderDarkModeToggle,
    setShowHeaderDarkModeToggle,
    toggleState1,
    setToggleState1,
    toggleState2,
    setToggleState2,
    applyTheme, 
    applyHeaderToggleVisibility, 
    setThemeMode,
    updateHeaderToggleButtonText
} from './theme-engine.js';

let pendingToggleState1 = 'light';
let pendingToggleState2 = 'dark';
let pendingShowHeaderToggle = true;

export async function initTheme() {
    try {
        const mode = await store.get('themeMode', 'light');
        setCurrentThemeMode(mode);
        const showToggle = await store.get('showHeaderDarkModeToggle', true);
        setShowHeaderDarkModeToggle(showToggle);
        const s1 = await store.get('toggleState1', 'light');
        setToggleState1(s1);
        const s2 = await store.get('toggleState2', 'dark');
        setToggleState2(s2);
        
        pendingToggleState1 = s1;
        pendingToggleState2 = s2;
        pendingShowHeaderToggle = showToggle;

        const themeRadioLight = document.getElementById('theme-radio-light');
        const themeRadioDark = document.getElementById('theme-radio-dark');
        const themeRadioCustom = document.getElementById('theme-radio-custom');

        if (themeRadioLight && mode === 'light') themeRadioLight.checked = true;
        if (themeRadioDark && mode === 'dark') themeRadioDark.checked = true;
        if (themeRadioCustom && mode === 'custom') themeRadioCustom.checked = true;

        for (const id of Object.keys(CUSTOM_COLOR_MAP)) {
            const el = document.getElementById(id);
            if (el) {
                const savedValue = await store.get(id, DEFAULT_CUSTOM_COLORS[id]);
                el.value = savedValue;
            }
        }

        const toggleSelect1 = document.getElementById('toggle-select-1');
        const toggleSelect2 = document.getElementById('toggle-select-2');
        const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
        
        if (toggleSelect1) toggleSelect1.value = s1;
        if (toggleSelect2) toggleSelect2.value = s2;
        if (toggleHeaderDarkModeSwitch) toggleHeaderDarkModeSwitch.checked = showToggle;
        
        const toggleOption1Btn = document.getElementById('toggle-option-1');
        const toggleOption2Btn = document.getElementById('toggle-option-2');
        if (toggleOption1Btn) toggleOption1Btn.innerText = modeNames[s1];
        if (toggleOption2Btn) toggleOption2Btn.innerText = modeNames[s2];

        setupListeners();
        applyTheme();
        applyHeaderToggleVisibility();
    } catch (error) {
        console.error('Error initializing theme:', error);
        applyTheme();
        applyHeaderToggleVisibility();
    }
}

function setupListeners() {
    const themeToggleBtn = document.getElementById('theme-toggle');
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

    const themeRadioLight = document.getElementById('theme-radio-light');
    const themeRadioDark = document.getElementById('theme-radio-dark');
    const themeRadioCustom = document.getElementById('theme-radio-custom');

    if (themeRadioLight) themeRadioLight.addEventListener('change', () => setThemeMode('light'));
    if (themeRadioDark) themeRadioDark.addEventListener('change', () => setThemeMode('dark'));
    if (themeRadioCustom) themeRadioCustom.addEventListener('change', () => setThemeMode('custom'));

    const colorPickers = Object.keys(CUSTOM_COLOR_MAP).map(id => document.getElementById(id));
    colorPickers.forEach(picker => {
        if (!picker) return;
        picker.addEventListener('input', () => {
            if (currentThemeMode === 'custom') applyTheme();
        });
        picker.addEventListener('change', (e) => {
            store.set(e.target.id, e.target.value);
        });
    });

    const resetThemeColorsBtn = document.getElementById('reset-theme-colors-btn');
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

    const toggleHeaderDarkModeSwitch = document.getElementById('toggle-header-dark-mode-switch');
    if (toggleHeaderDarkModeSwitch) {
        toggleHeaderDarkModeSwitch.addEventListener('change', (e) => {
            pendingShowHeaderToggle = e.target.checked;
        });
    }

    const toggleOption1Btn = document.getElementById('toggle-option-1');
    const dropdownOption1 = document.getElementById('dropdown-option-1');
    const closeDropdown1Btn = document.getElementById('close-dropdown-1');
    const toggleSelect1 = document.getElementById('toggle-select-1');

    const toggleOption2Btn = document.getElementById('toggle-option-2');
    const dropdownOption2 = document.getElementById('dropdown-option-2');
    const closeDropdown2Btn = document.getElementById('close-dropdown-2');
    const toggleSelect2 = document.getElementById('toggle-select-2');

    const setupDropdown = (btn, dropdown, closeBtn, select, pendingStateKey) => {
        if (!btn || !dropdown) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
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

    const saveToggleSettingsBtn = document.getElementById('save-toggle-settings-btn');
    if (saveToggleSettingsBtn) {
        saveToggleSettingsBtn.addEventListener('click', async () => {
            setToggleState1(pendingToggleState1);
            setToggleState2(pendingToggleState2);
            setShowHeaderDarkModeToggle(pendingShowHeaderToggle);
            
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
}
