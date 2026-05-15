const { BrowserWindow, screen, Menu, app, shell } = require('electron');
const path = require('path');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.popupWindow = null;
        this.pomoTimerWindow = null;
        this.microSprintTimerWindow = null;
        this.flowTimerWindow = null;
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
                // For now, we keep it simple or pass the state.
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

    createPomoTimerWindow() {
        const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
        const windowWidth = 400;
        const windowHeight = 250;
        const x = screenX;
        const y = screenY + screenHeight - windowHeight;

        if (this.pomoTimerWindow && !this.pomoTimerWindow.isDestroyed()) {
            this.pomoTimerWindow.setPosition(x, y);
            this.pomoTimerWindow.setSize(windowWidth, windowHeight);
            this.pomoTimerWindow.show();
            this.pomoTimerWindow.webContents.send('set-theme', this.currentThemeIsDark);
            return;
        }

        this.pomoTimerWindow = new BrowserWindow({
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

        this.setupNavigationHandlers(this.pomoTimerWindow);

        try {
            this.pomoTimerWindow.setAlwaysOnTop(true, 'floating');
            this.pomoTimerWindow.setVisibleOnAllWorkspaces(true);
            this.pomoTimerWindow.setFullScreenable(false);
        } catch (e) {
            console.warn('Pomo timer window tuning failed', e);
        }

        this.pomoTimerWindow.loadFile(path.join(__dirname, '../../renderer/features/pomo-timer.html'));

        this.pomoTimerWindow.webContents.on('did-finish-load', () => {
            this.pomoTimerWindow.webContents.send('set-theme', this.currentThemeIsDark);
        });

        this.pomoTimerWindow.on('close', (e) => {
            if (!this.isQuitting) {
                e.preventDefault();
                this.pomoTimerWindow.hide();
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('pomo-popup-closed');
                }
            }
        });
    }

    createMicroSprintTimerWindow() {
        const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
        const windowWidth = 400;
        const windowHeight = 250;
        const x = screenX;
        const y = screenY + screenHeight - windowHeight;

        if (this.microSprintTimerWindow && !this.microSprintTimerWindow.isDestroyed()) {
            this.microSprintTimerWindow.setPosition(x, y);
            this.microSprintTimerWindow.setSize(windowWidth, windowHeight);
            this.microSprintTimerWindow.show();
            this.microSprintTimerWindow.webContents.send('set-theme', this.currentThemeIsDark);
            return;
        }

        this.microSprintTimerWindow = new BrowserWindow({
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

        this.setupNavigationHandlers(this.microSprintTimerWindow);

        try {
            this.microSprintTimerWindow.setAlwaysOnTop(true, 'floating');
            this.microSprintTimerWindow.setVisibleOnAllWorkspaces(true);
            this.microSprintTimerWindow.setFullScreenable(false);
        } catch (e) {
            console.warn('Micro sprint timer window tuning failed', e);
        }

        this.microSprintTimerWindow.loadFile(path.join(__dirname, '../../renderer/features/micro-sprint-timer.html'));

        this.microSprintTimerWindow.webContents.on('did-finish-load', () => {
            this.microSprintTimerWindow.webContents.send('set-theme', this.currentThemeIsDark);
        });

        this.microSprintTimerWindow.on('close', (e) => {
            if (!this.isQuitting) {
                e.preventDefault();
                this.microSprintTimerWindow.hide();
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('micro-sprint-popup-closed');
                }
            }
        });
    }

    createFlowTimerWindow() {
        const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
        const windowWidth = 400;
        const windowHeight = 250;
        const x = screenX;
        const y = screenY + screenHeight - windowHeight;

        if (this.flowTimerWindow && !this.flowTimerWindow.isDestroyed()) {
            this.flowTimerWindow.setPosition(x, y);
            this.flowTimerWindow.setSize(windowWidth, windowHeight);
            this.flowTimerWindow.show();
            this.flowTimerWindow.webContents.send('set-theme', this.currentThemeIsDark);
            return;
        }

        this.flowTimerWindow = new BrowserWindow({
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

        this.setupNavigationHandlers(this.flowTimerWindow);

        try {
            this.flowTimerWindow.setAlwaysOnTop(true, 'floating');
            this.flowTimerWindow.setVisibleOnAllWorkspaces(true);
            this.flowTimerWindow.setFullScreenable(false);
        } catch (e) {
            console.warn('Flow timer window tuning failed', e);
        }

        this.flowTimerWindow.loadFile(path.join(__dirname, '../../renderer/features/flow-timer.html'));

        this.flowTimerWindow.webContents.on('did-finish-load', () => {
            this.flowTimerWindow.webContents.send('set-theme', this.currentThemeIsDark);
        });

        this.flowTimerWindow.on('close', (e) => {
            if (!this.isQuitting) {
                e.preventDefault();
                this.flowTimerWindow.hide();
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('flow-popup-closed');
                }
            }
        });
    }

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
            this.pomoTimerWindow,
            this.microSprintTimerWindow,
            this.flowTimerWindow,
            this.fullscreenWindow,
            this.popupWindow
        ];

        const targetTimerId = (channel === 'timer-tick' || channel.startsWith('timer-')) ? args[0]?.id || args[0] : null;

        windows.forEach(win => {
            if (win && !win.isDestroyed()) {
                if (targetTimerId) {
                    if (targetTimerId === 'pomo' && win !== this.pomoTimerWindow && win !== this.mainWindow && win !== this.fullscreenWindow) return;
                    if (targetTimerId === 'sprint' && win !== this.microSprintTimerWindow && win !== this.mainWindow) return;
                    if (targetTimerId === 'flow' && win !== this.flowTimerWindow && win !== this.mainWindow) return;
                    if (targetTimerId.includes('break') && win !== this.fullscreenWindow && win !== this.popupWindow && win !== this.mainWindow && win !== this.pomoTimerWindow) return;
                }
                win.webContents.send(channel, ...args);
            }
        });
    }
}

module.exports = new WindowManager();
