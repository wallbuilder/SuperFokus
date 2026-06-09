const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const sudo = require('@vscode/sudo-prompt');
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

    // Use Base64 encoding for arguments to ensure they pass through the shell safely without injection risks
    const base64Args = Buffer.from(JSON.stringify(commandArgs)).toString('base64');

    const nodePath = process.execPath;
    let fullCommand;
    if (process.platform === 'win32') {
        // Use set "VAR=VAL" to avoid trailing spaces and ensure it works in cmd.exe
        // We also clear NODE_OPTIONS to prevent VS Code's debugger from trying to attach to the helper script
        fullCommand = `set "ELECTRON_RUN_AS_NODE=1" && set "NODE_OPTIONS=" && "${nodePath}" "${helperPath}" ${command} ${base64Args}`;
    } else {
        fullCommand = `ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS="" "${nodePath}" "${helperPath}" ${command} ${base64Args}`;
    }

    sudo.exec(fullCommand, { name: 'SuperFokus' }, (error, stdout, stderr) => {
        if (callback) callback(error, stdout, stderr);
    });
    }

function refreshWindowsProxy() {
    if (process.platform === 'win32') {
        const psScript = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class WinInet { [DllImport("wininet.dll", SetLastError = true)] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength); }'; [WinInet]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0); [WinInet]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0);`;
        exec(`powershell -WindowStyle Hidden -Command "${psScript}"`, (err) => {
            if (err) console.error('[Proxy] Failed to refresh Windows proxy:', err);
        });
    }
}

function startProxy(targetHosts, targetUrls, mode = 'allow') {
    if (proxyServer) proxyServer.close();

    const parsedUrls = [];
    if (targetUrls) {
        targetUrls.forEach(urlStr => {
            try {
                let formatted = urlStr;
                if (!/^https?:\/\//i.test(formatted)) formatted = 'https://' + formatted;
                parsedUrls.push(new URL(formatted));
            } catch (e) {}
        });
    }

    proxyServer = http.createServer((req, res) => {
        const host = (req.headers.host || '').split(':')[0].toLowerCase();
        const fullUrl = `http://${host}${req.url}`;
        const isHostMatch = targetHosts.has(host) || targetHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        let isUrlMatch = false;
        try {
            const requested = new URL(fullUrl);
            isUrlMatch = parsedUrls.some(target => {
                return target.hostname === requested.hostname &&
                       requested.pathname.startsWith(target.pathname);
            });
        } catch (e) {}

        if (mode === 'allow') {
            if (isHostMatch || isUrlMatch) {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('<html><body><h1>✓ Allowed by SuperFokus</h1></body></html>');
            } else {
                res.writeHead(503, {'Content-Type': 'text/html'});
                res.end('<html><body style="font-family:Arial;margin:50px;background:#f8d7da;"><h1>⚠️ Service Unavailable</h1><p>This service is temporarily not operational during your focus session.</p></body></html>');
            }
        } else {
            // Block mode
            if (targetHosts.has(host) || targetHosts.has('www.' + host) || isUrlMatch) {
                res.writeHead(403, {'Content-Type': 'text/html'});
                res.end('<html><body style="font-family:Arial;margin:50px;background:#f8d7da;"><h1>⚠️ Blocked by SuperFokus</h1><p>This URL is restricted during your focus session.</p></body></html>');
            } else {
                // Transparent proxy pass-through for unblocked HTTP traffic
                const options = { hostname: host, port: 80, path: req.url, method: req.method, headers: req.headers };
                const proxyReq = http.request(options, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res);
                });
                proxyReq.on('error', () => { res.writeHead(502); res.end(); });
                req.pipe(proxyReq);
            }
        }
    });

    proxyServer.on('connect', (req, clientSocket, head) => {
        const host = req.url.split(':')[0].toLowerCase();
        const port = req.url.split(':')[1] || 443;
        
        let isHostMatch = targetHosts.has(host) || targetHosts.has('www.' + host) ||
                          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

        let isUrlHostMatch = parsedUrls.some(target => target.hostname === host || target.hostname === 'www.' + host || 'www.' + target.hostname === host);

        let allowConnection = false;
        
        if (mode === 'allow') {
            allowConnection = isHostMatch || isUrlHostMatch;
        } else {
            // In block mode, if the whole host is blocked, deny connection.
            // If only the URL matches the host, we MUST allow connection here (because we cannot see HTTPS paths), 
            // so we don't accidentally break the entire domain for the user.
            allowConnection = !(targetHosts.has(host) || targetHosts.has('www.' + host));
        }

        if (allowConnection) {
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
            clientSocket.end();
        }
    });

    proxyServer.listen(8080, '127.0.0.1', () => {
        console.log('✓ SuperFokus proxy server listening on localhost:8080');
        if (process.platform === 'win32') {
            exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f && reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d 127.0.0.1:8080 /f', (err) => {
                if (!err) refreshWindowsProxy();
            });
        }
    });
}

function stopProxy() {
    if (proxyServer) {
        proxyServer.close();
        proxyServer = null;
        if (process.platform === 'win32') {
            exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f', (err) => {
                if (!err) refreshWindowsProxy();
            });
        }
    }
}

function setMacProxy(enable, callback) {
    if (process.platform !== 'darwin') {
        if (callback) callback();
        return;
    }
    const services = ['Wi-Fi', 'Ethernet', 'Thunderbolt Bridge'];
    let script = '';

    services.forEach(service => {
        if (enable) {
            script += `networksetup -setwebproxy "${service}" 127.0.0.1 8080; networksetup -setwebproxystate "${service}" on; networksetup -setsecurewebproxy "${service}" 127.0.0.1 8080; networksetup -setsecurewebproxystate "${service}" on; `;
        } else {
            script += `networksetup -setwebproxystate "${service}" off; networksetup -setsecurewebproxystate "${service}" off; `;
        }
    });
    
    // Flush DNS cache to ensure immediate effect on macOS
    script += 'dscacheutil -flushcache; killall -HUP mDNSResponder;';
    
    sudo.exec(script, { name: 'SuperFokus' }, (error) => {
        if (error) console.error('[Mac Proxy Error]', error);
        else console.log('[Mac Proxy] Proxy settings applied and DNS flushed.');
        if (callback) callback(error);
    });
}

function init() {
    ipcMain.on('update-blocker-rules', (event, rules) => {
        if (!windowManager.isOriginSafe(event)) return;
        blockerRules = rules;
        const allHosts = new Set();
        const allUrls = new Set();

        if (Array.isArray(rules.domains)) {
            rules.domains.forEach(domain => {
                if (domain) allHosts.add(domain);
            });
        }

        if (Array.isArray(rules.urls)) {
            rules.urls.forEach(url => allUrls.add(url.trim()));
        }

        // Electron internal Request interception to flawlessly block URLs within internal app windows
        const { session } = require('electron');
        if (session && session.defaultSession) {
            try {
                // Safely clear any existing URL interceptor
                session.defaultSession.webRequest.onBeforeRequest(null);
            } catch (e) {
                console.error('[WebRequest Reset Error]', e);
            }
        }

        if (rules.mode === 'allow' && rules.active && (allHosts.size > 0 || allUrls.size > 0)) {
            startProxy(allHosts, allUrls, 'allow');
            setMacProxy(true, () => {
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                    windowManager.mainWindow.webContents.send('blocker-status', '✓ Allow-only mode ACTIVE.');
                }
            });
        } else if (rules.mode === 'block' && rules.active && (allHosts.size > 0 || allUrls.size > 0)) {
            if (allUrls.size > 0 && session && session.defaultSession) {
                const urlFilters = Array.from(allUrls).map(u => {
                    let cleaned = u.trim();
                    if (!cleaned.endsWith('*')) cleaned += '*'; // Ensures paths are correctly intercepted
                    return cleaned;
                });
                try {
                    session.defaultSession.webRequest.onBeforeRequest({ urls: urlFilters }, (details, callback) => {
                        callback({ cancel: true });
                    });
                } catch (e) {
                    console.error('[WebRequest Apply Error]', e);
                }
            }

            // Always write file and runElevated to trigger expected admin prompt and sync state
            const domains = Array.from(allHosts);
            const tempPath = path.join(app.getPath('userData'), 'fokus_domains.json');
            fs.promises.writeFile(tempPath, JSON.stringify(domains))
                .then(() => {
                    runElevated('apply-file', [tempPath], (error) => {
                        if (error) {
                            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-error', error.message);
                            return; // Halt if admin prompt canceled
                        } 
                        
                        blocksApplied = domains.length > 0;
                        
                        if (allUrls.size > 0) {
                            startProxy(allHosts, allUrls, 'block');
                            setMacProxy(true, () => {
                                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'Domains & URLs blocked successfully');
                            });
                        } else {
                            stopProxy();
                            setMacProxy(false, () => {
                                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'Domains blocked successfully');
                            });
                        }
                    });
                })
                .catch(e => {
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-error', 'Failed to prepare domain list.');
                });
        } else {
            stopProxy();
            setMacProxy(false, () => {
                if (blocksApplied) {
                    runElevated('clear', [], (error) => {
                        if (!error) blocksApplied = false;
                        if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'Blocks cleared');
                    });
                } else {
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'Blocks cleared');
                }
            });
        }
    });

    ipcMain.on('clear-all-blocks', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        stopProxy();
        setMacProxy(false, () => {
            runElevated('clear', [], (error) => {
                if (error) {
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-error', 'Failed to clear all blocks.');
                } else {
                    blocksApplied = false;
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) windowManager.mainWindow.webContents.send('blocker-status', 'All blocks cleared');
                }
            });
        });
    });

    ipcMain.on('blocker-start', (event, data) => {
        if (!windowManager.isOriginSafe(event)) return;
        macBlockActive = false;
        let msg = typeof data === 'string' ? data : (data?.message || '');
        windowManager.createPopupWindow(msg, 10000, null, true);
    });

    ipcMain.on('blocker-stop', (event) => {
        if (!windowManager.isOriginSafe(event)) return;
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
exports = {
    init,
    cleanup,
    runElevated,
    getBlocksApplied: () => blocksApplied
};
