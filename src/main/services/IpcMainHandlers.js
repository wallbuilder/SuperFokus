const { ipcMain, app } = require('electron');
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

function init() {
    initStore();

    ipcMain.on('store-set', (event, key, value) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (store) store.set(key, value);
    });

    ipcMain.handle('store-get', async (event, key, defaultValue) => {
        if (!windowManager.isOriginSafe(event)) return defaultValue;
        return store ? store.get(key, defaultValue) : defaultValue;
    });

    ipcMain.on('store-delete', (event, key) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (store) store.delete(key);
    });

    ipcMain.on('theme-changed', (event, isDark) => {
        windowManager.setTheme(isDark);
    });

    ipcMain.on('show-popup', (event, payload) => {
        if (typeof payload === 'object' && payload !== null) {
            windowManager.createPopupWindow(payload.message, payload.closeDelay || 10000, payload.healthType || null, true);
        } else {
            windowManager.createPopupWindow(payload, 10000, null, true);
        }
    });

    ipcMain.on('close-popup', () => {
        if (windowManager.popupWindow && !windowManager.popupWindow.isDestroyed()) {
            windowManager.popupWindow.close();
        }
    });

    ipcMain.on('open-pomo-timer', () => {
        windowManager.createPomoTimerWindow();
    });

    ipcMain.on('update-pomo-timer', (event, data) => {
        if (windowManager.pomoTimerWindow && !windowManager.pomoTimerWindow.isDestroyed()) {
            windowManager.pomoTimerWindow.webContents.send('update-display', data);
        }
    });

    ipcMain.on('close-pomo-timer', () => {
        if (windowManager.pomoTimerWindow && !windowManager.pomoTimerWindow.isDestroyed()) {
            windowManager.pomoTimerWindow.close();
        }
    });

    ipcMain.on('open-micro-sprint-timer', () => {
        windowManager.createMicroSprintTimerWindow();
    });

    ipcMain.on('update-micro-sprint-timer', (event, data) => {
        if (windowManager.microSprintTimerWindow && !windowManager.microSprintTimerWindow.isDestroyed()) {
            windowManager.microSprintTimerWindow.webContents.send('update-display', data);
        }
    });

    ipcMain.on('close-micro-sprint-timer', () => {
        if (windowManager.microSprintTimerWindow && !windowManager.microSprintTimerWindow.isDestroyed()) {
            windowManager.microSprintTimerWindow.close();
        }
    });

    ipcMain.on('open-flow-timer', () => {
        windowManager.createFlowTimerWindow();
    });

    ipcMain.on('update-flow-timer', (event, data) => {
        if (windowManager.flowTimerWindow && !windowManager.flowTimerWindow.isDestroyed()) {
            windowManager.flowTimerWindow.webContents.send('update-display', data);
        }
    });

    ipcMain.on('close-flow-timer', () => {
        if (windowManager.flowTimerWindow && !windowManager.flowTimerWindow.isDestroyed()) {
            windowManager.flowTimerWindow.close();
        }
    });

    ipcMain.on('next-phase-triggered', () => {
        if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
            windowManager.mainWindow.webContents.send('start-next-phase');
        }
    });
}

module.exports = {
    init
};
