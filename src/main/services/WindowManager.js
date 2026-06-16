const { BrowserWindow, screen, Menu, app, shell } = require('electron');
const path = require('path');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.popupWindow = null;
        this.popupWindows = new Set();
        this.timerWindow = null;
        this.fullscreenWindow = null;
        this.isQuitting = false;
        this.currentThemeData = { mode: 'light', isDark: false };
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

    setTheme(themeData) {
        this.currentThemeData = themeData;
        this.broadcastToWindows('set-theme', themeData);
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

    _createWindow(options = {}) {
        const defaultOptions = {
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, '../preload.js'),
            },
        };

        const win = new BrowserWindow({ ...defaultOptions, ...options });
        this.setupNavigationHandlers(win);
        return win;
    }

    createWindow() {
        const windowOptions = {
            width: 900,
            height: 700,
            show: false,
            icon: path.join(__dirname, '../../../assets/fokusicon.png'),
        };

        if (process.platform === 'darwin') {
            windowOptions.vibrancy = 'under-window';
            windowOptions.titleBarStyle = 'hiddenInset';
            windowOptions.transparent = true;
        }

        this.mainWindow = this._createWindow(windowOptions);

        this.mainWindow.maximize();
        this.mainWindow.loadFile(path.join(__dirname, '../../../index.html'));

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

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

    createPopupWindow(message, autoDismissMs = 10000, healthType = null, isAutoclose = false, healthConfig = null, popupType = null, popupIndex = 0, totalPopups = 1) {
        const isBlocking = healthType && healthConfig && healthConfig.blockingMode === 'fullscreen';
        let targetWin = null;
        let shouldReuse = false;

        if (this.popupWindow && !this.popupWindow.isDestroyed() && popupType !== 'Repeating Reminder' && this.currentPopupIsBlocking === isBlocking) {
            shouldReuse = true;
            targetWin = this.popupWindow;
        }

        if (shouldReuse) {
            targetWin.show();
            targetWin.webContents.send('display-message', {
                message,
                closeDelay: autoDismissMs,
                healthType,
                isBlocking,
                isAutoclose
            });
        } else {
            if (this.popupWindow && !this.popupWindow.isDestroyed() && this.currentPopupIsBlocking !== isBlocking && popupType !== 'Repeating Reminder') {
                this.popupWindow.destroy();
                this.popupWindow = null;
            }

            let winOptions = {
                width: 500,
                height: 350,
                alwaysOnTop: true,
                frame: true,
                resizable: false,
            };

            if (isBlocking) {
                winOptions.width = screen.getPrimaryDisplay().workAreaSize.width;
                winOptions.height = screen.getPrimaryDisplay().workAreaSize.height;
                winOptions.x = 0;
                winOptions.y = 0;
                winOptions.frame = false;
                winOptions.fullscreen = false;
                winOptions.resizable = false;
                this.currentPopupIsBlocking = true;
            } else {
                this.currentPopupIsBlocking = false;
                if (popupType === 'Repeating Reminder' && totalPopups > 1 && popupIndex > 0) {
                    const targetDisplay = screen.getPrimaryDisplay();
                    const { x: workX, y: workY, width: workWidth, height: workHeight } = targetDisplay.workArea;
                    const maxX = workX + workWidth - 500;
                    const maxY = workY + workHeight - 350;
                    winOptions.x = maxX > workX ? Math.floor(workX + Math.random() * (maxX - workX)) : workX;
                    winOptions.y = maxY > workY ? Math.floor(workY + Math.random() * (maxY - workY)) : workY;
                }
            }

            targetWin = this._createWindow(winOptions);

            if (!this.popupWindows) {
                this.popupWindows = new Set();
            }
            this.popupWindows.add(targetWin);

            if (popupType === 'Repeating Reminder') {
                targetWin.isRepeatingReminder = true;
            }

            if (!this.popupWindow || this.popupWindow.isDestroyed() || popupIndex === 0) {
                this.popupWindow = targetWin;
            }

            targetWin.loadFile(path.join(__dirname, '../../renderer/ui/popup.html'));

            targetWin.webContents.on('did-finish-load', () => {
                targetWin.webContents.send('set-theme', this.currentThemeData);
                if (process.platform === 'darwin') {
                    try {
                        targetWin.setAlwaysOnTop(true, 'floating');
                        targetWin.setVisibleOnAllWorkspaces(true);
                        targetWin.setFullScreenable(false);
                    } catch (e) {
                        console.warn('Mac popup window tuning failed', e);
                    }
                }

                targetWin.webContents.send('display-message', {
                    message,
                    closeDelay: autoDismissMs,
                    healthType,
                    isBlocking,
                    isAutoclose
                });
            });

            targetWin.on('close', (e) => {
                if (!this.isQuitting) {
                    if (targetWin.isRepeatingReminder) {
                        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                            this.mainWindow.webContents.send('popup-closed');
                        }
                    } else {
                        e.preventDefault();
                        targetWin.hide();
                        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                            this.mainWindow.webContents.send('popup-closed');
                        }
                    }
                }
            });

            targetWin.on('closed', () => {
                if (this.popupWindows) {
                    this.popupWindows.delete(targetWin);
                }
                if (this.popupWindow === targetWin) {
                    this.popupWindow = null;
                }
            });

            targetWin.on('blur', () => {
                // This will be handled by the blocker service if macBlockActive is needed
            });
        }

        if (autoDismissMs > 0) {
            const winToClose = targetWin;
            setTimeout(() => {
                try {
                    if (winToClose && !winToClose.isDestroyed()) {
                        winToClose.close();
                    }
                } catch (err) {}
            }, autoDismissMs);
        }
    }

    closeAllPopups() {
        if (this.popupWindows) {
            for (const win of [...this.popupWindows]) {
                if (win && !win.isDestroyed()) {
                    win.close();
                }
            }
        }
        if (this.popupWindow && !this.popupWindow.isDestroyed()) {
            this.popupWindow.close();
        }
    }

    _createTimerWindow(type) {
        let targetDisplay = screen.getPrimaryDisplay();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            targetDisplay = screen.getDisplayMatching(this.mainWindow.getBounds());
        }
        const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = targetDisplay.workArea;
        const windowWidth = 400;
        const windowHeight = 250;
        const x = screenX;
        const y = screenY + screenHeight - windowHeight;

        if (this.timerWindow && !this.timerWindow.isDestroyed()) {
            this.timerWindow.setPosition(x, y);
            this.timerWindow.setSize(windowWidth, windowHeight);
            this.timerWindow.show();
            this.timerWindow.webContents.send('set-theme', this.currentThemeData);
            this.timerWindow.webContents.send('init-timer', type);
            return this.timerWindow;
        }

        this.timerWindow = this._createWindow({
            width: windowWidth,
            height: windowHeight,
            x: x,
            y: y,
            alwaysOnTop: true,
            frame: true,
            resizable: true,
        });

        try {
            this.timerWindow.setAlwaysOnTop(true, 'floating');
            this.timerWindow.setVisibleOnAllWorkspaces(true);
            this.timerWindow.setFullScreenable(false);
        } catch (e) {
            console.warn('Timer window tuning failed', e);
        }

        this.timerWindow.loadFile(path.join(__dirname, '../../renderer/ui/timer-window.html'));

        this.timerWindow.webContents.on('did-finish-load', () => {
            this.timerWindow.webContents.send('set-theme', this.currentThemeData);
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
        };

        if (process.platform === 'darwin') {
            windowConfig.simpleFullscreen = true;
            windowConfig.fullscreen = true;
            windowConfig.kiosk = false;
        } else {
            windowConfig.fullscreen = true;
            windowConfig.kiosk = true;
        }

        this.fullscreenWindow = this._createWindow(windowConfig);
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
            this.fullscreenWindow.webContents.send('set-theme', this.currentThemeData);
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
            ...this.popupWindows
        ];

        // Optimization: Only send timer ticks to visible windows to reduce IPC spam
        const isTimerTickChannel = channel === 'timer-tick';

        const uniqueWindows = new Set(windows.filter(win => win && !win.isDestroyed()));

        uniqueWindows.forEach(win => {
            // Skip sending timer ticks to hidden windows
            if (isTimerTickChannel && !win.isVisible()) {
                return;
            }
            win.webContents.send(channel, ...args);
        });
    }
}

module.exports = new WindowManager();
