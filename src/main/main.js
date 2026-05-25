const { app, Notification, ipcMain } = require('electron');
const path = require('path');
const util = require('util');

// Set user data path to a local directory to avoid permission issues on this system.
app.setPath('userData', path.join(__dirname, '../../electron-data'));

// Services
const windowManager = require('./services/WindowManager');
let blockerService;
let timerService;
let healthService;
let ipcMainHandlers;

console.log('[Main Process] Starting modular SuperFokus...');

// Prevent multiple instances
const isTestMode = process.argv.includes('--no-single-instance');
if (!isTestMode) {
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
}

// app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
// app.commandLine.appendSwitch('disable-http-cache');

app.name = 'SuperFokus';

app.whenReady().then(async () => {
    // Set AppUserModelId for native notifications (Windows only)
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.superfokus.app');
    }
    
    ipcMain.on('show-os-notification', (event, { title, body }) => {
        if (Notification.isSupported()) {
            const options = { title, body };
            // Only apply icon and urgency to Windows; macOS can silently fail if the icon path is missing in Dev Mode.
            if (process.platform === 'win32') {
                options.icon = path.join(__dirname, '../../assets/fokusicon.png');
                options.urgency = 'critical';
            }
            
            new Notification(options).show();
        }
    });

    ipcMain.on('request-initial-timer-update', (event, type) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.broadcastToWindows('request-initial-timer-update', type);
    });

    // Initialize Services
    windowManager.createWindow();
    windowManager.createApplicationMenu();
    
    // Lazy load services
    blockerService = require('./services/BlockerService');
    timerService = require('./services/TimerService');
    healthService = require('./services/HealthService');
    ipcMainHandlers = require('./services/IpcMainHandlers');

    blockerService.init();
    timerService.init();
    healthService.init();
    await ipcMainHandlers.init();

    if (process.platform === 'darwin') {
        try { app.dock.setIcon(path.join(__dirname, '../../assets/fokusicon.png')); } catch (e) {}
        require('./services/MacOptimizationService').init(windowManager.mainWindow);
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
        // Do not use runElevated with UAC prompt on crash.
        // If possible, clear blocks un-elevated or just exit to prevent zombie processes.
        if (blockerService) {
            try { blockerService.stopProxy(); } catch (e) {}
        }
        process.exit(1);
    });

    app.on('activate', () => {
        if (!windowManager.mainWindow || windowManager.mainWindow.isDestroyed()) {
            windowManager.createWindow();
        } else {
            windowManager.mainWindow.show();
        }
    });

    // Handle signals for graceful shutdown (useful for VS Code debugging)
    const handleSignal = (signal) => {
        console.log(`[Main Process] Received ${signal}, initiating cleanup...`);
        app.quit();
    };
    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

}).catch(err => {
    console.error('CRITICAL STARTUP ERROR:', err);
});

// Lifecycle handling
app.on('before-quit', () => {
    windowManager.setQuitting(true);
});

let isClearingOnQuit = false;
app.on('will-quit', (e) => {
    if (timerService) timerService.cleanup();
    if (healthService) healthService.cleanup();

    if (blockerService && blockerService.getBlocksApplied() && !isClearingOnQuit) {
        e.preventDefault();
        isClearingOnQuit = true;
        blockerService.cleanup(() => {
            app.quit();
        });
    } else if (blockerService) {
        blockerService.cleanup();
    }
});

app.on('window-all-closed', () => {
    // Handled by tray/isQuitting
});
