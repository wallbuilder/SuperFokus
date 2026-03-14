const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let popupWindow = null;
let pomoTimerWindow = null;
let fullscreenWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simplicity in prototyping, adjust later for security
    },
  });

  mainWindow.loadFile('index.html');
}

function createPopupWindow(message) {
    if (popupWindow) {
        popupWindow.close();
    }

    popupWindow = new BrowserWindow({
        width: 350,
        height: 200,
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

function createPomoTimerWindow() {
    if (pomoTimerWindow) return;

    pomoTimerWindow = new BrowserWindow({
        width: 250,
        height: 150,
        alwaysOnTop: true,
        frame: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    pomoTimerWindow.loadFile('pomo-timer.html');

    pomoTimerWindow.on('closed', () => {
        pomoTimerWindow = null;
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

// --- IPC Listeners ---

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
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
