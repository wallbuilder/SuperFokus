import { store } from './storage.js';
import { 
    soundPacks, 
    customSoundPacks, 
    customNotifs, 
    customAmbientData,
    setCustomSoundPacks,
    setCustomNotifs,
    setCustomAmbientData
} from './audio/audio-definitions.js';
import { 
    playChime, 
    playFallbackBeep, 
    toggleAmbientNoise,
    setChimeVolume,
    setAmbientVolume
} from './audio/audio-engine.js';
import { 
    loadFileAsDataURL, 
    saveCustomSoundPack as savePackLogic, 
    deleteCustomSoundPack as deletePackLogic 
} from './audio/audio-storage.js';
import { 
    updateSoundSelectors, 
    updateCustomNotifsUI, 
    updateCustomAmbientUI, 
    updateCustomPackUI 
} from './audio/audio-ui.js';

/**
 * Facade for Audio Utilities
 */

export async function initAudio() {
    const savedCustomNotifs = await store.get('customNotifsData', []);
    if (Array.isArray(savedCustomNotifs)) {
        setCustomNotifs(savedCustomNotifs);
    }
    
    const savedCustomAmbient = await store.get('customAmbientData', null);
    if (savedCustomAmbient) {
        setCustomAmbientData(savedCustomAmbient);
    }

    const savedCustomSoundPacks = await store.get('customSoundPacks', {});
    if (savedCustomSoundPacks) {
        setCustomSoundPacks(savedCustomSoundPacks);
        // Merge into soundPacks for selection
        Object.assign(soundPacks, savedCustomSoundPacks);
    }

    setupEventListeners();
}

function setupEventListeners() {
    const testChimeBtn = document.getElementById('test-chime-btn');
    if (testChimeBtn) {
        testChimeBtn.addEventListener('click', () => playChime('test'));
    }

    const chimeVolumeInput = document.getElementById('chime-volume');
    if (chimeVolumeInput) {
        chimeVolumeInput.addEventListener('input', (e) => {
            setChimeVolume(parseFloat(e.target.value));
        });
    }

    const soundPackSelector = document.getElementById('sound-pack-selector');
    if (soundPackSelector) {
        soundPackSelector.addEventListener('change', () => {
            updateSoundSelectors();
            toggleAmbientNoise();
        });
    }

    const ambientNoiseSelector = document.getElementById('ambient-noise-selector');
    if (ambientNoiseSelector) {
        ambientNoiseSelector.addEventListener('change', toggleAmbientNoise);
    }

    const ambientVolumeInput = document.getElementById('ambient-volume');
    if (ambientVolumeInput) {
        ambientVolumeInput.addEventListener('input', (e) => {
            setAmbientVolume(parseFloat(e.target.value));
        });
    }

    const chimeFileInput = document.getElementById('chime-file-input');
    const uploadChimeBtn = document.getElementById('upload-chime-btn');

    if (uploadChimeBtn && chimeFileInput) {
        uploadChimeBtn.addEventListener('click', () => {
            if (customNotifs.length < 3) {
                chimeFileInput.click();
            }
        });

        chimeFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    customNotifs.push(dataUrl);
                    store.set('customNotifsData', customNotifs);
                    updateCustomNotifsUI();
                    updateSoundSelectors();
                    
                    const notifSelector = document.getElementById('notification-sound-selector');
                    if (notifSelector) {
                        notifSelector.value = `custom-notif-${customNotifs.length - 1}`;
                    }
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
    }

    const ambientFileInput = document.getElementById('ambient-file-input');
    const uploadAmbientBtn = document.getElementById('upload-ambient-btn');
    const deleteAmbientBtn = document.getElementById('delete-custom-ambient-btn');

    if (uploadAmbientBtn && ambientFileInput) {
        uploadAmbientBtn.addEventListener('click', () => {
            ambientFileInput.click();
        });

        ambientFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    setCustomAmbientData(dataUrl);
                    store.set('customAmbientData', dataUrl);
                    updateCustomAmbientUI();
                    updateSoundSelectors();
                    
                    const ambientSelector = document.getElementById('ambient-noise-selector');
                    if (ambientSelector) {
                        ambientSelector.value = 'custom-ambient';
                        toggleAmbientNoise();
                    }
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
    }

    if (deleteAmbientBtn) {
        deleteAmbientBtn.addEventListener('click', () => {
            setCustomAmbientData(null);
            store.delete('customAmbientData');
            updateCustomAmbientUI();
            updateSoundSelectors();
            toggleAmbientNoise();
        });
    }
}

export async function saveCustomSoundPack(packName, notifs, ambient) {
    await savePackLogic(packName, notifs, ambient);
    updateSoundSelectors(); 
    updateCustomPackUI(); 

    const packSelector = document.getElementById('sound-pack-selector');
    if (packSelector) {
        packSelector.value = packName;
        toggleAmbientNoise();
    }
    alert(`Custom soundpack "${packName}" saved successfully!`);
}

export async function deleteCustomSoundPack(packName) {
    const success = await deletePackLogic(packName);
    if (success) {
        updateSoundSelectors();
        updateCustomPackUI();
        alert(`Custom soundpack "${packName}" deleted.`);
    }
}

export { 
    playChime, 
    playFallbackBeep, 
    toggleAmbientNoise, 
    loadFileAsDataURL, 
    updateCustomPackUI,
    updateSoundSelectors,
    updateCustomNotifsUI,
    updateCustomAmbientUI
};
