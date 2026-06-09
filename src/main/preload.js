const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of channels the renderer can SEND to the main process
const ALLOWED_SEND_CHANNELS = [
    'theme-changed',
    'start-timer',
    'stop-timer',
    'pause-timer',
    'resume-timer',
    'show-popup',
    'close-popup',
    'open-timer-window',
    'update-timer-window',
    'close-timer-window',
    'show-break-popup',
    'close-fullscreen',
    'next-phase-triggered',
    'blocker-show-popup',
    'blocker-expand-fullscreen',
    'blocker-start',
    'blocker-stop',
    'update-blocker-rules',
    'clear-all-blocks',
    'start-health-mode',
    'stop-health-mode',
    'store-set',
    'store-set-multiple',
    'store-delete'
];

// Whitelist of channels the renderer can LISTEN to from the main process
const ALLOWED_ON_CHANNELS = [
    'display-message',
    'set-theme',
    'init-timer',
    'update-timer-window',
    'pomo-popup-closed',
    'flow-popup-closed',
    'set-fullscreen-data',
    'timer-tick',
    'update-display',
    'start-next-phase',
    'blocker-status',
    'blocker-error',
    'timer-event',
    'start-flow-state-from-dock',
    'pause-timer-from-dock'
];

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        if (ALLOWED_SEND_CHANNELS.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.warn(`Blocked unauthorized IPC send on channel: ${channel}`);
        }
    },
    on: (channel, func) => {
        if (ALLOWED_ON_CHANNELS.includes(channel)) {
            const listener = (event, ...args) => func(...args);
            ipcRenderer.on(channel, listener);
            return () => {
                ipcRenderer.removeListener(channel, listener);
            };
        } else {
            console.warn(`Blocked unauthorized IPC listener registration on channel: ${channel}`);
            return () => {};
        }
    },
    off: (channel, wrappedFunc) => {
        if (ALLOWED_ON_CHANNELS.includes(channel)) {
            if (wrappedFunc) {
                ipcRenderer.removeListener(channel, wrappedFunc);
            }
        } else {
            console.warn(`Blocked unauthorized IPC listener removal on channel: ${channel}`);
        }
    },
    invoke: (channel, ...args) => {
        if (['store-get', 'save-audio-file', 'delete-audio-file'].includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
    },
    store: {
        get: (key, defaultValue) => ipcRenderer.invoke('store-get', key, defaultValue),
        set: (key, value) => ipcRenderer.send('store-set', key, value),
        setMultiple: (dataObj) => ipcRenderer.send('store-set-multiple', dataObj),
        delete: (key) => ipcRenderer.send('store-delete', key)
    },
    normalizeHost: (val) => {
       const { normalizeHost } = require('../utils/url-utils.js');
       return normalizeHost(val);
    },    platform: process.platform
});
