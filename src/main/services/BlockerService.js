const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const sudo = require('sudo-prompt');
const { exec } = require('child_process');
const windowManager = require('./WindowManager');

// Blocker state
let blockerRules = {
    mode: 'block', // 'block' or 'allow'
    domains: [],
    urls: [],
    active: false,
    alwaysRun: false
};

let macBlockActive = false;
let proxyServer = null;
const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'main', 'fokus-sb-helper.js')
    : path.join(__dirname, '../fokus-sb-helper.js');
let blocksApplied = false;

function runElevated(command, commandArgs, callback) {
    console.log('[runElevated] Command:', command);
    const allowedCommands = ['clear', 'apply-file'];
    if (!allowedCommands.includes(command)) {
        if (callback) callback(new Error('Unauthorized command'));
        return;
    }

    const escapedArgs = commandArgs
        .map(arg => {
            const sanitized = arg.replace(/[^\w\s\-\.\:\/\\\[\]\{\}\(\)\,\_\=]/g, '');
            return `"${sanitized}"`;
        })
        .join(' ');

    const nodePath = process.execPath;
    let fullCommand;
    if (process.platform === 'win32') {
        // Use set "VAR=VAL" to avoid trailing spaces and ensure it works in cmd.exe
        fullCommand = `set "ELECTRON_RUN_AS_NODE=1" && "${nodePath}" "${helperPath}" ${command} ${escapedArgs}`;
    } else {
        fullCommand = `ELECTRON_RUN_AS_NODE=1 "${nodePath}" "${helperPath}" ${command} ${escapedArgs}`;
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
            try {
                parsedAllowedUrls.push(new URL(urlStr));
            } catch (e) {}
        });
    }

    proxyServer = http.createServer((req, res) => {
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const fullUrl = `http://${host}${req.url}`;
        const hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

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

    proxyServer.on('connect', (req, clientSocket, head) => {
        const host = req.url.split(':')[0].toLowerCase();
        const port = req.url.split(':')[1] || 443;
        let hostAllowed = allowedHosts.has(host) || allowedHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        if (!hostAllowed) {
            hostAllowed = parsedAllowedUrls.some(allowed => {
                return allowed.hostname === host || allowed.hostname === 'www.' + host || 'www.' + allowed.hostname === host;
            });
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
        } else {
            clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        }
    });

    proxyServer.listen(8080, '127.0.0.1', () => {
        console.log('✓ SuperFokus proxy server listening on localhost:8080');
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

function init() {
    ipcMain.on('update-blocker-rules', (event, rules) => {
        if (!windowManager.isOriginSafe(event)) return;
        blockerRules = rules;
        const allHosts = new Set();
        const allUrls = new Set();
        const { normalizeHost } = require('../../renderer/utils/utils.js');

        if (Array.isArray(rules.domains)) {
            rules.domains.forEach(domain => {
                const host = normalizeHost(domain);
                if (host) allHosts.add(host);
            });
        }

        if (Array.isArray(rules.urls)) {
            rules.urls.forEach(url => allUrls.add(url.trim()));
        }

        if (rules.mode === 'allow' && rules.active && allHosts.size > 0) {
            startProxy(allHosts, allUrls);
            if (process.platform === 'darwin') setMacProxy(true);
            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                windowManager.mainWindow.webContents.send('blocker-status', '✓ Allow-only mode ACTIVE.');
            }
        } else if (rules.mode === 'block' && rules.active && allHosts.size > 0) {
            const domains = Array.from(allHosts);
            const tempPath = path.join(app.getPath('userData'), 'fokus_domains.json');
            fs.promises.writeFile(tempPath, JSON.stringify(domains))
                .then(() => {
                    runElevated('apply-file', [tempPath], (error) => {
                        if (error) {
                            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-error', error.message);
                        } else {
                            blocksApplied = true;
                            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'Domains blocked successfully');
                        }
                    });
                })
                .catch(e => {
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-error', 'Failed to prepare domain list.');
                });
        } else {
            stopProxy();
            if (process.platform === 'darwin') setMacProxy(false);
            if (blocksApplied) {
                runElevated('clear', [], (error) => {
                    if (!error) blocksApplied = false;
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'Blocks cleared');
                });
            }
        }
    });

    ipcMain.on('clear-all-blocks', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        stopProxy();
        runElevated('clear', [], (error) => {
            if (error) {
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-error', 'Failed to clear all blocks.');
            } else {
                blocksApplied = false;
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'All blocks cleared');
            }
        });
    });

    ipcMain.on('blocker-start', (event, data) => {
        macBlockActive = false;
        let msg = typeof data === 'string' ? data : (data?.message || '');
        windowManager.createPopupWindow(msg, 10000, null, true);
    });

    ipcMain.on('blocker-stop', () => {
        macBlockActive = false;
        windowManager.forceKillFullscreen();
        if (windowManager.popupWindow && !windowManager.popupWindow.isDestroyed()) windowManager.popupWindow.close();
    });
}

function cleanup(callback) {
    stopProxy();
    if (blocksApplied) {
        runElevated('clear', [], () => {
            blocksApplied = false;
            if (callback) callback();
        });
        return true; // async cleanup
    }
    return false;
}

module.exports = {
    init,
    cleanup,
    runElevated,
    getBlocksApplied: () => blocksApplied
};
