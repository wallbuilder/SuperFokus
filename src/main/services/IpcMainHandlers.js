const { ipcMain, app, Notification, BrowserWindow } = require('electron');
const path = require('path');
const windowManager = require('./WindowManager');

let store = null;

async function initStore() {
    try {
        const { default: Store } = await import('electron-store');
        store = new Store();
    } catch (err) {
        console.error('[Main] Failed to initialize electron-store:', err);
    }
}

const MAX_STORE_VALUE_SIZE = 1024 * 1024; // 1MB limit

function validateStoreValue(key, value) {
    if (!key || typeof key !== 'string') {
        throw new Error('Store key must be a non-empty string');
    }
    
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_STORE_VALUE_SIZE) {
        throw new Error(`Store value for key "${key}" exceeds maximum size of ${MAX_STORE_VALUE_SIZE} bytes`);
    }
    
    return true;
}

async function init() {
    await initStore();

    ipcMain.on('store-set', (event, key, value) => {
        if (!windowManager.isOriginSafe(event)) return;
        try {
            validateStoreValue(key, value);
            if (store) store.set(key, value);
        } catch (err) {
            console.error('[IpcMainHandlers] Store validation error:', err.message);
        }
    });

    ipcMain.on('store-set-multiple', (event, dataObj) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (store && typeof dataObj === 'object') {
            for (const [key, value] of Object.entries(dataObj)) {
                try {
                    validateStoreValue(key, value);
                    store.set(key, value);
                } catch (err) {
                    console.error('[IpcMainHandlers] Store validation error for key ' + key + ':', err.message);
                }
            }
        }
    });

    ipcMain.handle('store-get', async (event, key, defaultValue) => {
        if (!windowManager.isOriginSafe(event)) return defaultValue;
        return store ? store.get(key, defaultValue) : defaultValue;
    });

    ipcMain.on('store-delete', (event, key) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (store) store.delete(key);
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
        const safeFileName = path.basename(fileName);
        const soundsDir = path.join(app.getPath('userData'), 'sounds');
        await require('fs').promises.mkdir(soundsDir, { recursive: true });
        const filePath = path.join(soundsDir, safeFileName);
        await require('fs').promises.writeFile(filePath, Buffer.from(arrayBuffer));
        return `file://${filePath.replace(/\\/g, '/')}`;
    });

    ipcMain.handle('delete-audio-file', async (event, fileUrl) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (fileUrl.startsWith('file://')) {
            const filePath = decodeURI(fileUrl.replace('file://', ''));
            if (filePath.includes('sounds')) {
                try {
                    await require('fs').promises.unlink(filePath);
                } catch (e) {}
            }
        }
    });

    ipcMain.on('blocker-expand-fullscreen', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createFullscreenWindow(data);
    });
}

module.exports = {
    init
};
