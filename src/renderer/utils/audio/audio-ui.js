import { store } from '../storage.js';
import { 
    soundPacks, 
    customSoundPacks, 
    customNotifs, 
    customAmbientData,
    setCustomNotifs,
    setCustomAmbientData
} from './audio-definitions.js';
import { toggleAmbientNoise } from './audio-engine.js';

export function updateSoundSelectors() {
    try {
        const packSelector = document.getElementById('sound-pack-selector');
        const customPacksSelector = document.getElementById('custom-packs-selector');

        const currentPack = packSelector ? packSelector.value : 'classic';
        let currentNotif = '';
        let currentAmbient = '';

        const notifSelector = document.getElementById('notification-sound-selector');
        const ambientSelector = document.getElementById('ambient-noise-selector');

        if (notifSelector) currentNotif = notifSelector.value;
        if (ambientSelector) currentAmbient = ambientSelector.value;

        if (packSelector) {
            packSelector.innerHTML = '';
            Object.keys(soundPacks).filter(key => !customSoundPacks.hasOwnProperty(key)).forEach(packId => {
                const opt = document.createElement('option');
                opt.value = packId;
                opt.innerText = soundPacks[packId].label || packId;
                packSelector.appendChild(opt);
            });
            Object.keys(customSoundPacks).forEach(packId => {
                const opt = document.createElement('option');
                opt.value = packId;
                opt.innerText = customSoundPacks[packId].label || packId;
                packSelector.appendChild(opt);
            });
        }

        if (customPacksSelector) {
            customPacksSelector.innerHTML = '<option value="none">No Custom Packs</option>';
            Object.keys(customSoundPacks).forEach(packId => {
                const opt = document.createElement('option');
                opt.value = packId;
                opt.innerText = customSoundPacks[packId].label || packId;
                customPacksSelector.appendChild(opt);
            });
            customPacksSelector.value = 'none';
        }

        if (packSelector) {
            if (soundPacks[currentPack]) {
                packSelector.value = currentPack;
            } else {
                packSelector.value = 'classic';
            }
        }

        const pack = packSelector ? packSelector.value : 'classic';

        if (notifSelector && ambientSelector) {
            notifSelector.innerHTML = '';
            if (soundPacks[pack]) {
                soundPacks[pack].notifs.forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n.id;
                    opt.innerText = n.label;
                    notifSelector.appendChild(opt);
                });
            }
            
            customNotifs.forEach((n, idx) => {
                const opt = document.createElement('option');
                opt.value = `custom-notif-${idx}`;
                opt.innerText = `Custom Notification ${idx + 1}`;
                notifSelector.appendChild(opt);
            });

            ambientSelector.innerHTML = '<option value="none">None</option>';
            if (soundPacks[pack]) {
                soundPacks[pack].ambient.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.id;
                    opt.innerText = a.label;
                    ambientSelector.appendChild(opt);
                });
            }

            if (customAmbientData) {
                const opt = document.createElement('option');
                opt.value = 'custom-ambient';
                opt.innerText = 'Custom Background Noise';
                ambientSelector.appendChild(opt);
            }

            if (Array.from(notifSelector.options).some(o => o.value === currentNotif)) {
                notifSelector.value = currentNotif;
            } else {
                notifSelector.value = notifSelector.options[0] ? notifSelector.options[0].value : '';
            }

            if (Array.from(ambientSelector.options).some(o => o.value === currentAmbient)) {
                ambientSelector.value = currentAmbient;
            } else {
                ambientSelector.value = 'none';
            }
        }
    } catch (error) {
        console.error('Error in updateSoundSelectors:', error);
    }
}

export function updateCustomNotifsUI() {
    const container = document.getElementById('custom-notifs-container');
    if (!container) return;
    
    container.innerHTML = '';
    customNotifs.forEach((n, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.alignItems = 'center';
        div.style.padding = '5px 10px';
        div.style.border = '1px solid var(--border-color)';
        div.style.borderRadius = '4px';

        const label = document.createElement('span');
        label.style.flex = '1';
        label.style.fontSize = '0.9rem';
        label.innerText = `Custom Notification ${idx + 1}`;

        const delBtn = document.createElement('button');
        delBtn.className = 'action-btn';
        delBtn.style.margin = '0';
        delBtn.style.padding = '5px 10px';
        delBtn.style.background = '#e74c3c';
        delBtn.style.width = 'auto';
        delBtn.innerText = 'Delete';
        delBtn.onclick = () => {
            customNotifs.splice(idx, 1);
            store.set('customNotifsData', customNotifs);
            updateCustomNotifsUI();
            updateSoundSelectors();
        };

        div.appendChild(label);
        div.appendChild(delBtn);
        container.appendChild(div);
    });

    const uploadBtn = document.getElementById('upload-chime-btn');
    if (uploadBtn) {
        if (customNotifs.length >= 3) {
            uploadBtn.style.display = 'none';
        } else {
            uploadBtn.style.display = 'block';
        }
    }
}

export function updateCustomAmbientUI() {
    const container = document.getElementById('custom-ambient-container');
    if (!container) return;

    if (customAmbientData) {
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

export function updateCustomPackUI() {
    const customPacksSelector = document.getElementById('custom-packs-selector');
    if (customPacksSelector) {
        customPacksSelector.innerHTML = '<option value="none">No Custom Packs</option>';
        Object.keys(customSoundPacks).forEach(packId => {
            const opt = document.createElement('option');
            opt.value = packId;
            opt.innerText = customSoundPacks[packId].label || packId;
            customPacksSelector.appendChild(opt);
        });
        customPacksSelector.value = 'none';
    }
}
