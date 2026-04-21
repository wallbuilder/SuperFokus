const { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

let mainWindow = null;
let popupWindow = null;
let pomoTimerWindow = null;
let fullscreenWindow = null;
let tray = null;
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
        const hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
    }
  });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    let trayIcon;
    
    if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
    } else {
        // Fallback robust icon (a simple 16x16 red square)
        const fallbackBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAcSURBVDhPY3D///9/MAwwYIAmHwwYNRBAwMAwAAD+aAYg0HpxHgAAAABJRU5ErkJggg==';
        trayIcon = nativeImage.createFromDataURL(`data:image/png;base64,${fallbackBase64}`);
    }

    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show SuperFokus', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => {
            isQuitting = true;
            app.quit();
        }}
    ]);
    tray.setToolTip('SuperFokus');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.show());
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

function createPopupWindow(message, autoDismissMs = 10000, healthType = null) {
    const isBlocking = healthType && healthConfig.blockingMode === 'fullscreen';

    if (popupWindow) {
        popupWindow.show();
        popupWindow.webContents.send('display-message', {
            message,
            closeDelay: autoDismissMs,
            healthType,
            isBlocking
        });
    } else {
        if (isBlocking) {
            // Fullscreen blocking mode for mandatory health breaks
            popupWindow = new BrowserWindow({
                width: app.getPrimaryDisplay().workAreaSize.width,
                height: app.getPrimaryDisplay().workAreaSize.height,
                x: 0,
                y: 0,
                alwaysOnTop: true,
                frame: false,
                fullscreen: false,
                resizable: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
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
                    nodeIntegration: true,
                    contextIsolation: false,
                },
            });
        }

        // Mac-specific visibility and level to keep popup on top of other apps/workspaces
        if (process.platform === 'darwin') {
            try {
                popupWindow.setAlwaysOnTop(true, 'screen-saver');
                popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                popupWindow.setFullScreenable(false);
            } catch (e) {
                console.warn('Mac popup window tuning failed', e);
            }
        }

        popupWindow.loadFile('popup.html');
        
        popupWindow.webContents.on('did-finish-load', () => {
            popupWindow.webContents.send('display-message', payload);
        });

        popupWindow.on('close', (e) => {
            e.preventDefault();
            popupWindow.hide();
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
            if (popupWindow && !popupWindow.isDestroyed()) {
                popupWindow.close();
            }
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
        pomoTimerWindow.setAlwaysOnTop(true, 'screen-saver');
        pomoTimerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (e) {
        console.warn('Pomo timer window tuning failed', e);
    }

    pomoTimerWindow.loadFile('pomo-timer.html');

    pomoTimerWindow.webContents.on('did-finish-load', () => {
        pomoTimerWindow.webContents.send('set-theme', currentThemeIsDark);
    });

    pomoTimerWindow.on('close', (e) => {
        e.preventDefault();
        pomoTimerWindow.hide();
        if (mainWindow) {
            mainWindow.webContents.send('pomo-popup-closed');
        }
    });
}

function createFullscreenWindow(data) {
    if (fullscreenWindow) {
        fullscreenWindow.show();
        fullscreenWindow.webContents.send('set-fullscreen-data', data);
        return;
    }

    fullscreenWindow = new BrowserWindow({
        fullscreen: true,
        alwaysOnTop: true,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false
        },
    });

    // Mac-specific tuning to try and keep the fullscreen blocker above other apps
    if (process.platform === 'darwin') {
        try {
            // Try to enable kiosk/fullscreen immediately to reduce race where user can switch away
            try { fullscreenWindow.setKiosk(true); } catch (e) {}
            fullscreenWindow.setAlwaysOnTop(true, 'screen-saver');
            fullscreenWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            fullscreenWindow.setFullScreen(true);
        } catch (e) {
            console.warn('Mac fullscreen window tuning failed', e);
        }
    }

    fullscreenWindow.loadFile('fullscreen-popup.html');

    fullscreenWindow.webContents.on('did-finish-load', () => {
        fullscreenWindow.webContents.send('set-fullscreen-data', data);
    });

    fullscreenWindow.on('close', (e) => {
        e.preventDefault();
        fullscreenWindow.hide();
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
            percent: timer.percent || 0
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
        createPopupWindow(payload.message, payload.closeDelay, payload.healthType || null);
    } else {
        createPopupWindow(payload);
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
        createPopupWindow(`Time for a ${data.type}!`);
    }
});

ipcMain.on('close-fullscreen', () => {
    if (fullscreenWindow) {
        fullscreenWindow.close();
    }
    if (pomoTimerWindow) {
        pomoTimerWindow.show();
        pomoTimerWindow.focus();
        pomoTimerWindow.setAlwaysOnTop(true);
        pomoTimerWindow.setAlwaysOnTop(false);
    }
});

ipcMain.on('next-phase-triggered', () => {
    if (mainWindow) {
        mainWindow.webContents.send('start-next-phase');
    }
});

app.whenReady().then(() => {
  createWindow();
  try {
      createTray();
  } catch(e) {
      console.log("Tray creation failed (likely missing icon.png)");
  }
  createApplicationMenu();

  // Startup Cleanup: Clear any zombie blocks from previous ungraceful exits
  const { exec } = require('child_process');
  const hp = path.join(__dirname, 'fokus-sb-helper.js');
  let cmd = `pkexec node "${hp}" clear`;
  if (process.platform === 'win32') {
      cmd = `powershell.exe -Command "Start-Process node -ArgumentList '\\"${hp}\\" clear' -Verb RunAs"`;
  } else if (process.platform === 'darwin') {
      cmd = `osascript -e 'do shell script "node \\"${hp}\\" clear" with administrator privileges'`;
  }
  exec(cmd, () => { console.log('[Startup] Checked and cleared zombie blocks.'); });

  process.on('uncaughtException', (err) => {
      console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
      exec(cmd, () => {
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
    createPopupWindow(message);
});

ipcMain.on('blocker-expand-fullscreen', (event, data) => {
    macBlockActive = true;
    createFullscreenWindow(data);
    // try to enable kiosk for stricter lock on mac
    if (process.platform === 'darwin' && fullscreenWindow) {
        try {
            fullscreenWindow.setKiosk(true);
        } catch (e) {}
    }
});

ipcMain.on('blocker-start', (event, data) => {
    // Only enable the mac-specific focus-lock flag on macOS
    macBlockActive = (process.platform === 'darwin');
    // Pass the whole data object to the popup so renderer can show countdown and expand
    if (data) createPopupWindow(data);
    else createPopupWindow('');
});

ipcMain.on('blocker-stop', () => {
    macBlockActive = false;
    try {
        if (fullscreenWindow) {
            if (process.platform === 'darwin') {
                try { fullscreenWindow.setKiosk(false); } catch (e) {}
            }
            fullscreenWindow.close();
        }
    } catch (e) {}
    if (popupWindow) popupWindow.close();
});
const { exec } = require('child_process');
const helperPath = path.join(__dirname, 'fokus-sb-helper.js');
let blocksApplied = false;

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
        let cmd = `pkexec node "${helperPath}" apply "${domainsList}"`;
        if (process.platform === 'win32') {
            cmd = `powershell.exe -Command "Start-Process node -ArgumentList '\\"${helperPath}\\" apply \\"${domainsList}\\"' -Verb RunAs"`;
        } else if (process.platform === 'darwin') {
            cmd = `osascript -e 'do shell script "node \\"${helperPath}\\" apply \\"${domainsList}\\"" with administrator privileges'`;
        }
        exec(cmd, (error, stdout, stderr) => {
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
            sudo.exec(`node "${helperPath}" clear`, { name: 'SuperFokus' }, (error, stdout, stderr) => {
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
    sudo.exec(`node "${helperPath}" clear`, { name: 'SuperFokus' }, (error, stdout, stderr) => {
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
        let cmd = `pkexec node "${helperPath}" clear`;
        if (process.platform === 'win32') {
            cmd = `powershell.exe -Command "Start-Process node -ArgumentList '\\"${helperPath}\\" clear' -Verb RunAs"`;
        } else if (process.platform === 'darwin') {
            cmd = `osascript -e 'do shell script "node \\"${helperPath}\\" clear" with administrator privileges'`;
        }
        exec(cmd, () => {
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




app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app.quit(); // Handled by tray/isQuitting
  }
});



