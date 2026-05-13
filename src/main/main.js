const { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const util = require('util');
const sudo = require('sudo-prompt');
const { normalizeHost } = require('../renderer/utils/utils.js');

// Polyfills for sudo-prompt which expects these to exist on the util module
if (typeof util.isObject !== 'function') {
    util.isObject = (obj) => obj !== null && typeof obj === 'object';
}
if (typeof util.isFunction !== 'function') {
    util.isFunction = (fn) => typeof fn === 'function';
}

let store;
(async () => {
    const { default: Store } = await import('electron-store');
    store = new Store();
})();

function isOriginSafe(event) {
    try {
        return new URL(event.senderFrame.url).protocol === 'file:';
    } catch (e) {
        return false;
    }
}

// IPC Handlers for settings (electron-store)
ipcMain.on('store-set', (event, key, value) => {
    if (!isOriginSafe(event)) return;
    if (store) store.set(key, value);
});

ipcMain.handle('store-get', async (event, key, defaultValue) => {
    if (!isOriginSafe(event)) return defaultValue;
    return store ? store.get(key, defaultValue) : defaultValue;
});

ipcMain.on('store-delete', (event, key) => {
    if (!isOriginSafe(event)) return;
    if (store) store.delete(key);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
    return;
}

app.on('second-instance', () => {
    // Someone tried to run a second instance - focus our window instead
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

let mainWindow = null;
let popupWindow = null;
let pomoTimerWindow = null;
let microSprintTimerWindow = null;
let flowTimerWindow = null;
let fullscreenWindow = null;
let isQuitting = false;

// Blocker state
let blockerRules = {
    mode: 'block', // 'block' or 'allow'
    domains: [],
    urls: [],
    active: false,
    alwaysRun: false
};

// Mac-specific blocker active flag
let macBlockActive = false;
let macFocusEnforcer = null;
let proxyServer = null;
const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'main', 'fokus-sb-helper.js')
    : path.join(__dirname, 'fokus-sb-helper.js');
let blocksApplied = false;

let timers = {};
let timerInterval = null;
let currentPopupIsBlocking = false;

function startProxy(allowedHosts, allowedUrls) {
    if (proxyServer) proxyServer.close();

    // Pre-parse allowed URLs once to avoid overhead during requests
    const parsedAllowedUrls = [];
    if (allowedUrls) {
        allowedUrls.forEach(urlStr => {
            try {
                parsedAllowedUrls.push(new URL(urlStr));
            } catch (e) {
                // Ignore invalid URLs
            }
        });
    }

    proxyServer = http.createServer((req, res) => {
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const fullUrl = `http://${host}${req.url}`;

        // Check if hostname is allowed (Set lookup is O(1))
        const hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        // Check if specific URL is allowed using pre-parsed objects
        let urlAllowed = false;
        if (!hostAllowed) {
            try {
                const requested = new URL(fullUrl);
                urlAllowed = parsedAllowedUrls.some(allowed => {
                    return allowed.hostname === requested.hostname &&
                           requested.pathname.startsWith(allowed.pathname);
                });
            } catch (e) {}
        }

        if (hostAllowed || urlAllowed) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('<html><body><h1>✓ Allowed by SuperFokus</h1></body></html>');
        } else {
            res.writeHead(503, {'Content-Type': 'text/html'});
            res.end('<html><body style="font-family:Arial;margin:50px;background:#f8d7da;"><h1>⚠️ Service Unavailable</h1><p>This service is temporarily not operational during your focus session.</p></body></html>');
        }
    });

    // Handle HTTPS CONNECT requests properly
    proxyServer.on('connect', (req, clientSocket, head) => {
        const host = req.url.split(':')[0].toLowerCase();
        const port = req.url.split(':')[1] || 443;

        // Check if hostname is allowed
        let hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        if (!hostAllowed) {
            hostAllowed = parsedAllowedUrls.some(allowed => {
                return allowed.hostname === host || allowed.hostname === 'www.' + host || 'www.' + allowed.hostname === host;
            });
        }

        if (hostAllowed) {
            // For allowed HTTPS sites, establish tunnel
            const serverSocket = net.connect(port, host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                serverSocket.write(head);
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });

            serverSocket.on('error', () => {
                try { clientSocket.end(); } catch (e) {}
            });

            clientSocket.on('error', () => {
                try { serverSocket.end(); } catch (e) {}
            });
        } else {
            // Block disallowed HTTPS
            clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        }
    });

    proxyServer.listen(8080, '127.0.0.1', () => {
        console.log('✓ SuperFokus proxy server listening on localhost:8080 (Allow-only mode)');
        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f && reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d 127.0.0.1:8080 /f');
        }
    });

    proxyServer.on('error', (err) => {
        console.error('Proxy server error:', err);
        // Don't crash the app on proxy errors
        if (err.code === 'ECONNRESET') {
            console.log('Connection reset by client - this is normal');
        }
    });

    // Handle client errors gracefully
    proxyServer.on('clientError', (err, socket) => {
        console.log('Client connection error:', err.message);
        try {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        } catch (e) {
            // Socket might already be closed
        }
    });
}

function stopProxy() {
    if (proxyServer) {
        proxyServer.close();
        proxyServer = null;
        console.log('Proxy server stopped');
        if (process.platform === 'win32') {
            const { exec } = require('child_process');
            exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f');
        }
    }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(__dirname, '../../assets/fokusicon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.maximize();

    mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/')) {
       const useExternal = store ? store.get('githubExternalBrowser', true) : true;
       if (useExternal) {
           require('electron').shell.openExternal(url);
       } else {
           // Safe internal opening is unsupported right now without a custom BrowserWindow. Force external.
           require('electron').shell.openExternal(url);
       }
       return { action: 'deny' };
    }
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'file:') {
          event.preventDefault();
          require('electron').shell.openExternal(url);
      }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
    }
  });
}

function createApplicationMenu() {
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
                        isQuitting = true;
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

function createPopupWindow(message, autoDismissMs = 10000, healthType = null, isAutoclose = false) {
    const isBlocking = healthType && healthConfig.blockingMode === 'fullscreen';

    // If the window exists but the structural type (blocking vs non-blocking) 
    // needs to change, completely destroy the old instance so we can recreate it.
    if (popupWindow && currentPopupIsBlocking !== isBlocking) {
        popupWindow.destroy();
        popupWindow = null;
    }

    if (popupWindow) {
        popupWindow.show();
        popupWindow.webContents.send('display-message', {
            message,
            closeDelay: autoDismissMs,
            healthType,
            isBlocking,
            isAutoclose
        });
    } else {
        if (isBlocking) {
            // Fullscreen blocking mode for mandatory health breaks
            popupWindow = new BrowserWindow({
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
                    preload: path.join(__dirname, 'preload.js'),
                },
            });
            currentPopupIsBlocking = true;
        } else {
            // Non-blocking popup mode (floats on top, doesn't prevent interaction)
            popupWindow = new BrowserWindow({
                width: 500,
                height: 350,
                alwaysOnTop: true,
                frame: true,
                resizable: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.js'),
                },
            });
            currentPopupIsBlocking = false;
        }

        popupWindow.loadFile(path.join(__dirname, '../renderer/ui/popup.html'));
        
        popupWindow.webContents.on('did-finish-load', () => {
            // Send theme info
            popupWindow.webContents.send('set-theme', currentThemeIsDark);
            if (process.platform === 'darwin') {
                try {
                    popupWindow.setAlwaysOnTop(true, 'floating');
                    popupWindow.setVisibleOnAllWorkspaces(true);
                    popupWindow.setFullScreenable(false);
                } catch (e) {
                    console.warn('Mac popup window tuning failed', e);
                }
            }

            popupWindow.webContents.send('display-message', {
                message,
                closeDelay: autoDismissMs,
                healthType,
                isBlocking,
                isAutoclose
            });
        });

        popupWindow.on('close', (e) => {
            if (!isQuitting) {
                e.preventDefault();
                popupWindow.hide();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('popup-closed');
            }
            }
        });

        // Focus-lock while blocker is active
        popupWindow.on('blur', () => {
            if (macBlockActive) {
                try {
                    popupWindow.focus();
                    // small toggle to try to keep it above other apps
                    popupWindow.setAlwaysOnTop(true);
                    popupWindow.setAlwaysOnTop(false);
                } catch (e) {}
            }
        });
    }
    
    // Auto-dismiss popup after specified duration
    if (autoDismissMs > 0) {
        setTimeout(() => {
            try {
                if (popupWindow && !popupWindow.isDestroyed()) {
                    popupWindow.close();
                }
            } catch (err) {}
        }, autoDismissMs);
    }
}

let currentThemeIsDark = false;

ipcMain.on('theme-changed', (event, isDark) => {
    currentThemeIsDark = isDark;
    if (pomoTimerWindow && !pomoTimerWindow.isDestroyed()) {
        pomoTimerWindow.webContents.send('set-theme', isDark);
    }
    if (microSprintTimerWindow && !microSprintTimerWindow.isDestroyed()) {
        microSprintTimerWindow.webContents.send('set-theme', isDark);
    }
    if (flowTimerWindow && !flowTimerWindow.isDestroyed()) {
        flowTimerWindow.webContents.send('set-theme', isDark);
    }
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.webContents.send('set-theme', isDark);
    }
    if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
        fullscreenWindow.webContents.send('set-theme', isDark);
    }
});

function createPomoTimerWindow() {
    const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
    const windowWidth = 400;
    const windowHeight = 250;
    const x = screenX;
    const y = screenY + screenHeight - windowHeight;

    if (pomoTimerWindow && !pomoTimerWindow.isDestroyed()) {
        pomoTimerWindow.setPosition(x, y);
        pomoTimerWindow.setSize(windowWidth, windowHeight);
        pomoTimerWindow.show();
        pomoTimerWindow.webContents.send('set-theme', currentThemeIsDark);
        return;
    }

    pomoTimerWindow = new BrowserWindow({
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
            preload: path.join(__dirname, 'preload.js')
        },
    });

    try {
        pomoTimerWindow.setAlwaysOnTop(true, 'floating');
        pomoTimerWindow.setVisibleOnAllWorkspaces(true);
        pomoTimerWindow.setFullScreenable(false);
    } catch (e) {
        console.warn('Pomo timer window tuning failed', e);
    }

    pomoTimerWindow.loadFile(path.join(__dirname, '../renderer/features/pomo-timer.html'));

    pomoTimerWindow.webContents.on('did-finish-load', () => {
        pomoTimerWindow.webContents.send('set-theme', currentThemeIsDark);
    });

    pomoTimerWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            pomoTimerWindow.hide();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('pomo-popup-closed');
            }
        }
    });
}

function createMicroSprintTimerWindow() {
    const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
    const windowWidth = 400;
    const windowHeight = 250;
    const x = screenX;
    const y = screenY + screenHeight - windowHeight;

    if (microSprintTimerWindow && !microSprintTimerWindow.isDestroyed()) {
        microSprintTimerWindow.setPosition(x, y);
        microSprintTimerWindow.setSize(windowWidth, windowHeight);
        microSprintTimerWindow.show();
        microSprintTimerWindow.webContents.send('set-theme', currentThemeIsDark);
        return;
    }

    microSprintTimerWindow = new BrowserWindow({
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
            preload: path.join(__dirname, 'preload.js')
        },
    });

    try {
        microSprintTimerWindow.setAlwaysOnTop(true, 'floating');
        microSprintTimerWindow.setVisibleOnAllWorkspaces(true);
        microSprintTimerWindow.setFullScreenable(false);
    } catch (e) {
        console.warn('Micro sprint timer window tuning failed', e);
    }

    microSprintTimerWindow.loadFile(path.join(__dirname, '../renderer/features/micro-sprint-timer.html'));

    microSprintTimerWindow.webContents.on('did-finish-load', () => {
        microSprintTimerWindow.webContents.send('set-theme', currentThemeIsDark);
    });

    microSprintTimerWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            microSprintTimerWindow.hide();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('micro-sprint-popup-closed');
            }
        }
    });
}

function createFlowTimerWindow() {
    const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
    const windowWidth = 400;
    const windowHeight = 250;
    const x = screenX;
    const y = screenY + screenHeight - windowHeight;

    if (flowTimerWindow && !flowTimerWindow.isDestroyed()) {
        flowTimerWindow.setPosition(x, y);
        flowTimerWindow.setSize(windowWidth, windowHeight);
        flowTimerWindow.show();
        flowTimerWindow.webContents.send('set-theme', currentThemeIsDark);
        return;
    }

    flowTimerWindow = new BrowserWindow({
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
            preload: path.join(__dirname, 'preload.js')
        },
    });

    try {
        flowTimerWindow.setAlwaysOnTop(true, 'floating');
        flowTimerWindow.setVisibleOnAllWorkspaces(true);
        flowTimerWindow.setFullScreenable(false);
    } catch (e) {
        console.warn('Flow timer window tuning failed', e);
    }

    flowTimerWindow.loadFile(path.join(__dirname, '../renderer/features/flow-timer.html'));

    flowTimerWindow.webContents.on('did-finish-load', () => {
        flowTimerWindow.webContents.send('set-theme', currentThemeIsDark);
    });

    flowTimerWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            flowTimerWindow.hide();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('flow-popup-closed');
            }
        }
    });
}

function createFullscreenWindow(data) {
    if (fullscreenWindow) {
        // Re-apply Mac tuning in case it was stripped during a previous hide
        if (process.platform === 'darwin') {
            try {
                fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                fullscreenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            } catch (e) {}
        }
        
        fullscreenWindow.openedAt = Date.now();
        fullscreenWindow.show();
        try { fullscreenWindow.focus(); } catch (e) {}
        fullscreenWindow.webContents.send('set-fullscreen-data', data);
        return;
    }
    // Completely destroy the old window so we can generate a fresh, native kiosk window
    if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
        fullscreenWindow.close(); 
    }

    const windowConfig = {
        alwaysOnTop: true,
        frame: false,
        show: false, // Don't show until ready to prevent macOS rendering glitches
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
    };

    // Prevent macOS space transition glitches (dock disappearing, window closing)
    // by using "simpleFullscreen" (pre-Lion fullscreen). This perfectly covers the 
    // menu bar and dock without creating a new Space that fights with setVisibleOnAllWorkspaces.
    if (process.platform === 'darwin') {
        windowConfig.simpleFullscreen = true;
        windowConfig.fullscreen = true;
        windowConfig.kiosk = false;
    } else {
        windowConfig.fullscreen = true;
        windowConfig.kiosk = true;
    }

    fullscreenWindow = new BrowserWindow(windowConfig);

    fullscreenWindow.openedAt = Date.now();

    // Wait until the window is fully ready before forcing it fullscreen to prevent invisible window bugs
    fullscreenWindow.once('ready-to-show', () => {
        fullscreenWindow.show();
        try { fullscreenWindow.focus(); } catch (e) {}
        
        if (process.platform === 'darwin') {
            try {
                fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                fullscreenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            } catch (e) {
                console.warn('Mac fullscreen window tuning failed', e);
            }
        }
    });

    fullscreenWindow.loadFile(path.join(__dirname, '../renderer/ui/fullscreen-popup.html'));

    fullscreenWindow.webContents.on('did-finish-load', () => {
        fullscreenWindow.webContents.send('set-fullscreen-data', data);
    });

    fullscreenWindow.on('close', (e) => {
        if (!isQuitting) {
            if (!fullscreenWindow.forceClose) {
                // WORKAROUND: Prevent premature window.close() calls from the broken internal timeout.
                // Check exact remaining time. If it's less than 1 second, allow closing to prevent getting stuck due to tick desyncs.
                const breakOrPomoRunning = Object.entries(timers).some(([id, t]) => {
                    if (!t.isRunning || (!id.includes('break') && !id.includes('pomo'))) return false;
                    return (t.endTime - Date.now()) > 1000;
                });
                
                // Prevent race conditions where the window closes before the timer is registered
                // Reduced to 1000ms to prevent trapping users testing with very short (1-2s) timers.
                const justOpened = fullscreenWindow.openedAt && (Date.now() - fullscreenWindow.openedAt < 1000);

                if (breakOrPomoRunning || justOpened) {
                    e.preventDefault();
                    return;
                }
            }

            // Strip Mac locks before letting the window close naturally
            if (process.platform === 'darwin') {
                try { fullscreenWindow.setKiosk(false); } catch (e) {}
                try { fullscreenWindow.setAlwaysOnTop(false); } catch (e) {}
                try { fullscreenWindow.setSimpleFullScreen(false); } catch (e) {}
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('popup-closed');
                mainWindow.webContents.send('fullscreen-closed');
                mainWindow.show(); // Ensure Dashboard comes back into view
            }
            
            // Let the window naturally close and destroy itself, freeing OS resources
            fullscreenWindow = null;
        }
    });

    // Focus-lock while blocker is active
    fullscreenWindow.on('blur', () => {
        if (!isQuitting && fullscreenWindow && !fullscreenWindow.forceClose) {
            try {
                fullscreenWindow.focus();
                if (process.platform === 'darwin') {
                    fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                } else {
                    fullscreenWindow.setAlwaysOnTop(true);
                }
            } catch (e) {}
        }
    });

    // If user minimizes or hides the window, immediately restore it while blocking
    fullscreenWindow.on('minimize', () => {
        if (!isQuitting && fullscreenWindow && !fullscreenWindow.forceClose) {
            try { fullscreenWindow.restore(); fullscreenWindow.focus(); } catch (e) {}
        }
    });
    fullscreenWindow.on('hide', () => {
        if (!isQuitting && fullscreenWindow && !fullscreenWindow.forceClose) {
            try { fullscreenWindow.show(); fullscreenWindow.focus(); } catch (e) {}
        }
    });
}

function forceKillFullscreen() {
    if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
        fullscreenWindow.forceClose = true;
        
        // Strip Mac locks before letting the window close naturally
        if (process.platform === 'darwin') {
            try { fullscreenWindow.setKiosk(false); } catch (e) {}
            try { fullscreenWindow.setAlwaysOnTop(false); } catch (e) {}
            try { fullscreenWindow.setSimpleFullScreen(false); } catch (e) {}
        }

        // destroy() is Electron's "ultimate nuke". It bypasses all preventDefault 
        // and gracefully but instantly kills the native OS window process.
        fullscreenWindow.destroy(); 
        fullscreenWindow = null;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('popup-closed');
            mainWindow.webContents.send('fullscreen-closed');
            mainWindow.show(); // Ensure Dashboard comes back into view
        }
    }
}

function broadcastToWindows(channel, ...args) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
    if (pomoTimerWindow && !pomoTimerWindow.isDestroyed()) pomoTimerWindow.webContents.send(channel, ...args);
    if (microSprintTimerWindow && !microSprintTimerWindow.isDestroyed()) microSprintTimerWindow.webContents.send(channel, ...args);
    if (flowTimerWindow && !flowTimerWindow.isDestroyed()) flowTimerWindow.webContents.send(channel, ...args);
    if (fullscreenWindow && !fullscreenWindow.isDestroyed()) fullscreenWindow.webContents.send(channel, ...args);
}

function startTimerService() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        const now = Date.now();
        let activeTimersCount = 0;

        for (const id in timers) {
            const timer = timers[id];
            if (!timer.isRunning) continue;

            activeTimersCount++;
            const remaining = Math.max(0, Math.round((timer.endTime - now) / 1000));
            
            // Broadcast tick
            broadcastToWindows('timer-tick', { id, remaining, total: timer.totalSeconds });

            if (remaining <= 0) {
                timer.isRunning = false;
                timer.remainingSeconds = 0;
                broadcastToWindows(`timer-complete-${id}`);
                
                if (id.includes('break') || id.includes('pomo')) {
                    forceKillFullscreen();
                }
            }
        }

        if (activeTimersCount === 0) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// --- IPC Listeners ---

ipcMain.on('start-timer', (event, data) => {
    if (!isOriginSafe(event)) return;
    const { id, seconds } = data;
    const durationMs = seconds * 1000;
    const endTime = Date.now() + durationMs;

    timers[id] = {
        totalSeconds: seconds,
        remainingSeconds: seconds,
        endTime: endTime,
        isRunning: true
    };

    broadcastToWindows(`timer-started-${id}`, { endTime, seconds });
    startTimerService();
});

ipcMain.on('stop-timer', (event, id) => {
    if (timers[id]) {
        timers[id].isRunning = false;
        timers[id].remainingSeconds = 0;
    }
    broadcastToWindows(`timer-stopped-${id}`);
    if (id.includes('break') || id.includes('pomo')) {
        forceKillFullscreen();
    }
});

ipcMain.on('pause-timer', (event, id) => {
    if (timers[id] && timers[id].isRunning) {
        timers[id].isRunning = false;
        timers[id].remainingSeconds = Math.max(0, Math.round((timers[id].endTime - Date.now()) / 1000));
    }
    broadcastToWindows(`timer-paused-${id}`, timers[id] ? timers[id].remainingSeconds : 0);
});

ipcMain.on('resume-timer', (event, id) => {
    if (timers[id] && !timers[id].isRunning && timers[id].remainingSeconds > 0) {
        const durationMs = timers[id].remainingSeconds * 1000;
        const endTime = Date.now() + durationMs;
        timers[id].endTime = endTime;
        timers[id].isRunning = true;
        
        broadcastToWindows(`timer-resumed-${id}`, { endTime, seconds: timers[id].remainingSeconds });
        startTimerService();
    }
});

ipcMain.on('show-popup', (event, payload) => {
    if (typeof payload === 'object' && payload !== null) {
        createPopupWindow(payload.message, payload.closeDelay || 10000, payload.healthType || null, true);
    } else {
        createPopupWindow(payload, 10000, null, true);
    }
});

ipcMain.on('close-popup', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }
});

ipcMain.on('open-pomo-timer', () => {
    createPomoTimerWindow();
});

ipcMain.on('update-pomo-timer', (event, data) => {
    if (pomoTimerWindow) {
        pomoTimerWindow.webContents.send('update-display', data);
    }
});

ipcMain.on('close-pomo-timer', () => {
    if (pomoTimerWindow) {
        pomoTimerWindow.close();
    }
});

ipcMain.on('open-micro-sprint-timer', () => {
    createMicroSprintTimerWindow();
});

ipcMain.on('update-micro-sprint-timer', (event, data) => {
    if (microSprintTimerWindow) {
        microSprintTimerWindow.webContents.send('update-display', data);
    }
});

ipcMain.on('close-micro-sprint-timer', () => {
    if (microSprintTimerWindow) {
        microSprintTimerWindow.close();
    }
});

ipcMain.on('open-flow-timer', () => {
    createFlowTimerWindow();
});

ipcMain.on('update-flow-timer', (event, data) => {
    if (flowTimerWindow) {
        flowTimerWindow.webContents.send('update-display', data);
    }
});

ipcMain.on('close-flow-timer', () => {
    if (flowTimerWindow) {
        flowTimerWindow.close();
    }
});

ipcMain.on('show-break-popup', (event, data) => {
    if (data.fullScreen) {
        createFullscreenWindow(data);
    } else {
        createPopupWindow(data.message || `Time for a ${data.type}!`, 10000, null, true);
    }
});

ipcMain.on('close-fullscreen', () => {
    // WORKAROUND: Prevent the fullscreen-popup's broken internal timeout from closing the window early.
    // Check exact remaining time. If it's less than 1 second, allow closing to prevent getting stuck due to tick desyncs.
    const breakOrPomoRunning = Object.entries(timers).some(([id, t]) => {
        if (!t.timeout || (!id.includes('break') && !id.includes('pomo'))) return false;
        return (t.endTime - Date.now()) > 1000;
    });
    
    // Prevent race conditions where the window closes before the timer is registered
    // Reduced to 1000ms to prevent trapping users testing with very short (1-2s) timers.
    const justOpened = fullscreenWindow && fullscreenWindow.openedAt && (Date.now() - fullscreenWindow.openedAt < 1000);

    if (breakOrPomoRunning || justOpened) {
        return;
    }

    forceKillFullscreen();
    // Only restore the Pomo Timer if it wasn't just explicitly hidden
    if (pomoTimerWindow && !pomoTimerWindow.isDestroyed() && pomoTimerWindow.isVisible()) {
        pomoTimerWindow.show();
        pomoTimerWindow.focus();
        pomoTimerWindow.setAlwaysOnTop(true);
    }
});

ipcMain.on('next-phase-triggered', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('start-next-phase');
    }
});

app.whenReady().then(() => {
  createWindow();
  if (process.platform === 'darwin') {
      try { app.dock.setIcon(path.join(__dirname, '../../assets/fokusicon.png')); } catch (e) {}
  }
  createApplicationMenu();

  // Startup Cleanup: Clear any zombie blocks from previous ungraceful exits
  runElevated('clear', (error) => {
      if (error) {
          console.log('[Startup] Failsafe check cancelled or failed.');
      } else {
          console.log('[Startup] Checked and cleared zombie blocks.');
      }
  });

  process.on('uncaughtException', (err) => {
      console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
      runElevated('clear', () => {
          process.exit(1);
      });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
        mainWindow.show();
    }
  });
}).catch(err => {
    console.error('CRITICAL STARTUP ERROR:', err);
});

// IPC for Blocker
// macOS-focused IPC controls for popup -> fullscreen blocker flow
ipcMain.on('blocker-show-popup', (event, message) => {
    createPopupWindow(message, 10000, null, true);
});

ipcMain.on('blocker-expand-fullscreen', (event, data) => {
    // Expansion disabled per user request: "it shouldnt have the expanding in 5 secs thing"
});

ipcMain.on('blocker-start', (event, data) => {
    macBlockActive = false; // Disabled focus lock as we aren't expanding
    let msg = '';
    if (typeof data === 'string') msg = data;
    else if (data && data.message) msg = data.message;
    createPopupWindow(msg, 10000, null, true);
});

ipcMain.on('blocker-stop', () => {
    macBlockActive = false;
    forceKillFullscreen();
    if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close();
});

function runElevated(args, callback) {
    // Basic validation of args to prevent shell injection
    // Whitelist: 'clear', 'apply-file "<path>"'
    const allowedCommands = ['clear', 'apply-file'];
    const parts = args.split(' ');
    const commandPart = parts[0];

    if (!allowedCommands.includes(commandPart)) {
        console.error('[Security] Blocked unauthorized elevated command:', commandPart);
        if (callback) callback(new Error('Unauthorized command'));
        return;
    }

    // For apply-file, ensure the path is a valid string and doesn't contain suspicious characters
    if (commandPart === 'apply-file') {
        const filePath = args.substring(commandPart.length).trim().replace(/^"|"$/g, '');
        if (!filePath || /[\r\n;&|$><\x00]/.test(filePath)) {
            console.error('[Security] Blocked suspicious file path in elevated command:', filePath);
            if (callback) callback(new Error('Invalid file path'));
            return;
        }
    }

    const nodePath = process.execPath;
    let command;
    if (process.platform === 'win32') {
        command = `set ELECTRON_RUN_AS_NODE=1 && "${nodePath}" "${helperPath}" ${args}`;
    } else {
        command = `ELECTRON_RUN_AS_NODE=1 "${nodePath}" "${helperPath}" ${args}`;
    }
    
    sudo.exec(command, { name: 'SuperFokus' }, (error, stdout, stderr) => {
        if (callback) callback(error, stdout, stderr);
    });
}

function setMacProxy(enable) {
    if (process.platform !== 'darwin') return;
    const { exec } = require('child_process');
    // Attempt to set proxy for common interface names. Robustness could be improved by listing all services.
    const services = ['Wi-Fi', 'Ethernet', 'Thunderbolt Bridge'];
    services.forEach(service => {
        if (enable) {
            exec(`networksetup -setwebproxy "${service}" 127.0.0.1 8080 && networksetup -setwebproxystate "${service}" on`);
            exec(`networksetup -setsecurewebproxy "${service}" 127.0.0.1 8080 && networksetup -setsecurewebproxystate "${service}" on`);
        } else {
            exec(`networksetup -setwebproxystate "${service}" off`);
            exec(`networksetup -setsecurewebproxystate "${service}" off`);
        }
    });
}

ipcMain.on('update-blocker-rules', (event, rules) => {
    blockerRules = rules;
    const allHosts = new Set();
    const allUrls = new Set();

    if (Array.isArray(rules.domains)) {
        rules.domains.forEach(domain => {
            const host = normalizeHost(domain);
            if (host) allHosts.add(host);
        });
    }

    if (Array.isArray(rules.urls)) {
        rules.urls.forEach(url => {
            allUrls.add(url.trim());
        });
    }

    console.log('[Main] update-blocker-rules:', {mode: rules.mode, active: rules.active, hostCount: allHosts.size});

    if (rules.mode === 'allow' && rules.active && allHosts.size > 0) {
        console.log('[Block] Starting proxy server for allow-only mode');
        startProxy(allHosts, allUrls);
        if (process.platform === 'darwin') setMacProxy(true);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('blocker-status', '✓ Allow-only mode ACTIVE.');
        }
    } else if (rules.mode === 'block' && rules.active && allHosts.size > 0) {
        console.log('[Block] Applying hosts blocks for', allHosts.size, 'domains');
        const domains = Array.from(allHosts);
        const tempPath = path.join(app.getPath('userData'), 'fokus_domains.json');
        
        fs.promises.writeFile(tempPath, JSON.stringify(domains))
            .then(() => {
                runElevated(`apply-file "${tempPath}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error('[Block] Blocker elevation error:', error);
                        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('blocker-error', error.message);
                    } else {
                        blocksApplied = true;
                        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('blocker-status', 'Domains blocked successfully');
                    }
                });
            })
            .catch(e => {
                console.error('[Block] File write error:', e);
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('blocker-error', 'Failed to prepare domain list.');
            });
    } else {
        console.log('[Block] Clearing blocks and stopping proxy');
        stopProxy();
        if (process.platform === 'darwin') setMacProxy(false);
        if (blocksApplied) {
            runElevated('clear', (error) => {
                if (!error) blocksApplied = false;
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('blocker-status', 'Blocks cleared');
            });
        }
    }
});

ipcMain.on('clear-all-blocks', () => {
    stopProxy();
    runElevated('clear', (error, stdout, stderr) => {
        if (error) {
            console.error('Blocker elevation error:', error);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('blocker-error', 'Failed to clear all blocks.');
            }
        } else {
            console.log('All blocks cleared manually:', stdout);
            blocksApplied = false;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('blocker-status', 'All blocks cleared');
            }
        }
    });
});

let healthIntervals = { eye: null, posture: null };
let healthConfig = {
    eyeSaver: false,
    postureCheck: false,
    blockingMode: 'popup', // 'popup' or 'fullscreen'
    eyeSaverInterval: 20 * 60 * 1000, // 20 mins between eye breaks
    postureInterval: 45 * 60 * 1000, // 45 mins between posture breaks
    eyeBreakDuration: 20 * 1000, // 20 seconds for eye break
    postureBreakDuration: 50 * 1000 // 50 seconds for posture break
};

ipcMain.on('start-health-mode', (event, data) => {
    if (healthIntervals.eye) clearInterval(healthIntervals.eye);
    if (healthIntervals.posture) clearInterval(healthIntervals.posture);
    
    // Update config with user settings
    healthConfig.eyeSaver = data.eyeSaver || false;
    healthConfig.postureCheck = data.postureCheck || false;
    healthConfig.blockingMode = data.blockingMode || 'popup'; // 'popup' or 'fullscreen'
    if (data.eyeSaverInterval) healthConfig.eyeSaverInterval = data.eyeSaverInterval;
    if (data.postureInterval) healthConfig.postureInterval = data.postureInterval;
    if (data.eyeBreakDuration) healthConfig.eyeBreakDuration = data.eyeBreakDuration;
    if (data.postureBreakDuration) healthConfig.postureBreakDuration = data.postureBreakDuration;
    
    if (healthConfig.eyeSaver) {
        healthIntervals.eye = setInterval(() => {
            createPopupWindow("Eye Saver: Look at something 20 feet away for 20 seconds.", healthConfig.eyeBreakDuration, 'eye');
        }, healthConfig.eyeSaverInterval);
    }
    if (healthConfig.postureCheck) {
        healthIntervals.posture = setInterval(() => {
            createPopupWindow("Posture Check: Time to sit up straight and stretch for a minute.", healthConfig.postureBreakDuration, 'posture');
        }, healthConfig.postureInterval);
    }
});

ipcMain.on('stop-health-mode', () => {
    if (healthIntervals.eye) clearInterval(healthIntervals.eye);
    if (healthIntervals.posture) clearInterval(healthIntervals.posture);
    if (popupWindow) popupWindow.close();
});

// Detect a system-level Cmd+Q / Quit request and allow blocker windows to close normally
app.on('before-quit', () => {
    isQuitting = true;
});

let isClearingOnQuit = false;
app.on('will-quit', (e) => {
    // Gracefully clear all recurring background processes and active timers on quit
    for (const key in timers) {
        if (timers[key].timeout) clearTimeout(timers[key].timeout);
    }
    timers = {};
    if (healthIntervals.eye) clearInterval(healthIntervals.eye);
    if (healthIntervals.posture) clearInterval(healthIntervals.posture);

    stopProxy();
    if (blocksApplied && !isClearingOnQuit) {
        e.preventDefault();
        isClearingOnQuit = true;
        runElevated('clear', () => {
            blocksApplied = false;
            app.quit();
        });
    }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app.quit(); // Handled by tray/isQuitting
  }
});

