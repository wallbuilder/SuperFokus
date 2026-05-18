const { ipcMain, app, Notification } = require('electron');
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

    ipcMain.on('theme-changed', (event, themeData) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.setTheme(themeData);
    });

    ipcMain.on('show-notification', (event, payload) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (Notification.isSupported()) {
            new Notification({
                title: payload.title,
                body: payload.body,
                silent: true
            }).show();
        }
    });

    ipcMain.on('show-popup', (event, payload) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (typeof payload === 'object' && payload !== null) {
            windowManager.createPopupWindow(payload.message, payload.closeDelay || 10000, payload.healthType || null, true);
        } else {
            windowManager.createPopupWindow(payload, 10000, null, true);
        }
    });

    ipcMain.on('close-popup', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.popupWindow && !windowManager.popupWindow.isDestroyed()) {
            windowManager.popupWindow.close();
        }
    });

    ipcMain.on('open-pomo-timer', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createPomoTimerWindow();
    });

    ipcMain.on('update-pomo-timer', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.webContents.send('update-display', data);
        }
    });

    ipcMain.on('close-pomo-timer', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.close();
        }
    });

    ipcMain.on('open-micro-sprint-timer', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createMicroSprintTimerWindow();
    });

    ipcMain.on('update-micro-sprint-timer', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.webContents.send('update-display', data);
        }
    });

    ipcMain.on('close-micro-sprint-timer', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.close();
        }
    });

    ipcMain.on('open-flow-timer', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createFlowTimerWindow();
    });

    ipcMain.on('update-flow-timer', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (windowManager.timerWindow && !windowManager.timerWindow.isDestroyed()) {
            windowManager.timerWindow.webContents.send('update-display', data);
        }
    });

    ipcMain.on('close-flow-timer', (event) => {
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

    ipcMain.on('blocker-expand-fullscreen', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createFullscreenWindow(data);
    });
}

module.exports = {
    init
};
