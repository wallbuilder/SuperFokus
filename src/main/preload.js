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
    'open-pomo-timer',
    'update-pomo-timer',
    'close-pomo-timer',
    'open-micro-sprint-timer',
    'update-micro-sprint-timer',
    'close-micro-sprint-timer',
    'open-flow-timer',
    'update-flow-timer',
    'close-flow-timer',
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
    'store-set'
];

// Whitelist of channels the renderer can LISTEN to from the main process
const ALLOWED_ON_CHANNELS = [
    'display-message',
    'set-theme',
    'pomo-popup-closed',
    'flow-popup-closed',
    'set-fullscreen-data',
    'timer-tick',
    'update-display',
    'start-next-phase',
    'blocker-status',
    'blocker-error'
];

// Prefix-based whitelist for dynamic timer channels
const TIMER_PREFIXES = [
    'timer-complete-',
    'timer-started-',
    'timer-stopped-',
    'timer-paused-',
    'timer-resumed-'
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
        const isTimerChannel = TIMER_PREFIXES.some(prefix => channel.startsWith(prefix));
        if (ALLOWED_ON_CHANNELS.includes(channel) || isTimerChannel) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        } else {
            console.warn(`Blocked unauthorized IPC listener registration on channel: ${channel}`);
        }
    },
    invoke: (channel, ...args) => {
        if (['store-get'].includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
    },
    store: {
        get: (key, defaultValue) => ipcRenderer.invoke('store-get', key, defaultValue),
        set: (key, value) => ipcRenderer.send('store-set', key, value),
        delete: (key) => ipcRenderer.send('store-delete', key)
    },
    normalizeHost: (val) => {
        // Simple bridge for host normalization
        const { normalizeHost } = require('../renderer/utils/utils.js');
        return normalizeHost(val);
    },
    platform: process.platform
});
