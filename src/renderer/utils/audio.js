import { store } from './storage.js';

// --- Audio ---
let chimeAudio = null;
const chimeAudioElement = document.getElementById('chime-audio');
if (chimeAudioElement) {
    chimeAudio = chimeAudioElement;
}
let audioCtx = null;

// Ambient Noise Generator
let ambientAudio = new Audio(); // This can be initialized directly as it doesn't rely on a DOM element initially
ambientAudio.loop = true;

let soundPacks = {
    classic: {
        notifs: [
            { id: 'classic-notif-1', label: 'Classic Notification 1' },
            { id: 'classic-notif-2', label: 'Classic Notification 2' },
            { id: 'classic-notif-3', label: 'Classic Notification 3' },
            { id: 'nature-notif-1', label: 'Chime (Old)' }
        ],
        ambient: [
            { id: 'classic-bg-1', label: 'Classic Ambient 1' },
            { id: 'classic-bg-2', label: 'Classic Ambient 2' },
            { id: 'classic-bg-3', label: 'Classic Ambient 3' }
        ]
    },
    nature: {
        notifs: [
            { id: 'nature-notif-1', label: 'Nature Notification 1' },
            { id: 'nature-notif-2', label: 'Nature Notification 2' },
            { id: 'nature-notif-3', label: 'Nature Notification 3' }
        ],
        ambient: [
            { id: 'nature-bg-1', label: 'Nature Ambient 1' },
            { id: 'nature-bg-2', label: 'Nature Ambient 2' },
            { id: 'nature-bg-3', label: 'Nature Ambient 3' }
        ]
    },
    mechanical: {
        notifs: [
            { id: 'mech-notif-1', label: 'Mech Notification 1' },
            { id: 'mech-notif-2', label: 'Mech Notification 2' },
            { id: 'mech-notif-3', label: 'Mech Notification 3' }
        ],
        ambient: [
            { id: 'mech-bg-1', label: 'Mech Ambient 1' },
            { id: 'mech-bg-2', label: 'Mech Ambient 2' },
            { id: 'mech-bg-3', label: 'Mech Ambient 3' }
        ]
    }
};

let customSoundPacks = {};

let customNotifs = [];
let customAmbientData = null; // Only one custom ambient can be active for built-in single custom ambient upload

async function loadFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

function updateSoundSelectors() {
    try {
        const packSelector = document.getElementById('sound-pack-selector');
        const customPacksSelector = document.getElementById('custom-packs-selector'); // This might be null if not ready

        // Save current selections
        const currentPack = packSelector ? packSelector.value : 'classic';
        let currentNotif = '';
        let currentAmbient = '';

        const notifSelector = document.getElementById('notification-sound-selector');
        const ambientSelector = document.getElementById('ambient-noise-selector');

        if (notifSelector) currentNotif = notifSelector.value;
        if (ambientSelector) currentAmbient = ambientSelector.value;

        // Clear existing options from main pack selector and custom pack selector
        if (packSelector) {
            packSelector.innerHTML = '';
            // Add default packs
            Object.keys(soundPacks).filter(key => !customSoundPacks.hasOwnProperty(key)).forEach(packId => {
                const opt = document.createElement('option');
                opt.value = packId;
                opt.innerText = soundPacks[packId].label || packId; // Use label if available, else id
                packSelector.appendChild(opt);
            });
            // Add custom packs
            Object.keys(customSoundPacks).forEach(packId => {
                const opt = document.createElement('option');
                opt.value = packId;
                opt.innerText = customSoundPacks[packId].label || packId;
                packSelector.appendChild(opt);
            });
        }

        if (customPacksSelector) { // Ensure customPacksSelector exists before manipulating
            customPacksSelector.innerHTML = '<option value="none">No Custom Packs</option>';
            Object.keys(customSoundPacks).forEach(packId => {
                const opt = document.createElement('option');
                opt.value = packId;
                opt.innerText = customSoundPacks[packId].label || packId;
                customPacksSelector.appendChild(opt);
            });
            customPacksSelector.value = 'none'; // Reset to none after updating list
        } else {
            console.warn("customPacksSelector not found during updateSoundSelectors, skipping custom pack UI update.");
        }

        // Restore selected pack or default to 'classic'
        if (packSelector) {
            if (soundPacks[currentPack]) {
                packSelector.value = currentPack;
            } else {
                packSelector.value = 'classic';
            }
        }

        const pack = packSelector ? packSelector.value : 'classic';

        if (notifSelector && ambientSelector) {
            // Update Notifs
            notifSelector.innerHTML = '';
            if (soundPacks[pack]) { // Check if the pack exists
                soundPacks[pack].notifs.forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n.id;
                    opt.innerText = n.label;
                    notifSelector.appendChild(opt);
                });
            }
            
            // Add Custom Notifs (from built-in single custom notif upload)
            customNotifs.forEach((n, idx) => {
                const opt = document.createElement('option');
                opt.value = `custom-notif-${idx}`;
                opt.innerText = `Custom Notification ${idx + 1}`;
                notifSelector.appendChild(opt);
            });

            // Update Ambient
            ambientSelector.innerHTML = '<option value="none">None</option>';
            if (soundPacks[pack]) { // Check if the pack exists
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

            // Restore selections if still valid, else default to first
            if (Array.from(notifSelector.options).some(o => o.value === currentNotif)) {
                notifSelector.value = currentNotif;
            } else {
                // If currentNotif is from a previously selected custom pack that's now deselected, it might not be in the list.
                // Default to the first available notification if the old one isn't there.
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

function updateCustomNotifsUI() {
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

function updateCustomAmbientUI() {
    const container = document.getElementById('custom-ambient-container');
    if (!container) return;

    if (customAmbientData) {
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

function toggleAmbientNoise() {
    const ambientSelector = document.getElementById('ambient-noise-selector');
    if (!ambientSelector) return;
    const type = ambientSelector.value;
    const volInput = document.getElementById('ambient-volume');
    const vol = volInput ? parseFloat(volInput.value) : 0.5;
    
    ambientAudio.pause();
    
    if (type === 'none') {
        return;
    }

    if (type === 'custom-ambient' && customAmbientData) {
        ambientAudio.src = customAmbientData;
    } else {
        ambientAudio.src = `assets/sounds/${type}.mp3`;
    }
    
    ambientAudio.volume = vol;
    ambientAudio.play().catch(e => console.log('Ambient play failed:', e));
}

function playSynthChime(pack, type) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    let freq = 880;
    if (type === 'session-start') freq = 440;
    if (type === 'break-start') freq = 660;
    if (type === 'session-complete') freq = 880;
    
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    if (pack === 'nature') {
        oscillator.type = 'sine';
        oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.5);
    } else if (pack === 'mechanical') {
        oscillator.type = 'square';
    } else {
        oscillator.type = 'triangle';
        oscillator.frequency.exponentialRampToValueAtTime(freq / 2, audioCtx.currentTime + 0.1);
    }
    
    const chimeVolumeInput = document.getElementById('chime-volume');
    const vol = chimeVolumeInput ? parseFloat(chimeVolumeInput.value) : 1;
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
}

function playChime(eventType = 'test') {
    const packSelector = document.getElementById('sound-pack-selector');
    const pack = packSelector ? packSelector.value : 'classic';
    const notifSelector = document.getElementById('notification-sound-selector');
    
    if (eventType === 'session-start' && document.getElementById('alert-session-start') && !document.getElementById('alert-session-start').checked) return;
    if (eventType === 'break-start' && document.getElementById('alert-break-start') && !document.getElementById('alert-break-start').checked) return;
    if (eventType === 'session-complete' && document.getElementById('alert-session-complete') && !document.getElementById('alert-session-complete').checked) return;
    
    const selectedNotif = notifSelector ? notifSelector.value : `${pack}-notif-1`;

    if (chimeAudio) {
        if (selectedNotif.startsWith('custom-notif-')) {
            const idx = parseInt(selectedNotif.split('-').pop(), 10);
            if (customNotifs[idx]) {
                chimeAudio.src = customNotifs[idx];
            } else {
                playSynthChime(pack, eventType);
                return;
            }
        } else {
            chimeAudio.src = `assets/sounds/${selectedNotif}.mp3`;
        }

        chimeAudio.currentTime = 0;
        chimeAudio.play().catch(e => {
            console.warn(`[Audio] Failed to play ${selectedNotif}, using fallback.`, e);
            if (selectedNotif !== 'nature-notif-1') {
                chimeAudio.src = 'assets/sounds/nature-notif-1.mp3';
                chimeAudio.play().catch(() => playSynthChime(pack, eventType));
            } else {
                playSynthChime(pack, eventType);
            }
        });
    } else {
        playSynthChime(pack, eventType);
    }
}

function playFallbackBeep() {
    playSynthChime('classic', 'test');
}

const testChimeBtn = document.getElementById('test-chime-btn');
if (testChimeBtn) {
    testChimeBtn.addEventListener('click', () => playChime('test'));
}

const chimeVolumeInput = document.getElementById('chime-volume');
if (chimeVolumeInput) {
    chimeVolumeInput.addEventListener('input', (e) => {
        if (chimeAudio) {
            chimeAudio.volume = parseFloat(e.target.value);
        }
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
        ambientAudio.volume = parseFloat(e.target.value);
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
                customAmbientData = dataUrl;
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
        customAmbientData = null;
        store.delete('customAmbientData');
        updateCustomAmbientUI();
        updateSoundSelectors();
        toggleAmbientNoise();
    });
}

export async function initAudio() {
    const savedCustomNotifs = await store.get('customNotifsData', []);
    if (Array.isArray(savedCustomNotifs)) {
        customNotifs = savedCustomNotifs;
    }
    
    const savedCustomAmbient = await store.get('customAmbientData', null);
    if (savedCustomAmbient) {
        customAmbientData = savedCustomAmbient;
    }

    const savedCustomSoundPacks = await store.get('customSoundPacks', {});
    if (savedCustomSoundPacks) {
        customSoundPacks = savedCustomSoundPacks;
    }
}

function updateCustomPackUI() {
    const customPacksSelector = document.getElementById('custom-packs-selector');
    if (customPacksSelector) {
        customPacksSelector.innerHTML = '<option value="none">No Custom Packs</option>';
        Object.keys(customSoundPacks).forEach(packId => {
            const opt = document.createElement('option');
            opt.value = packId;
            opt.innerText = customSoundPacks[packId].label || packId;
            customPacksSelector.appendChild(opt);
        });
        customPacksSelector.value = 'none'; // Reset to none after updating list
    }
}

async function saveCustomSoundPack(packName, notifs, ambient) {
    if (!packName) {
        alert('Please enter a name for your custom soundpack.');
        return;
    }
    if (soundPacks[packName]) {
        alert(`A soundpack with the name "${packName}" already exists. Please choose a different name.`);
        return;
    }

    const formattedNotifs = notifs.map((dataUrl, idx) => ({ id: `${packName}-notif-${idx}`, label: `Notification ${idx + 1}`, src: dataUrl }));
    const formattedAmbient = ambient.map((dataUrl, idx) => ({ id: `${packName}-ambient-${idx}`, label: `Ambient ${idx + 1}`, src: dataUrl }));

    customSoundPacks[packName] = {
        label: packName,
        notifs: formattedNotifs,
        ambient: formattedAmbient
    };

    // Add to the main soundPacks object as well so it's selectable immediately
    soundPacks[packName] = customSoundPacks[packName];

    await store.set('customSoundPacks', customSoundPacks);
    updateSoundSelectors(); // Re-populate all selectors
    updateCustomPackUI(); // Update the custom pack dropdown

    // Select the newly created pack
    const packSelector = document.getElementById('sound-pack-selector');
    if (packSelector) {
        packSelector.value = packName;
        toggleAmbientNoise(); // Apply new ambient if any
    }
    alert(`Custom soundpack "${packName}" saved successfully!`);
}

async function deleteCustomSoundPack(packName) {
    if (!packName || packName === 'none') {
        alert('Please select a custom soundpack to delete.');
        return;
    }
    if (!customSoundPacks[packName]) {
        alert('Selected soundpack not found in custom soundpacks.');
        return;
    }

    if (confirm(`Are you sure you want to delete the custom soundpack "${packName}"?`)) {
        // Remove from main soundPacks object
        delete soundPacks[packName];
        // Remove from customSoundPacks
        delete customSoundPacks[packName];
        await store.set('customSoundPacks', customSoundPacks);
        updateSoundSelectors(); // Re-populate all selectors
        updateCustomPackUI(); // Update the custom pack dropdown
        alert(`Custom soundpack "${packName}" deleted.`);
    }
}

// Function to load a selected custom pack into the main soundpack selector
function loadCustomPack(packName) {
    if (customSoundPacks[packName]) {
        const packSelector = document.getElementById('sound-pack-selector');
        if (packSelector) {
            packSelector.value = packName;
            updateSoundSelectors();
            toggleAmbientNoise();
        }
    }
}

export { 
    playChime, 
    playFallbackBeep, 
    toggleAmbientNoise, 
    loadFileAsDataURL, 
    saveCustomSoundPack, 
    deleteCustomSoundPack, 
    updateCustomPackUI,
    updateSoundSelectors,
    updateCustomNotifsUI,
    updateCustomAmbientUI
};
