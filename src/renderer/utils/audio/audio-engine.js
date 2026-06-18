import { customNotifs, customAmbientData, soundPacks } from './audio-definitions.js';

let chimeAudio = null;
const chimeAudioElement = document.getElementById('chime-audio');
if (chimeAudioElement) {
    chimeAudio = chimeAudioElement;
}
let audioCtx = null;

// Ambient Noise Generator
let ambientAudio = new Audio();
ambientAudio.loop = true;

// Synthetic Ambient State
let synthAmbientSource = null;
let synthAmbientGain = null;
let synthAmbientLFO = null;
let synthAmbientFilter = null;

function stopSynthAmbient() {
    if (synthAmbientSource) {
        synthAmbientSource.stop();
        synthAmbientSource.disconnect();
        synthAmbientSource = null;
    }
    if (synthAmbientLFO) {
        synthAmbientLFO.stop();
        synthAmbientLFO.disconnect();
        synthAmbientLFO = null;
    }
    if (synthAmbientFilter) {
        synthAmbientFilter.disconnect();
        synthAmbientFilter = null;
    }
    if (synthAmbientGain) {
        synthAmbientGain.disconnect();
        synthAmbientGain = null;
    }
}

function startSynthAmbient(type, vol) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    stopSynthAmbient();

    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        if (type.startsWith('classic')) {
            output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise
            lastOut = output[i];
            output[i] *= 3.5;
        } else {
            output[i] = white * 0.5; // Pinkish
        }
    }

    synthAmbientSource = audioCtx.createBufferSource();
    synthAmbientSource.buffer = buffer;
    synthAmbientSource.loop = true;

    synthAmbientFilter = audioCtx.createBiquadFilter();
    
    if (type === 'classic-bg-1') {
        synthAmbientFilter.type = 'lowpass';
        synthAmbientFilter.frequency.value = 400;
    } else if (type === 'classic-bg-2') {
        synthAmbientFilter.type = 'lowpass';
        synthAmbientFilter.frequency.value = 800;
    } else if (type === 'classic-bg-3') {
        synthAmbientFilter.type = 'bandpass';
        synthAmbientFilter.frequency.value = 600;
    } else if (type === 'mech-bg-1') {
        synthAmbientFilter.type = 'lowpass';
        synthAmbientFilter.frequency.value = 300;
        synthAmbientLFO = audioCtx.createOscillator();
        synthAmbientLFO.type = 'sine';
        synthAmbientLFO.frequency.value = 0.5;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 200;
        synthAmbientLFO.connect(lfoGain);
        lfoGain.connect(synthAmbientFilter.frequency);
        synthAmbientLFO.start();
    } else if (type === 'mech-bg-2') {
        synthAmbientFilter.type = 'bandpass';
        synthAmbientFilter.frequency.value = 1000;
        synthAmbientFilter.Q.value = 2;
        synthAmbientLFO = audioCtx.createOscillator();
        synthAmbientLFO.type = 'square';
        synthAmbientLFO.frequency.value = 2;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 500;
        synthAmbientLFO.connect(lfoGain);
        lfoGain.connect(synthAmbientFilter.frequency);
        synthAmbientLFO.start();
    } else if (type === 'mech-bg-3') {
        synthAmbientFilter.type = 'lowpass';
        synthAmbientFilter.frequency.value = 500;
        synthAmbientLFO = audioCtx.createOscillator();
        synthAmbientLFO.type = 'sawtooth';
        synthAmbientLFO.frequency.value = 0.2;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 300;
        synthAmbientLFO.connect(lfoGain);
        lfoGain.connect(synthAmbientFilter.frequency);
        synthAmbientLFO.start();
    }

    synthAmbientGain = audioCtx.createGain();
    synthAmbientGain.gain.value = vol;

    synthAmbientSource.connect(synthAmbientFilter);
    synthAmbientFilter.connect(synthAmbientGain);
    synthAmbientGain.connect(audioCtx.destination);
    
    synthAmbientSource.start();
}

export function toggleAmbientNoise() {
    const ambientSelector = document.getElementById('ambient-noise-selector');
    if (!ambientSelector) return;
    const type = ambientSelector.value;
    const volInput = document.getElementById('ambient-volume');
    const vol = volInput ? parseFloat(volInput.value) : 0.5;
    
    ambientAudio.pause();
    stopSynthAmbient();
    
    if (type === 'none') {
        return;
    }

    if (type.startsWith('classic-bg-') || type.startsWith('mech-bg-')) {
        startSynthAmbient(type, vol);
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

export function playSynthChime(pack, type) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Explicitly resume in case it was suspended by the browser
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    const notifSelector = document.getElementById('notification-sound-selector');
    const selectedNotif = notifSelector ? notifSelector.value : 'classic-notif-1';

    let freq = 880;
    if (type === 'session-start') freq = 523.25; // C5
    if (type === 'break-start') freq = 659.25; // E5
    if (type === 'session-complete') freq = 783.99; // G5
    if (type === 'test') freq = 880; // A5

    // Trap for the Legacy Chime specifically
    if (selectedNotif === 'nature-notif-1') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        
        const chimeVolumeInput = document.getElementById('chime-volume');
        const vol = chimeVolumeInput ? parseFloat(chimeVolumeInput.value) : 1;
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
        return;
    }

    if (pack === 'classic') {
        if (selectedNotif === 'classic-notif-1') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1);
        } else if (selectedNotif === 'classic-notif-2') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 1.2, audioCtx.currentTime + 0.2);
        } else if (selectedNotif === 'classic-notif-3') {
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(freq * 0.8, audioCtx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(freq * 1.2, audioCtx.currentTime + 0.3);
        } else {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1);
        }
    } else if (pack === 'nature') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.5);
    } else if (pack === 'mechanical') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1);
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

export function playChime(eventType = 'test') {
    const packSelector = document.getElementById('sound-pack-selector');
    const pack = packSelector ? packSelector.value : 'classic';
    const notifSelector = document.getElementById('notification-sound-selector');
    
    if (eventType === 'session-start' && document.getElementById('alert-session-start') && !document.getElementById('alert-session-start').checked) return;
    if (eventType === 'break-start' && document.getElementById('alert-break-start') && !document.getElementById('alert-break-start').checked) return;
    if (eventType === 'session-complete' && document.getElementById('alert-session-complete') && !document.getElementById('alert-session-complete').checked) return;
    
    const selectedNotif = notifSelector ? notifSelector.value : `${pack}-notif-1`;

    if (pack === 'classic') {
        playSynthChime(pack, eventType);
        return;
    }

    if (chimeAudio) {
        const chimeVolumeInput = document.getElementById('chime-volume');
        if (chimeVolumeInput) chimeAudio.volume = parseFloat(chimeVolumeInput.value);
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

export function setChimeVolume(vol) {
    if (chimeAudio) chimeAudio.volume = vol;
}

export function setAmbientVolume(vol) {
    ambientAudio.volume = vol;
    if (synthAmbientGain) {
        synthAmbientGain.gain.value = vol;
    }
}
