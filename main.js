const { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const util = require('util');

// Polyfill deprecated util functions required by sudo-prompt
if (typeof util.isObject !== 'function') {
    util.isObject = function(arg) { return typeof arg === 'object' && arg !== null; };
}
if (typeof util.isFunction !== 'function') {
    util.isFunction = function(arg) { return typeof arg === 'function'; };
}

const sudo = require('sudo-prompt');


app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

let mainWindow = null;
let popupWindow = null;
let pomoTimerWindow = null;
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
const helperPath = path.join(__dirname, 'fokus-sb-helper.js');
let blocksApplied = false;

function startProxy(allowedHosts, allowedUrls) {
    if (proxyServer) proxyServer.close();

    const urlsArray = Array.isArray(allowedUrls) ? allowedUrls : Array.from(allowedUrls || []);

    proxyServer = http.createServer((req, res) => {
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const fullUrl = `http://${host}${req.url}`;

        // Check if hostname is allowed
        const hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        // Check if specific URL is allowed
        const urlAllowed = urlsArray.some(allowedUrl => {
            try {
                const allowed = new URL(allowedUrl);
                const requested = new URL(fullUrl);
                return allowed.hostname === requested.hostname &&
                       requested.pathname.startsWith(allowed.pathname);
            } catch (e) {
                return false;
            }
        });

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

        if (!hostAllowed && urlsArray) {
            hostAllowed = urlsArray.some(allowedUrl => {
                try {
                    const allowed = new URL(allowedUrl);
                    return allowed.hostname === host || allowed.hostname === 'www.' + host || 'www.' + allowed.hostname === host;
                } catch (e) {
                    return false;
                }
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
    icon: path.join(__dirname, 'fokusicon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.maximize();

  mainWindow.loadFile('index.html');

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
        }

        popupWindow.loadFile('popup.html');
        
        popupWindow.webContents.on('did-finish-load', () => {
            // Mac-specific visibility and level to keep popup on top of other apps/workspaces
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
    if (pomoTimerWindow) {
        pomoTimerWindow.webContents.send('set-theme', isDark);
    }
});

function createPomoTimerWindow() {
    if (pomoTimerWindow) {
        pomoTimerWindow.show();
        pomoTimerWindow.webContents.send('set-theme', currentThemeIsDark);
        return;
    }

    pomoTimerWindow = new BrowserWindow({
        width: 350,
        height: 200,
        alwaysOnTop: true,
        frame: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false // Important for background reliability
        },
    });

    try {
        pomoTimerWindow.setAlwaysOnTop(true, 'floating');
        pomoTimerWindow.setVisibleOnAllWorkspaces(true);
        pomoTimerWindow.setFullScreenable(false);
    } catch (e) {
        console.warn('Pomo timer window tuning failed', e);
    }

    pomoTimerWindow.loadFile('pomo-timer.html');

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

function createFullscreenWindow(data) {
    if (fullscreenWindow) {
        // Re-apply Mac tuning in case it was stripped during a previous hide
        if (process.platform === 'darwin') {
            try {
                try { fullscreenWindow.setKiosk(true); } catch (e) {}
                fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                fullscreenWindow.setFullScreen(true);
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

    fullscreenWindow = new BrowserWindow({
        fullscreen: true,
        kiosk: true, // Native Kiosk mode built into Electron
        alwaysOnTop: true,
        frame: false,
        show: false, // Don't show until ready to prevent macOS rendering glitches
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false
        },
    });

    fullscreenWindow.openedAt = Date.now();

    // Wait until the window is fully ready before forcing it fullscreen to prevent invisible window bugs
    fullscreenWindow.once('ready-to-show', () => {
        fullscreenWindow.show();
        try { fullscreenWindow.focus(); } catch (e) {}
        
        if (process.platform === 'darwin') {
            try {
                try { fullscreenWindow.setKiosk(true); } catch (e) {}
                fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
                fullscreenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                fullscreenWindow.setFullScreen(true);
            } catch (e) {
                console.warn('Mac fullscreen window tuning failed', e);
            }
        }
    });

    fullscreenWindow.loadFile('fullscreen-popup.html');

    fullscreenWindow.webContents.on('did-finish-load', () => {
        fullscreenWindow.webContents.send('set-fullscreen-data', data);
    });

    fullscreenWindow.on('close', (e) => {
        if (!isQuitting) {
            // WORKAROUND: Prevent premature window.close() calls from the broken internal timeout.
            // Only allow closing/hiding if no break timers are actively running.
            const breakOrPomoRunning = Object.entries(timers).some(([id, t]) => 
                t.timeout && (id.includes('break') || id.includes('pomo'))
            );
            
            if (breakOrPomoRunning) {
                e.preventDefault();
                return;
            }

            // Strip Mac locks before letting the window close naturally
            if (process.platform === 'darwin') {
                try { fullscreenWindow.setKiosk(false); } catch (e) {}
                try { fullscreenWindow.setAlwaysOnTop(false); } catch (e) {}
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
        if (macBlockActive) {
            try {
                fullscreenWindow.focus();
                fullscreenWindow.setAlwaysOnTop(true);
                fullscreenWindow.setAlwaysOnTop(false);
            } catch (e) {}
        }
    });

    // If user minimizes or hides the window, immediately restore it while blocking
    fullscreenWindow.on('minimize', () => {
        if (macBlockActive) {
            try { fullscreenWindow.restore(); fullscreenWindow.focus(); } catch (e) {}
        }
    });
    fullscreenWindow.on('hide', () => {
        if (macBlockActive) {
            try { fullscreenWindow.show(); fullscreenWindow.focus(); } catch (e) {}
        }
    });
}

// --- Timer State (Main Process) ---
let timers = {};

setInterval(() => {
    const now = Date.now();
    for (const [id, timer] of Object.entries(timers)) {
        if (timer.timeout) {
            timer.seconds = Math.max(0, Math.round((timer.endTime - now) / 1000));
        }
        const state = {
            id,
            running: !!timer.timeout,
            seconds: timer.seconds || 0,
            phase: timer.phase || '',
            percent: timer.percent
        };
        if (mainWindow) mainWindow.webContents.send('timer-tick', state);
        if (pomoTimerWindow && !pomoTimerWindow.isDestroyed()) pomoTimerWindow.webContents.send('timer-tick', state);
    }
}, 1000);

// --- IPC Listeners ---

ipcMain.on('start-timer', (event, data) => {
    const { id, seconds } = data;
    if (timers[id] && timers[id].timeout) clearTimeout(timers[id].timeout);
    
    const durationMs = seconds * 1000;
    const endTime = Date.now() + durationMs;

    timers[id] = {
        seconds: seconds,
        endTime: endTime,
        timeout: setTimeout(() => {
            timers[id].seconds = 0;
            timers[id].timeout = null;
            if (mainWindow) {
                mainWindow.webContents.send(`timer-complete-${id}`);
            }
        }, durationMs)
    };

    if (mainWindow) {
        mainWindow.webContents.send(`timer-started-${id}`, endTime);
    }
});

ipcMain.on('stop-timer', (event, id) => {
    if (timers[id] && timers[id].timeout) {
        clearTimeout(timers[id].timeout);
        timers[id].timeout = null;
        timers[id].seconds = 0;
    }
    if (mainWindow) {
        mainWindow.webContents.send(`timer-stopped-${id}`);
    }
});

ipcMain.on('pause-timer', (event, id) => {
    if (timers[id] && timers[id].timeout) {
        clearTimeout(timers[id].timeout);
        timers[id].timeout = null;
        const remaining = Math.round((timers[id].endTime - Date.now()) / 1000);
        timers[id].seconds = Math.max(0, remaining);
    }
    if (mainWindow) {
        mainWindow.webContents.send(`timer-paused-${id}`);
    }
});

ipcMain.on('resume-timer', (event, id) => {
    if (timers[id] && !timers[id].timeout && timers[id].seconds > 0) {
        const durationMs = timers[id].seconds * 1000;
        const endTime = Date.now() + durationMs;
        timers[id].endTime = endTime;
        
        timers[id].timeout = setTimeout(() => {
            timers[id].seconds = 0;
            timers[id].timeout = null;
            if (mainWindow) {
                mainWindow.webContents.send(`timer-complete-${id}`);
            }
        }, durationMs);

        if (mainWindow) {
            mainWindow.webContents.send(`timer-resumed-${id}`, endTime);
        }
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
    if (popupWindow) {
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

ipcMain.on('show-break-popup', (event, data) => {
    if (data.fullScreen) {
        createFullscreenWindow(data);
    } else {
        createPopupWindow(data.message || `Time for a ${data.type}!`, 10000, null, true);
    }
});

ipcMain.on('close-fullscreen', () => {
    // WORKAROUND: Prevent the fullscreen-popup's broken internal timeout from closing the window early.
    // Only allow closing if no break timers are actively running.
    const breakOrPomoRunning = Object.entries(timers).some(([id, t]) => 
        t.timeout && (id.includes('break') || id.includes('pomo'))
    );
    
    if (breakOrPomoRunning) {
        return;
    }

    if (fullscreenWindow) {
        fullscreenWindow.close();
    }
    // Only restore the Pomo Timer if it wasn't just explicitly hidden
    if (pomoTimerWindow && !pomoTimerWindow.isDestroyed() && pomoTimerWindow.isVisible()) {
        pomoTimerWindow.show();
        pomoTimerWindow.focus();
        pomoTimerWindow.setAlwaysOnTop(true);
    }
});

ipcMain.on('next-phase-triggered', () => {
    if (mainWindow) {
        mainWindow.webContents.send('start-next-phase');
    }
});

app.whenReady().then(() => {
  createWindow();
  if (process.platform === 'darwin') {
      try { app.dock.setIcon(path.join(__dirname, 'fokusicon.png')); } catch (e) {}
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
    try {
        if (fullscreenWindow) {
            if (process.platform === 'darwin') {
                try { fullscreenWindow.setKiosk(false); } catch (e) {}
            }
        }
        if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
            fullscreenWindow.close();
        }
    } catch (e) {}
    if (popupWindow) popupWindow.close();
});

function normalizeHost(value) {
    if (!value || typeof value !== 'string') return null;
    let input = value.trim();
    if (!input) return null;

    try {
        if (!/^https?:\/\//i.test(input)) {
            input = `http://${input}`;
        }
        return new URL(input).hostname.toLowerCase().split(':')[0];
    } catch (e) {
        const host = input.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0].split(':')[0].toLowerCase();
        return host || null;
    }
}

function runElevated(args, callback) {
    const command = `node "${helperPath}" ${args}`;
    sudo.exec(command, { name: 'SuperFokus' }, (error, stdout, stderr) => {
        if (callback) callback(error, stdout, stderr);
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
            // Store full URLs for path-specific blocking
            allUrls.add(url.trim());
        });
    }

    console.log('[Main] update-blocker-rules:', {mode: rules.mode, active: rules.active, hostCount: allHosts.size, urlCount: allUrls.size});

    if (rules.mode === 'allow' && rules.active && allHosts.size > 0) {
        console.log('[Block] Starting proxy server for allow-only mode');
        startProxy(allHosts, allUrls);
        if (mainWindow) {
            mainWindow.webContents.send('blocker-status', '✓ Allow-only mode ACTIVE. Browser proxy MUST be set to localhost:8080. Only listed sites will be accessible.');
        }
    } else if (rules.mode === 'block' && rules.active && allHosts.size > 0) {
        console.log('[Block] Applying hosts blocks for', allHosts.size, 'domains');
        const domainsList = Array.from(allHosts).join(',');
        
        runElevated(`apply "${domainsList}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('[Block] Blocker elevation error:', error);
                const errorMsg = error.message || 'Failed to apply Site Blocker.';
                if (mainWindow) {
                    mainWindow.webContents.send('blocker-error', errorMsg);
                }
            } else {
                if (stderr && stderr.includes('error')) {
                    console.error('[Block] Blocker helper error:', stderr);
                    if (mainWindow) {
                        mainWindow.webContents.send('blocker-error', `Domain format error: ${stderr}`);
                    }
                } else {
                    console.log('[Block] Blocker applied successfully:', stdout);
                    blocksApplied = true;
                    if (mainWindow) {
                        mainWindow.webContents.send('blocker-status', 'Domains blocked successfully');
                    }
                }
            }
        });
    } else {
        console.log('[Block] Clearing blocks and stopping proxy');
        stopProxy();
        if (blocksApplied) {
            runElevated('clear', (error, stdout, stderr) => {
                if (error) {
                    console.error('[Block] Blocker elevation error:', error);
                    if (mainWindow) {
                        mainWindow.webContents.send('blocker-error', 'Failed to clear Site Blocker blocks.');
                    }
                } else {
                    console.log('[Block] Blocker cleared:', stdout);
                    blocksApplied = false;
                    if (mainWindow) {
                        mainWindow.webContents.send('blocker-status', 'Blocks cleared successfully');
                    }
                }
            });
        }
    }
});

ipcMain.on('clear-all-blocks', () => {
    stopProxy();
    runElevated('clear', (error, stdout, stderr) => {
        if (error) {
            console.error('Blocker elevation error:', error);
            if (mainWindow) {
                mainWindow.webContents.send('blocker-error', 'Failed to clear all blocks.');
            }
        } else {
            console.log('All blocks cleared manually:', stdout);
            blocksApplied = false;
            if (mainWindow) {
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

ipcMain.on('close-popup', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }
});

let isClearingOnQuit = false;
app.on('will-quit', (e) => {
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
