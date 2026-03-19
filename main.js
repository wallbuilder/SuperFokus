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

function createPopupWindow(message) {
    if (popupWindow) {
        popupWindow.close();
    }

    popupWindow = new BrowserWindow({
        width: 400,
        height: 250,
        alwaysOnTop: true,
        frame: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    popupWindow.loadFile('popup.html');
    
    popupWindow.webContents.on('did-finish-load', () => {
        popupWindow.webContents.send('display-message', message);
    });

    popupWindow.on('closed', () => {
        popupWindow = null;
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

    fullscreenWindow.loadFile('fullscreen-popup.html');

    fullscreenWindow.webContents.on('did-finish-load', () => {
        fullscreenWindow.webContents.send('set-fullscreen-data', data);
    });

    fullscreenWindow.on('closed', () => {
        fullscreenWindow = null;
    });
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

  // --- WebRequest Blocker Intercept ---
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (!blockerRules.active || (!blockerRules.domains.length && !blockerRules.urls.length)) {
      return callback({ cancel: false });
    }

    try {
      const urlObj = new URL(details.url);
      const hostname = urlObj.hostname;

      let isMatch = false;

      // Check Domains
      for (const domain of blockerRules.domains) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          isMatch = true;
          break;
        }
      }

      // Check specific URLs
      if (!isMatch) {
        for (const blockedUrl of blockerRules.urls) {
          if (details.url.startsWith(blockedUrl)) {
            isMatch = true;
            break;
          }
        }
      }

      if (blockerRules.mode === 'block') {
        callback({ cancel: isMatch });
      } else {
        if (details.url.startsWith('devtools://') || details.url.startsWith('file://') || details.url.startsWith('chrome-extension://')) {
             callback({ cancel: false });
        } else {
             callback({ cancel: !isMatch });
        }
      }
    } catch (e) {
      callback({ cancel: false });
    }
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
ipcMain.on('update-blocker-rules', (event, rules) => {
    blockerRules = rules;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app.quit(); // Handled by tray/isQuitting
  }
});
