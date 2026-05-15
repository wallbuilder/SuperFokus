const { BrowserWindow, screen, Menu, app, shell } = require('electron');
const path = require('path');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.popupWindow = null;
        this.timerWindow = null;
        this.fullscreenWindow = null;
        this.isQuitting = false;
        this.currentThemeIsDark = false;
        this.currentPopupIsBlocking = false;
        this.isFocusLocked = false;
        this.canCloseFullscreen = () => true;
    }

    setFocusLock(locked) {
        this.isFocusLocked = locked;
    }

    setFullscreenClosureCheck(checker) {
        this.canCloseFullscreen = checker;
    }

    setQuitting(val) {
        this.isQuitting = val;
    }

    setTheme(isDark) {
        this.currentThemeIsDark = isDark;
        this.broadcastToWindows('set-theme', isDark);
    }

    isOriginSafe(event) {
        try {
            if (!event || !event.senderFrame || !event.senderFrame.url) return false;
            return new URL(event.senderFrame.url).protocol === 'file:';
        } catch (e) {
            return false;
        }
    }

    isSafeExternalUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    setupNavigationHandlers(window) {
        if (!window) return;
        
        window.webContents.setWindowOpenHandler(({ url }) => {
            if (this.isSafeExternalUrl(url)) {
                shell.openExternal(url);
            }
            return { action: 'deny' };
        });

        window.webContents.on('will-navigate', (event, url) => {
            if (!this.isSafeExternalUrl(url)) {
                event.preventDefault();
            } else {
                event.preventDefault();
                shell.openExternal(url);
            }
        });
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 900,
            height: 700,
            show: false,
            icon: path.join(__dirname, '../../../assets/fokusicon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload.js'),
            },
        });

        this.mainWindow.maximize();
        this.mainWindow.loadFile(path.join(__dirname, '../../../index.html'));

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        this.setupNavigationHandlers(this.mainWindow);

        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.mainWindow.hide();
            }
        });

        return this.mainWindow;
    }

    createApplicationMenu() {
        const template = [
            {
                label: 'SuperFokus',
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: 'Command+Q',
                        click: () => {
                            this.isQuitting = true;
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectAll' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    createPopupWindow(message, autoDismissMs = 10000, healthType = null, isAutoclose = false, healthConfig = null) {
        const isBlocking = healthType && healthConfig && healthConfig.blockingMode === 'fullscreen';

        if (this.popupWindow && this.currentPopupIsBlocking !== isBlocking) {
            this.popupWindow.destroy();
            this.popupWindow = null;
        }

        if (this.popupWindow && !this.popupWindow.isDestroyed()) {
            this.popupWindow.show();
            this.popupWindow.webContents.send('display-message', {
                message,
                closeDelay: autoDismissMs,
                healthType,
                isBlocking,
                isAutoclose
            });
        } else {
            if (isBlocking) {
                this.popupWindow = new BrowserWindow({
                    width: screen.getPrimaryDisplay().workAreaSize.width,
                    height: screen.getPrimaryDisplay().workAreaSize.height,
                    x: 0,
                    y: 0,
                    alwaysOnTop: true,
                    frame: false,
                    fullscreen: false,
                    resizable: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, '../preload.js'),
                    },
                });
                this.currentPopupIsBlocking = true;
            } else {
                this.popupWindow = new BrowserWindow({
                    width: 500,
                    height: 350,
                    alwaysOnTop: true,
                    frame: true,
                    resizable: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, '../preload.js'),
                    },
                });
                this.currentPopupIsBlocking = false;
            }

            this.setupNavigationHandlers(this.popupWindow);
            this.popupWindow.loadFile(path.join(__dirname, '../../renderer/ui/popup.html'));
            
            this.popupWindow.webContents.on('did-finish-load', () => {
                this.popupWindow.webContents.send('set-theme', this.currentThemeIsDark);
                if (process.platform === 'darwin') {
                    try {
                        this.popupWindow.setAlwaysOnTop(true, 'floating');
                        this.popupWindow.setVisibleOnAllWorkspaces(true);
                        this.popupWindow.setFullScreenable(false);
                    } catch (e) {
                        console.warn('Mac popup window tuning failed', e);
                    }
                }

                this.popupWindow.webContents.send('display-message', {
                    message,
                    closeDelay: autoDismissMs,
                    healthType,
                    isBlocking,
                    isAutoclose
                });
            });

            this.popupWindow.on('close', (e) => {
                if (!this.isQuitting) {
                    e.preventDefault();
                    this.popupWindow.hide();
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('popup-closed');
                    }
                }
            });

            this.popupWindow.on('blur', () => {
                // This will be handled by the blocker service if macBlockActive is needed
            });
        }
        
        if (autoDismissMs > 0) {
            setTimeout(() => {
                try {
                    if (this.popupWindow && !this.popupWindow.isDestroyed()) {
                        this.popupWindow.close();
                    }
                } catch (err) {}
            }, autoDismissMs);
        }
    }

    _createTimerWindow(type) {
        const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
        const windowWidth = 400;
        const windowHeight = 250;
        const x = screenX;
        const y = screenY + screenHeight - windowHeight;

        if (this.timerWindow && !this.timerWindow.isDestroyed()) {
            this.timerWindow.setPosition(x, y);
            this.timerWindow.setSize(windowWidth, windowHeight);
            this.timerWindow.show();
            this.timerWindow.webContents.send('set-theme', this.currentThemeIsDark);
            this.timerWindow.webContents.send('init-timer', type);
            return this.timerWindow;
        }

        this.timerWindow = new BrowserWindow({
            width: windowWidth,
            height: windowHeight,
            x: x,
            y: y,
            alwaysOnTop: true,
            frame: true,
            resizable: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload.js')
            },
        });

        this.setupNavigationHandlers(this.timerWindow);

        try {
            this.timerWindow.setAlwaysOnTop(true, 'floating');
            this.timerWindow.setVisibleOnAllWorkspaces(true);
            this.timerWindow.setFullScreenable(false);
        } catch (e) {
            console.warn('Timer window tuning failed', e);
        }

        this.timerWindow.loadFile(path.join(__dirname, '../../renderer/ui/timer-window.html'));

        this.timerWindow.webContents.on('did-finish-load', () => {
            this.timerWindow.webContents.send('set-theme', this.currentThemeIsDark);
            this.timerWindow.webContents.send('init-timer', type);
        });

        this.timerWindow.on('close', (e) => {
            if (!this.isQuitting) {
                e.preventDefault();
                this.timerWindow.hide();
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('timer-popup-closed');
                }
            }
        });

        return this.timerWindow;
    }

    createPomoTimerWindow() { return this._createTimerWindow('pomo'); }
    createMicroSprintTimerWindow() { return this._createTimerWindow('sprint'); }
    createFlowTimerWindow() { return this._createTimerWindow('flow'); }

    createFullscreenWindow(data) {
        if (this.fullscreenWindow && !this.fullscreenWindow.isDestroyed()) {
            if (process.platform === 'darwin') {
                try {
                    this.fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                    this.fullscreenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                } catch (e) {}
            }
            
            this.fullscreenWindow.openedAt = Date.now();
            this.fullscreenWindow.show();
            try { this.fullscreenWindow.focus(); } catch (e) {}
            this.fullscreenWindow.webContents.send('set-fullscreen-data', data);
            return;
        }

        const windowConfig = {
            alwaysOnTop: true,
            frame: false,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload.js')
            },
        };

        if (process.platform === 'darwin') {
            windowConfig.simpleFullscreen = true;
            windowConfig.fullscreen = true;
            windowConfig.kiosk = false;
        } else {
            windowConfig.fullscreen = true;
            windowConfig.kiosk = true;
        }

        this.fullscreenWindow = new BrowserWindow(windowConfig);
        this.setupNavigationHandlers(this.fullscreenWindow);
        this.fullscreenWindow.openedAt = Date.now();

        this.fullscreenWindow.once('ready-to-show', () => {
            this.fullscreenWindow.show();
            try { this.fullscreenWindow.focus(); } catch (e) {}
            
            if (process.platform === 'darwin') {
                try {
                    this.fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                    this.fullscreenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                } catch (e) {
                    console.warn('Mac fullscreen window tuning failed', e);
                }
            }
        });

        this.fullscreenWindow.loadFile(path.join(__dirname, '../../renderer/ui/fullscreen-popup.html'));

        this.fullscreenWindow.webContents.on('did-finish-load', () => {
            this.fullscreenWindow.webContents.send('set-fullscreen-data', data);
        });

        this.fullscreenWindow.on('close', (e) => {
            if (!this.isQuitting) {
                if (!this.fullscreenWindow.forceClose) {
                    if (!this.canCloseFullscreen()) {
                        e.preventDefault();
                        return;
                    }
                }

                if (process.platform === 'darwin') {
                    try { this.fullscreenWindow.setKiosk(false); } catch (e) {}
                    try { this.fullscreenWindow.setAlwaysOnTop(false); } catch (e) {}
                    try { this.fullscreenWindow.setSimpleFullScreen(false); } catch (e) {}
                }

                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('popup-closed');
                    this.mainWindow.webContents.send('fullscreen-closed');
                    this.mainWindow.show();
                }
                
                this.fullscreenWindow = null;
            }
        });

        this.fullscreenWindow.on('blur', () => {
            if (!this.isQuitting && this.fullscreenWindow && !this.fullscreenWindow.forceClose) {
                try {
                    this.fullscreenWindow.focus();
                    if (process.platform === 'darwin') {
                        this.fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                    } else {
                        this.fullscreenWindow.setAlwaysOnTop(true);
                    }
                } catch (e) {}
            }
        });

        this.fullscreenWindow.on('minimize', () => {
            if (!this.isQuitting && this.fullscreenWindow && !this.fullscreenWindow.forceClose) {
                try { this.fullscreenWindow.restore(); this.fullscreenWindow.focus(); } catch (e) {}
            }
        });
        this.fullscreenWindow.on('hide', () => {
            if (!this.isQuitting && this.fullscreenWindow && !this.fullscreenWindow.forceClose) {
                try { this.fullscreenWindow.show(); this.fullscreenWindow.focus(); } catch (e) {}
            }
        });
    }

    forceKillFullscreen() {
        if (this.fullscreenWindow && !this.fullscreenWindow.isDestroyed()) {
            this.fullscreenWindow.forceClose = true;
            
            if (process.platform === 'darwin') {
                try { this.fullscreenWindow.setKiosk(false); } catch (e) {}
                try { this.fullscreenWindow.setAlwaysOnTop(false); } catch (e) {}
                try { this.fullscreenWindow.setSimpleFullScreen(false); } catch (e) {}
            }

            this.fullscreenWindow.destroy(); 
            this.fullscreenWindow = null;
            
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('popup-closed');
                this.mainWindow.webContents.send('fullscreen-closed');
                this.mainWindow.show();
            }
        }
    }

    broadcastToWindows(channel, ...args) {
        const windows = [
            this.mainWindow,
            this.timerWindow,
            this.fullscreenWindow,
            this.popupWindow
        ];

        const targetTimerId = (channel === 'timer-tick' || channel.startsWith('timer-')) ? args[0]?.id || args[0] : null;

        windows.forEach(win => {
            if (win && !win.isDestroyed()) {
                if (targetTimerId && win === this.timerWindow) {
                    // Filter events for the consolidated timer window
                    // We only want to send events that match the current type of the timer window
                    // This is a bit tricky since we don't track the type here directly.
                    // But we can just send everything and let the timer-window.js filter it.
                }
                win.webContents.send(channel, ...args);
            }
        });
    }
}

module.exports = new WindowManager();
