const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const sudo = require('@vscode/sudo-prompt');
const { exec } = require('child_process');
const windowManager = require('./WindowManager');

let blockerRules = {
    mode: 'block',
    domains: [],
    urls: [],
    active: false,
    alwaysRun: false
};

let store = null;
let proxyServer = null;
const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'main', 'fokus-sb-helper.js')
    : path.join(__dirname, '../fokus-sb-helper.js');
let blocksApplied = false;

function runElevated(command, commandArgs, callback) {
    const allowedCommands = ['clear', 'apply-file', 'set-mac-proxy'];
    if (!allowedCommands.includes(command)) {
        if (callback) callback(new Error('Unauthorized command'));
        return;
    }
    const base64Args = Buffer.from(JSON.stringify(commandArgs)).toString('base64');
    const nodePath = process.execPath;
    let fullCommand;
    if (process.platform === 'win32') {
        fullCommand = `set "ELECTRON_RUN_AS_NODE=1" && set "NODE_OPTIONS=" && "${nodePath}" "${helperPath}" ${command} ${base64Args}`;
    } else {
        fullCommand = `ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS="" "${nodePath}" "${helperPath}" ${command} ${base64Args}`;
    }
    sudo.exec(fullCommand, { name: 'SuperFokus' }, (error, stdout, stderr) => {
        if (callback) callback(error, stdout, stderr);
    });
}

function startProxy(allowedHosts, allowedUrls) {
    if (proxyServer) proxyServer.close();
    const parsedAllowedUrls = [];
    if (allowedUrls) {
        allowedUrls.forEach(urlStr => {
            try { parsedAllowedUrls.push(new URL(urlStr)); } catch (e) {}
        });
    }
    proxyServer = http.createServer((req, res) => {
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const fullUrl = `http://${host}${req.url}`;
        const hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) || ['localhost', '127.0.0.1', '[::1]'].includes(host);
        let urlAllowed = false;
        if (!hostAllowed) {
            try {
                const requested = new URL(fullUrl);
                urlAllowed = parsedAllowedUrls.some(allowed => allowed.hostname === requested.hostname && requested.pathname.startsWith(allowed.pathname));
            } catch (e) {}
        }
        if (hostAllowed || urlAllowed) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('<html><body><h1>Allowed by SuperFokus</h1></body></html>');
        } else {
            res.writeHead(503, {'Content-Type': 'text/html'});
            res.end('<html><body style="font-family:Arial;margin:50px;background:#f8d7da;"><h1>Service Unavailable</h1><p>Blocked by SuperFokus.</p></body></html>');
        }
    });
    proxyServer.on('connect', (req, clientSocket, head) => {
        const host = req.url.split(':')[0].toLowerCase();
        const port = req.url.split(':')[1] || 443;
        let hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) || ['localhost', '127.0.0.1', '[::1]'].includes(host);
        if (!hostAllowed) {
            hostAllowed = parsedAllowedUrls.some(allowed => allowed.hostname === host || allowed.hostname === 'www.' + host || 'www.' + allowed.hostname === host);
        }
        if (hostAllowed) {
            const serverSocket = net.connect(port, host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                serverSocket.write(head);
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });
            serverSocket.on('error', () => { try { clientSocket.end(); } catch (e) {} });
            clientSocket.on('error', () => { try { serverSocket.end(); } catch (e) {} });
        } else { clientSocket.end(); }
    });
    proxyServer.listen(8080, '127.0.0.1', () => {
        if (process.platform === 'win32') {
            exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f && reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d 127.0.0.1:8080 /f');
        }
    });
}

function stopProxy() {
    if (proxyServer) {
        proxyServer.close();
        proxyServer = null;
        if (process.platform === 'win32') {
            exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f');
        }
    }
}

function setMacProxy(enable) {
    if (process.platform !== 'darwin') return;
    const services = ['Wi-Fi', 'Ethernet', 'Thunderbolt Bridge'];
    runElevated('set-mac-proxy', [{ enable, services }], (error) => {
        if (error) {
            console.error('[BlockerService] Mac proxy elevation failed:', error.message);
        }
    });
}

async function init() {
    try {
        const { default: Store } = await import('electron-store');
        store = new Store();
        const saved = store.get('blocker-rules');
        if (saved) {
            blockerRules = saved;
        }
    } catch (e) { console.error('[BlockerService] Store init failed', e); }

    // Handle startup clearing correctly
    if (blockerRules.active && blockerRules.alwaysRun) {
        console.log('[BlockerService] Applying always-run rules on startup');
        updateRules(blockerRules);
    } else {
        console.log('[BlockerService] Startup cleanup (failsafe)');
        runElevated('clear', [], (error) => {
            if (error) {
                console.error('[BlockerService] Startup clear failed:', error.message);
            } else {
                blocksApplied = false;
            }
        });
    }

    ipcMain.on('update-blocker-rules', (event, rules) => {
        if (!windowManager.isOriginSafe(event)) return;
        blockerRules = rules;
        if (store) store.set('blocker-rules', rules);
        updateRules(rules);
    });

    ipcMain.on('clear-all-blocks', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        stopProxy();
        if (process.platform === 'darwin') setMacProxy(false);
        runElevated('clear', [], (error) => {
            if (error) {
                if (windowManager.mainWindow) windowManager.mainWindow.webContents.send('blocker-error', 'Clear failed');
            } else {
                blocksApplied = false;
                if (windowManager.mainWindow) windowManager.mainWindow.webContents.send('blocker-status', 'All blocks cleared');
            }
        });
    });

    ipcMain.on('blocker-start', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.createPopupWindow(typeof data === 'string' ? data : data?.message, 10000, null, true);
    });

    ipcMain.on('blocker-stop', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        windowManager.forceKillFullscreen();
        if (windowManager.popupWindow && !windowManager.popupWindow.isDestroyed()) windowManager.popupWindow.close();
    });
}

function updateRules(rules) {
    const allHosts = new Set();
    const allUrls = new Set();
    if (Array.isArray(rules.domains)) rules.domains.forEach(d => { if (d) allHosts.add(d); });
    if (Array.isArray(rules.urls)) rules.urls.forEach(u => allUrls.add(u.trim()));

    if (rules.mode === 'allow' && rules.active && allHosts.size > 0) {
        startProxy(allHosts, allUrls);
        if (process.platform === 'darwin') setMacProxy(true);
        if (windowManager.mainWindow) windowManager.mainWindow.webContents.send('blocker-status', 'Allow-only mode ACTIVE');
    } else if (rules.mode === 'block' && rules.active && allHosts.size > 0) {
        const domains = Array.from(allHosts);
        const tempPath = path.join(app.getPath('userData'), 'fokus_domains.json');
        fs.writeFileSync(tempPath, JSON.stringify(domains));
        runElevated('apply-file', [tempPath], (error) => {
            if (error) {
                if (windowManager.mainWindow) windowManager.mainWindow.webContents.send('blocker-error', error.message);
            } else {
                blocksApplied = true;
                if (windowManager.mainWindow) windowManager.mainWindow.webContents.send('blocker-status', 'Domains blocked');
            }
        });
    } else {
        stopProxy();
        if (process.platform === 'darwin') setMacProxy(false);
        if (blocksApplied) {
            runElevated('clear', [], (error) => { if (!error) blocksApplied = false; });
        }
    }
}

function cleanup(callback) {
    if (blockerRules.active && blockerRules.alwaysRun) {
        if (callback) callback();
        return false;
    }
    stopProxy();
    if (process.platform === 'darwin') setMacProxy(false);
    if (blocksApplied) {
        runElevated('clear', [], () => {
            blocksApplied = false;
            if (callback) callback();
        });
        return true;
    }
    if (callback) callback();
    return false;
}

module.exports = { init, cleanup, runElevated, stopProxy, setMacProxy, getBlocksApplied: () => blocksApplied };
