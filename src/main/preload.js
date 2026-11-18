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
    'store-delete',
    'request-initial-timer-update',
    'show-os-notification'
];

// Whitelist of channels the renderer can LISTEN to from the main process
const ALLOWED_ON_CHANNELS = [
    'display-message',
    'set-theme',
    'init-timer',
    'update-timer-window',
    'pomo-popup-closed',
    'flow-popup-closed',
    'popup-closed',
    'timer-popup-closed',
    'fullscreen-closed',
    'set-fullscreen-data',
    'timer-tick',
    'update-display',
    'start-next-phase',
    'blocker-status',
    'blocker-error',
    'timer-event',
    'start-flow-state-from-dock',
    'pause-timer-from-dock',
    'request-initial-timer-update'
];

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^((([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}:[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){5}:([0-9A-Fa-f]{1,4}:)?)[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){4}:([0-9A-Fa-f]{1,4}:){0,2})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){3}:([0-9A-Fa-f]{1,4}:){0,3})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){2}:([0-9A-Fa-f]{1,4}:){0,4})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){1}:([0-9A-Fa-f]{1,4}:){0,5})[0-9A-Fa-f]{1,4}|(::([0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})|(::[0-9A-Fa-f]{1,4})|([0-9A-Fa-f]{1,4}::)|(::))(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/;

function sandboxSafeNormalizeHost(value) {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.trim();
    if (!cleaned || cleaned.length > 2048) return null;

    let hostname = null;
    try {
        let url = cleaned;
        if (!/^https?:\/\//i.test(url)) {
            url = `http://${url}`;
        }
        hostname = new URL(url).hostname.toLowerCase();
    } catch (e) {
        hostname = cleaned.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0].toLowerCase();
    }

    if (!hostname) return null;
    hostname = hostname.split(':')[0];
    if (hostname === 'localhost') return null;
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);

    if (!DOMAIN_REGEX.test(hostname) && !IP_REGEX.test(hostname)) {
        return null;
    }
    return hostname;
}

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
    normalizeHost: (val) => sandboxSafeNormalizeHost(val),
    platform: process.platform
});
