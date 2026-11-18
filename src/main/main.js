const { app, Notification, ipcMain, session } = require('electron');
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
                if (!windowManager.mainWindow.isVisible()) {
                    windowManager.mainWindow.show();
                }
                if (windowManager.mainWindow.isMinimized()) windowManager.mainWindow.restore();
                windowManager.mainWindow.focus();
            }
        });
    }
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

app.name = 'SuperFokus';

app.whenReady().then(async () => {
    // Set AppUserModelId for native notifications (Windows only)
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.superfokus.app');
    }

    // Enforce strict permission handling (only allow notifications from safe local origins)
    if (session && session.defaultSession) {
        const ALLOWED_PERMISSIONS = new Set(['notifications']);
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const url = webContents ? webContents.getURL() : '';
            const isLocalFile = url.startsWith('file://');
            callback(isLocalFile && ALLOWED_PERMISSIONS.has(permission));
        });
        session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
            const isLocalFile = typeof requestingOrigin === 'string' && requestingOrigin.startsWith('file://');
            return isLocalFile && ALLOWED_PERMISSIONS.has(permission);
        });
    }
    
    ipcMain.on('show-os-notification', (event, payload) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (!payload || typeof payload !== 'object') return;
        const title = typeof payload.title === 'string' ? payload.title.slice(0, 200) : 'SuperFokus';
        const body = typeof payload.body === 'string' ? payload.body.slice(0, 1000) : '';
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
        if (typeof type !== 'string' || type.length > 32) return;
        windowManager.broadcastToWindows('request-initial-timer-update', type);
    });

    // Load and initialize core IPC and background services BEFORE creating the window
    // so renderer startup requests never race against uninitialized handlers or stores.
    blockerService = require('./services/BlockerService');
    timerService = require('./services/TimerService');
    healthService = require('./services/HealthService');
    ipcMainHandlers = require('./services/IpcMainHandlers');

    timerService.init();
    healthService.init();
    await Promise.all([
        ipcMainHandlers.init(),
        blockerService.init()
    ]);

    // Initialize Window & Menu after IPC handlers and stores are ready
    windowManager.createWindow();
    windowManager.createApplicationMenu();

    if (process.platform === 'darwin') {
        try { app.dock.setIcon(path.join(__dirname, '../../assets/fokusicon.png')); } catch (e) {}
        require('./services/MacOptimizationService').init(windowManager.mainWindow);
    }

    process.on('uncaughtException', (err) => {
        console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
        // Do not use runElevated with UAC prompt on crash.
        // If possible, clear blocks un-elevated or just exit to prevent zombie processes.
        if (blockerService) {
            try { blockerService.stopProxy(); } catch (e) {}
            try { 
                if (process.platform === 'darwin') {
                    blockerService.setMacProxy(false); 
                }
            } catch (e) {}
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

// Most of this code is generated by AI