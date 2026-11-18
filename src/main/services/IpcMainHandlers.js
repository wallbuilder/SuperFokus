const { ipcMain, app, Notification, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const windowManager = require('./WindowManager');

let store = null;
let storeInitPromise = null;

async function initStore() {
    if (store) return store;
    if (!storeInitPromise) {
        storeInitPromise = (async () => {
            try {
                await fs.promises.mkdir(app.getPath('userData'), { recursive: true });
                const { default: Store } = await import('electron-store');
                store = new Store();
                return store;
            } catch (err) {
                console.error('[Main] Failed to initialize electron-store:', err);
                return null;
            }
        })();
    }
    return storeInitPromise;
}

const MAX_STORE_VALUE_SIZE = 1024 * 1024; // 1MB limit
const FORBIDDEN_STORE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
const MAX_AUDIO_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit

function validateStoreKey(key) {
    if (!key || typeof key !== 'string' || key.length > 128) {
        throw new Error('Store key must be a non-empty string (<= 128 chars)');
    }
    if (FORBIDDEN_STORE_KEYS.has(key)) {
        throw new Error('Forbidden store key');
    }
    return true;
}

function validateStoreValue(key, value) {
    validateStoreKey(key);
    if (value === undefined) {
        throw new Error('Store value cannot be undefined');
    }
    const serialized = JSON.stringify(value) || '';
    if (serialized.length > MAX_STORE_VALUE_SIZE) {
        throw new Error(`Store value for key "${key}" exceeds maximum size of ${MAX_STORE_VALUE_SIZE} bytes`);
    }
    return true;
}

function isPathInsideDir(targetPath, parentDir) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedParent = path.resolve(parentDir);
    const prefix = resolvedParent.endsWith(path.sep) ? resolvedParent : resolvedParent + path.sep;
    if (process.platform === 'win32' || process.platform === 'darwin') {
        return resolvedTarget.toLowerCase().startsWith(prefix.toLowerCase());
    }
    return resolvedTarget.startsWith(prefix);
}

async function init() {
    ipcMain.on('store-set', async (event, key, value) => {
        if (!windowManager.isOriginSafe(event)) return;
        try {
            validateStoreValue(key, value);
            const activeStore = store || await initStore();
            if (activeStore) activeStore.set(key, value);
        } catch (err) {
            console.error('[IpcMainHandlers] Store validation error:', err.message);
        }
    });

    ipcMain.on('store-set-multiple', async (event, dataObj) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (dataObj && typeof dataObj === 'object' && !Array.isArray(dataObj)) {
            const activeStore = store || await initStore();
            if (!activeStore) return;
            for (const [key, value] of Object.entries(dataObj)) {
                try {
                    validateStoreValue(key, value);
                    activeStore.set(key, value);
                } catch (err) {
                    console.error('[IpcMainHandlers] Store validation error for key ' + key + ':', err.message);
                }
            }
        }
    });

    ipcMain.handle('store-get', async (event, key, defaultValue) => {
        if (!windowManager.isOriginSafe(event)) return defaultValue;
        try {
            validateStoreKey(key);
            const activeStore = store || await initStore();
            return activeStore ? activeStore.get(key, defaultValue) : defaultValue;
        } catch (err) {
            return defaultValue;
        }
    });

    ipcMain.on('store-delete', async (event, key) => {
        if (!windowManager.isOriginSafe(event)) return;
        try {
            validateStoreKey(key);
            const activeStore = store || await initStore();
            if (activeStore) activeStore.delete(key);
        } catch (err) {
            console.error('[IpcMainHandlers] Store delete validation error:', err.message);
        }
    });

    ipcMain.on('theme-changed', (event, themeData) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.setTheme(themeData);
    });

    ipcMain.on('show-popup', (event, payload) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (typeof payload === 'object' && payload !== null) {
            windowManager.createPopupWindow(
                payload.message,
                payload.closeDelay || 10000,
                payload.healthType || null,
                payload.isAutoclose || false,
                null,
                payload.type || null,
                payload.popupIndex ?? 0,
                payload.totalPopups ?? 1
            );
        } else {
            windowManager.createPopupWindow(payload, 10000, null, true);
        }
    });

    ipcMain.on('close-popup', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.mainWindow && event.sender === windowManager.mainWindow.webContents) {
            windowManager.closeAllPopups();
        } else {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && !win.isDestroyed()) {
                win.close();
            }
        }
    });

    // Generic Timer Handlers
    ipcMain.on('open-timer-window', (event, type) => {
        if (!windowManager.isOriginSafe(event)) return;
        const hideTimer = store ? store.get('hide-timer-all-modes', false) : false;
        if (hideTimer) return;
        if (type === 'pomo') windowManager.createPomoTimerWindow();
        else if (type === 'sprint') windowManager.createMicroSprintTimerWindow();
        else if (type === 'flow') windowManager.createFlowTimerWindow();
    });

    ipcMain.on('update-timer-window', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.webContents.send('update-timer-window', data);
        }
    });

    ipcMain.on('close-timer-window', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.close();
        }
    });

    ipcMain.on('next-phase-triggered', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
            windowManager.mainWindow.webContents.send('start-next-phase');
        }
    });

    ipcMain.handle('save-audio-file', async (event, fileName, arrayBuffer) => {
        if (!windowManager.isOriginSafe(event)) return null;
        if (typeof fileName !== 'string' || !fileName.trim()) return null;
        if (!arrayBuffer || (arrayBuffer.byteLength !== undefined && arrayBuffer.byteLength > MAX_AUDIO_FILE_SIZE)) {
            return null;
        }
        const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._ -]/g, '_');
        const ext = path.extname(safeFileName).toLowerCase();
        if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
            console.warn('[IpcMainHandlers] Rejected audio upload with disallowed extension:', ext);
            return null;
        }
        const soundsDir = path.resolve(app.getPath('userData'), 'sounds');
        await fs.promises.mkdir(soundsDir, { recursive: true });
        const filePath = path.resolve(soundsDir, safeFileName);
        if (!isPathInsideDir(filePath, soundsDir)) {
            return null;
        }
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > MAX_AUDIO_FILE_SIZE) return null;
        await fs.promises.writeFile(filePath, buffer);
        return `file://${filePath.replace(/\\/g, '/')}`;
    });

    ipcMain.handle('delete-audio-file', async (event, fileUrl) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (typeof fileUrl !== 'string' || !fileUrl.startsWith('file://')) return;
        try {
            const soundsDir = path.resolve(app.getPath('userData'), 'sounds');
            let candidatePath;
            try {
                candidatePath = fileURLToPath(fileUrl);
            } catch {
                candidatePath = decodeURI(fileUrl.replace(/^file:\/\/\/?/, ''));
            }
            const resolvedPath = path.resolve(candidatePath);
            if (!isPathInsideDir(resolvedPath, soundsDir)) {
                console.warn('[IpcMainHandlers] Blocked path traversal attempt in delete-audio-file:', fileUrl);
                return;
            }
            await fs.promises.unlink(resolvedPath);
        } catch (e) {}
    });

    ipcMain.on('blocker-expand-fullscreen', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createFullscreenWindow(data);
    });

    await initStore();
}

module.exports = {
    init
};
