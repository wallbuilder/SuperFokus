import { store } from './storage.js';

// --- Audio ---
const chimeAudio = document.getElementById('chime-audio');
let audioCtx = null;

function playFallbackBeep() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        
        const vol = chimeVolumeInput ? parseFloat(chimeVolumeInput.value) : 1;
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) { console.error('Beep failed:', e); }
}

function playChime() {
    if (chimeAudio && chimeAudio.src) {
        chimeAudio.currentTime = 0;
        chimeAudio.play().catch(e => {
            console.log('Audio play failed:', e);
            playFallbackBeep();
        });
    } else {
        playFallbackBeep();
    }
}

const testChimeBtn = document.getElementById('test-chime-btn');
if (testChimeBtn) {
    testChimeBtn.addEventListener('click', playChime);
}

const chimeVolumeInput = document.getElementById('chime-volume');
if (chimeVolumeInput) {
    chimeVolumeInput.addEventListener('input', (e) => {
        if (chimeAudio) {
            chimeAudio.volume = parseFloat(e.target.value);
        }
    });
}

const chimeSelector = document.getElementById('chime-selector');
const chimeFileInput = document.getElementById('chime-file-input');
const uploadChimeBtn = document.getElementById('upload-chime-btn');

export async function initAudio() {
    const savedCustomChime = await store.get('customChimeData', null);
    if (savedCustomChime && chimeSelector) {
        chimeAudio.src = savedCustomChime;
        chimeSelector.value = 'custom';
    }
}

if (uploadChimeBtn && chimeFileInput) {
    uploadChimeBtn.addEventListener('click', () => {
        chimeFileInput.click();
    });

    chimeFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                store.set('customChimeData', dataUrl);
                chimeAudio.src = dataUrl;
                if (chimeSelector) chimeSelector.value = 'custom';
            };
            reader.readAsDataURL(file);
        }
    });
}

if (chimeSelector) {
    chimeSelector.addEventListener('change', async (e) => {
        const customData = await store.get('customChimeData');
        if (e.target.value === 'custom' && customData) {
            chimeAudio.src = customData;
        } else {
            chimeAudio.src = e.target.value;
        }
    });
}

export { playChime, playFallbackBeep };
