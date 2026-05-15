const { app } = require('electron');
const path = require('path');
const util = require('util');

// Services
const windowManager = require('./services/WindowManager');
const blockerService = require('./services/BlockerService');
const timerService = require('./services/TimerService');
const healthService = require('./services/HealthService');
const ipcMainHandlers = require('./services/IpcMainHandlers');

console.log('[Main Process] Starting modular SuperFokus...');

// Polyfills for sudo-prompt
if (typeof util.isObject !== 'function') {
    util.isObject = (obj) => obj !== null && typeof obj === 'object';
}
if (typeof util.isFunction !== 'function') {
    util.isFunction = (fn) => typeof fn === 'function';
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (windowManager.mainWindow) {
            if (windowManager.mainWindow.isMinimized()) windowManager.mainWindow.restore();
            windowManager.mainWindow.focus();
        }
    });
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

app.whenReady().then(() => {
    // Initialize Services
    windowManager.createWindow();
    windowManager.createApplicationMenu();
    
    blockerService.init();
    timerService.init();
    healthService.init();
    ipcMainHandlers.init();

    if (process.platform === 'darwin') {
        try { app.dock.setIcon(path.join(__dirname, '../../assets/fokusicon.png')); } catch (e) {}
    }

    // Startup Cleanup
    console.log('[Main Process] Calling runElevated for startup cleanup...');
    blockerService.runElevated('clear', [], (error) => {
        if (error) {
            console.log('[Startup] Failsafe check failed: ', error.message);
            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                windowManager.mainWindow.webContents.send('startup-cleanup-failed', error.message);
            }
        } else {
            console.log('[Startup] Checked and cleared zombie blocks.');
        }
    });

    process.on('uncaughtException', (err) => {
        console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
        blockerService.runElevated('clear', [], () => {
            process.exit(1);
        });
    });

    app.on('activate', () => {
        if (require('electron').BrowserWindow.getAllWindows().length === 0) {
            windowManager.createWindow();
        } else {
            windowManager.mainWindow.show();
        }
    });
}).catch(err => {
    console.error('CRITICAL STARTUP ERROR:', err);
});

// Lifecycle handling
app.on('before-quit', () => {
    windowManager.setQuitting(true);
});

let isClearingOnQuit = false;
app.on('will-quit', (e) => {
    timerService.cleanup();
    healthService.cleanup();

    if (blockerService.getBlocksApplied() && !isClearingOnQuit) {
        e.preventDefault();
        isClearingOnQuit = true;
        blockerService.cleanup(() => {
            app.quit();
        });
    } else {
        blockerService.cleanup();
    }
});

app.on('window-all-closed', () => {
    // Handled by tray/isQuitting
});
