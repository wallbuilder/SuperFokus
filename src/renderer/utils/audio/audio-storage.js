import { store } from '../storage.js';
import { customSoundPacks, soundPacks } from './audio-definitions.js';

export async function loadFileAsDataURL(file) {
    if (window.electronAPI) {
        const arrayBuffer = await file.arrayBuffer();
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = await window.electronAPI.invoke('save-audio-file', fileName, arrayBuffer);
        return filePath;
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

export async function saveCustomSoundPack(packName, notifs, ambient) {
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
    // UI updates are handled in audio-ui.js which will call this, or facade will coordinate
}

export async function deleteCustomSoundPack(packName) {
    if (!packName || packName === 'none') {
        alert('Please select a custom soundpack to delete.');
        return;
    }
    if (!customSoundPacks[packName]) {
        alert('Selected soundpack not found in custom soundpacks.');
        return;
    }

    if (confirm(`Are you sure you want to delete the custom soundpack "${packName}"?`)) {
        if (window.electronAPI) {
            const pack = customSoundPacks[packName];
            if (pack.notifs) pack.notifs.forEach(n => {
                if (n.src && n.src.startsWith('file://')) window.electronAPI.invoke('delete-audio-file', n.src);
            });
            if (pack.ambient) pack.ambient.forEach(a => {
                if (a.src && a.src.startsWith('file://')) window.electronAPI.invoke('delete-audio-file', a.src);
            });
        }
        // Remove from main soundPacks object
        delete soundPacks[packName];
        // Remove from customSoundPacks
        delete customSoundPacks[packName];
        await store.set('customSoundPacks', customSoundPacks);
        return true;
    }
    return false;
}
