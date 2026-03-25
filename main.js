const { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

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
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
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

function createPopupWindow(message, closeDelay = 10000) {
    if (popupWindow) {
        popupWindow.close();
    }

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
        popupWindow.webContents.send('display-message', { message, closeDelay });
    });

    popupWindow.on('closed', () => {
        popupWindow = null;
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

let currentThemeIsDark = false;

ipcMain.on('theme-changed', (event, isDark) => {
    currentThemeIsDark = isDark;
    if (pomoTimerWindow) {
        pomoTimerWindow.webContents.send('set-theme', isDark);
    }
});

function createPomoTimerWindow() {
    if (pomoTimerWindow) return;

    pomoTimerWindow = new BrowserWindow({
        width: 350,
        height: 200,
        alwaysOnTop: true,
        frame: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false // Important for background reliability
        },
    });

    pomoTimerWindow.loadFile('pomo-timer.html');

    pomoTimerWindow.webContents.on('did-finish-load', () => {
        pomoTimerWindow.webContents.send('set-theme', currentThemeIsDark);
    });

    pomoTimerWindow.on('closed', () => {
        pomoTimerWindow = null;
        if (mainWindow) {
            mainWindow.webContents.send('pomo-popup-closed');
        }
    });
}

function createFullscreenWindow(data) {
    if (fullscreenWindow) {
        fullscreenWindow.close();
    }

    fullscreenWindow = new BrowserWindow({
        fullscreen: true,
        alwaysOnTop: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
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

    fullscreenWindow.on('closed', () => {
        fullscreenWindow = null;
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

    // Start a periodic enforcer to keep focus on mac while blocker active
    if (process.platform === 'darwin') {
        try {
            if (macFocusEnforcer) clearInterval(macFocusEnforcer);
            macFocusEnforcer = setInterval(() => {
                if (macBlockActive && fullscreenWindow) {
                    try {
                        if (!fullscreenWindow.isDestroyed()) {
                            fullscreenWindow.focus();
                            fullscreenWindow.setAlwaysOnTop(true);
                            fullscreenWindow.setAlwaysOnTop(false);
                        }
                    } catch (e) {}
                }
            }, 1000);
        } catch (e) {}
    }
}

// --- Timer State (Main Process) ---
let timers = {};

// --- IPC Listeners ---

ipcMain.on('start-timer', (event, data) => {
    const { id, seconds } = data;
    if (timers[id] && timers[id].interval) clearInterval(timers[id].interval);
    
    timers[id] = {
        seconds: seconds,
        endTime: Date.now() + (seconds * 1000),
        interval: setInterval(() => {
            const remaining = Math.round((timers[id].endTime - Date.now()) / 1000);
            timers[id].seconds = Math.max(0, remaining);
            if (mainWindow) {
                mainWindow.webContents.send(`timer-tick-${id}`, timers[id].seconds);
            }
            if (id === 'pomo' && pomoTimerWindow) {
                pomoTimerWindow.webContents.send('timer-tick', timers[id].seconds);
            }

            if (timers[id].seconds <= 0) {
                clearInterval(timers[id].interval);
                timers[id].interval = null;
                if (mainWindow) {
                    mainWindow.webContents.send(`timer-complete-${id}`);
                }
            }
        }, 1000)
    };
});

ipcMain.on('stop-timer', (event, id) => {
    if (timers[id] && timers[id].interval) {
        clearInterval(timers[id].interval);
        timers[id].interval = null;
    }
});

ipcMain.on('pause-timer', (event, id) => {
    if (timers[id] && timers[id].interval) {
        clearInterval(timers[id].interval);
        timers[id].interval = null;
    }
});

ipcMain.on('resume-timer', (event, id) => {
    if (timers[id] && !timers[id].interval && timers[id].seconds > 0) {
        timers[id].endTime = Date.now() + (timers[id].seconds * 1000);
        timers[id].interval = setInterval(() => {
            const remaining = Math.round((timers[id].endTime - Date.now()) / 1000);
            timers[id].seconds = Math.max(0, remaining);
            if (mainWindow) {
                mainWindow.webContents.send(`timer-tick-${id}`, timers[id].seconds);
            }
            if (id === 'pomo' && pomoTimerWindow) {
                pomoTimerWindow.webContents.send('timer-tick', timers[id].seconds);
            }

            if (timers[id].seconds <= 0) {
                clearInterval(timers[id].interval);
                timers[id].interval = null;
                if (mainWindow) {
                    mainWindow.webContents.send(`timer-complete-${id}`);
                }
            }
        }, 1000);
    }
});

ipcMain.on('show-popup', (event, message) => {
    createPopupWindow(message);
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

  // Note: WebRequest API is deprecated in Electron 14+
  // Site blocking is now handled via hosts file modification in fokus-sb-helper.js

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
    // Clear enforcer interval
    if (macFocusEnforcer) {
        clearInterval(macFocusEnforcer);
        macFocusEnforcer = null;
    }
});
const util = require('util');
if (!util.isObject) {
  util.isObject = function(val) {
    return val !== null && typeof val === 'object';
  };
}
const sudo = require('sudo-prompt');
const helperPath = path.join(__dirname, 'fokus-sb-helper.js');
let blocksApplied = false;

ipcMain.on('update-blocker-rules', (event, rules) => {
    blockerRules = rules;
    if (rules.active && rules.mode === 'block' && rules.domains.length > 0) {
        const domainsList = rules.domains.join(',');
        sudo.exec(`node "${helperPath}" apply "${domainsList}"`, { name: 'SuperFokus' }, (error, stdout, stderr) => {
            if (error) {
                console.error('Blocker elevation error:', error);
                const errorMsg = error.message || 'Failed to apply Site Blocker. Admin privileges may be required or hosts file is inaccessible.';
                if (mainWindow) {
                    mainWindow.webContents.send('blocker-error', errorMsg);
                }
            } else {
                // Check for errors in stderr (from async helper script)
                if (stderr && stderr.includes('error')) {
                    console.error('Blocker helper error:', stderr);
                    if (mainWindow) {
                        mainWindow.webContents.send('blocker-error', `Domain format error: ${stderr}`);
                    }
                } else {
                    console.log('Blocker applied:', stdout);
                    blocksApplied = true;
                    if (mainWindow) {
                        mainWindow.webContents.send('blocker-status', 'Domains blocked successfully');
                    }
                }
            }
        });
    } else if (blocksApplied) {
        sudo.exec(`node "${helperPath}" clear`, { name: 'SuperFokus' }, (error, stdout, stderr) => {
            if (error) {
                console.error('Blocker elevation error:', error);
                if (mainWindow) {
                    mainWindow.webContents.send('blocker-error', 'Failed to clear Site Blocker blocks.');
                }
            } else {
                console.log('Blocker cleared:', stdout);
                blocksApplied = false;
                if (mainWindow) {
                    mainWindow.webContents.send('blocker-status', 'Blocks cleared successfully');
                }
            }
        });
    }
});

ipcMain.on('clear-all-blocks', () => {
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

ipcMain.on('start-health-mode', (event, data) => {
    if (healthIntervals.eye) clearInterval(healthIntervals.eye);
    if (healthIntervals.posture) clearInterval(healthIntervals.posture);
    
    if (data.eyeSaver) {
        healthIntervals.eye = setInterval(() => {
            createPopupWindow("Eye Saver: Look at something 20 feet away for 20 seconds.");
        }, 20 * 60 * 1000); // 20 mins
    }
    if (data.postureCheck) {
        healthIntervals.posture = setInterval(() => {
            createPopupWindow("Posture Check: Time to sit up straight and stretch for a minute.");
        }, 45 * 60 * 1000); // 45 mins
    }
});

ipcMain.on('stop-health-mode', () => {
    if (healthIntervals.eye) clearInterval(healthIntervals.eye);
    if (healthIntervals.posture) clearInterval(healthIntervals.posture);
});

let isClearingOnQuit = false;
app.on('will-quit', (e) => {
    if (blocksApplied && !isClearingOnQuit) {
        e.preventDefault();
        isClearingOnQuit = true;
        sudo.exec(`node "${helperPath}" clear`, { name: 'SuperFokus' }, () => {
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


