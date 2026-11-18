const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const sudo = require('@vscode/sudo-prompt');
const { exec } = require('child_process');
const windowManager = require('./WindowManager');
const { normalizeHost } = require('../../utils/url-utils');

const START_MARKER = '# --- SuperFokus Block Start ---';
const END_MARKER = '# --- SuperFokus Block End ---';

let blockerRules = {
    mode: 'block',
    domains: [],
    urls: [],
    active: false,
    alwaysRun: false
};

let store = null;
let storeInitPromise = null;
let proxyServer = null;
let elevationQueue = Promise.resolve();
let handlersRegistered = false;

const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'main', 'fokus-sb-helper.js')
    : path.join(__dirname, '../fokus-sb-helper.js');
let blocksApplied = false;

function getHostsFilePath() {
    if (process.platform === 'darwin') return '/etc/hosts';
    if (process.platform === 'win32') {
        const sysRoot = process.env.SystemRoot || 'C:\\Windows';
        const sysNative = path.join(sysRoot, 'Sysnative\\drivers\\etc\\hosts');
        const system32 = path.join(sysRoot, 'System32\\drivers\\etc\\hosts');
        if (fs.existsSync(sysNative)) return sysNative;
        return system32;
    }
    return '/etc/hosts';
}

function hasActiveHostsBlocks() {
    try {
        const hostsPath = getHostsFilePath();
        if (!fs.existsSync(hostsPath)) return false;
        const content = fs.readFileSync(hostsPath, 'utf-8');
        return content.includes(START_MARKER) || content.includes(END_MARKER);
    } catch (e) {
        return false;
    }
}

async function ensureStore() {
    if (store) return store;
    if (!storeInitPromise) {
        storeInitPromise = (async () => {
            try {
                await fs.promises.mkdir(app.getPath('userData'), { recursive: true });
                const { default: Store } = await import('electron-store');
                store = new Store();
                return store;
            } catch (e) {
                console.error('[BlockerService] Store init failed', e);
                return null;
            }
        })();
    }
    return storeInitPromise;
}

function runElevated(command, commandArgs, callback) {
    const allowedCommands = ['clear', 'apply-file', 'set-mac-proxy'];
    if (!allowedCommands.includes(command)) {
        if (callback) callback(new Error('Unauthorized command'));
        return;
    }

    elevationQueue = elevationQueue.then(() => new Promise((resolve) => {
        const finish = (err, stdout, stderr) => {
            try {
                if (callback) callback(err, stdout, stderr);
            } finally {
                resolve();
            }
        };

        const isTestMode = process.argv.includes('--no-single-instance');
        if (isTestMode) {
            console.log(`[BlockerService] Mocking runElevated in test mode for command: ${command}`);
            setTimeout(() => finish(null, 'Mock Success', ''), 50);
            return;
        }

        const base64Args = Buffer.from(JSON.stringify(commandArgs)).toString('base64');
        const nodePath = process.execPath;
        let fullCommand;
        const options = { name: 'SuperFokus' };
        if (process.platform === 'win32') {
            fullCommand = `"${nodePath}" "${helperPath}" ${command} ${base64Args}`;
            options.env = {
                'ELECTRON_RUN_AS_NODE': '1',
                'NODE_OPTIONS': ''
            };
        } else {
            fullCommand = `ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS="" "${nodePath}" "${helperPath}" ${command} ${base64Args}`;
        }
        sudo.exec(fullCommand, options, (error, stdout, stderr) => {
            finish(error, stdout, stderr);
        });
    })).catch((err) => {
        console.error('[BlockerService] Elevation queue error:', err);
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

function closeExistingProxy() {
    return new Promise((resolve) => {
        if (!proxyServer) return resolve();
        const oldServer = proxyServer;
        proxyServer = null;
        try {
            oldServer.close(() => resolve());
        } catch (e) {
            resolve();
        }
    });
}

function startProxy(targetHosts, targetUrls, mode = 'allow') {
    closeExistingProxy().then(() => {
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
        const server = http.createServer((req, res) => {
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
        server.on('error', (err) => {
            console.error('[Proxy] Server error:', err.message);
        });
        server.on('connect', (req, clientSocket, head) => {
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
        proxyServer = server;
        server.listen(8080, '127.0.0.1', () => {
            if (process.platform === 'win32') {
                exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f', (err1) => {
                    if (err1) {
                        console.error('[Proxy] Failed to enable proxy:', err1);
                        return;
                    }
                    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d 127.0.0.1:8080 /f', (err2) => {
                        if (!err2) {
                            refreshWindowsProxy();
                        } else {
                            console.error('[Proxy] Failed to set proxy server:', err2);
                        }
                    });
                });
            }
        });
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
    runElevated('set-mac-proxy', [{ enable, services }], (error) => {
        if (error) {
            console.error('[BlockerService] Mac proxy elevation failed:', error.message);
        }
        if (callback) callback(error);
    });
}

function sanitizeRules(rules) {
    if (!rules || typeof rules !== 'object') {
        return {
            mode: 'block',
            domains: [],
            urls: [],
            rawDomains: [],
            rawUrls: [],
            active: false,
            alwaysRun: false
        };
    }

    const mode = rules.mode === 'allow' ? 'allow' : 'block';
    const active = Boolean(rules.active);
    const alwaysRun = Boolean(rules.alwaysRun);

    const domainSet = new Set();
    if (Array.isArray(rules.domains)) {
        for (const d of rules.domains.slice(0, 1000)) {
            if (typeof d !== 'string') continue;
            const host = normalizeHost(d);
            if (host) {
                domainSet.add(host);
                if (!host.startsWith('www.')) domainSet.add('www.' + host);
                else domainSet.add(host.replace(/^www\./, ''));
            }
        }
    }

    const urlList = [];
    if (Array.isArray(rules.urls)) {
        for (const u of rules.urls.slice(0, 1000)) {
            if (typeof u !== 'string') continue;
            let trimmed = u.trim();
            if (!trimmed || trimmed.length > 2048) continue;
            if (!/^https?:\/\//i.test(trimmed)) trimmed = 'https://' + trimmed;
            try {
                const parsed = new URL(trimmed);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    urlList.push(parsed.href);
                }
            } catch (e) {}
        }
    }

    const rawDomains = Array.isArray(rules.rawDomains)
        ? rules.rawDomains.filter(s => typeof s === 'string').slice(0, 1000)
        : [];
    const rawUrls = Array.isArray(rules.rawUrls)
        ? rules.rawUrls.filter(s => typeof s === 'string').slice(0, 1000)
        : [];

    return {
        mode,
        active,
        alwaysRun,
        domains: Array.from(domainSet).sort(),
        urls: urlList,
        rawDomains,
        rawUrls
    };
}

function toWebRequestPattern(urlStr) {
    try {
        const parsed = new URL(urlStr);
        const pathPart = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
        const pattern = `${parsed.protocol}//${parsed.hostname}${pathPart}`;
        return pattern.endsWith('*') ? pattern : pattern + '*';
    } catch (e) {
        return null;
    }
}

function registerIpcHandlers() {
    if (handlersRegistered) return;
    handlersRegistered = true;

    ipcMain.on('update-blocker-rules', async (event, rules) => {
        if (!windowManager.isOriginSafe(event)) return;
        const sanitized = sanitizeRules(rules);
        blockerRules = sanitized;
        const activeStore = store || await ensureStore();
        if (activeStore) activeStore.set('blocker-rules', sanitized);
        updateRules(sanitized);
    });

    ipcMain.on('clear-all-blocks', async (event) => {
        if (!windowManager.isOriginSafe(event)) return;
        stopProxy();
        blockerRules.active = false;
        const activeStore = store || await ensureStore();
        if (activeStore) activeStore.set('blocker-rules', blockerRules);
        setMacProxy(false, () => {
            runElevated('clear', [], (error) => {
                if (error) {
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                        windowManager.mainWindow.webContents.send('blocker-error', 'Failed to clear all blocks.');
                    }
                } else {
                    blocksApplied = false;
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                        windowManager.mainWindow.webContents.send('blocker-status', 'All blocks cleared');
                    }
                }
            });
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

async function init() {
    // Register IPC handlers synchronously so renderer messages are never missed on startup
    registerIpcHandlers();

    const activeStore = await ensureStore();
    if (activeStore) {
        const saved = activeStore.get('blocker-rules');
        if (saved && typeof saved === 'object') {
            blockerRules = sanitizeRules(saved);
        }
    }

    // Handle startup state & cleanup without unnecessary UAC prompts or race conditions
    if (blockerRules.active && blockerRules.alwaysRun && (blockerRules.domains.length > 0 || blockerRules.urls.length > 0)) {
        console.log('[BlockerService] Applying always-run rules on startup');
        updateRules(blockerRules);
    } else {
        // Ensure active state is reset to false on fresh start when alwaysRun is not enabled
        if (blockerRules.active) {
            blockerRules.active = false;
            if (activeStore) activeStore.set('blocker-rules', blockerRules);
        }
        // Only run elevated clear on startup if leftover SuperFokus markers actually exist in hosts file
        if (hasActiveHostsBlocks()) {
            console.log('[BlockerService] Startup cleanup: removing leftover hosts file blocks');
            runElevated('clear', [], (error) => {
                if (error) {
                    console.error('[BlockerService] Startup clear failed:', error.message);
                } else {
                    blocksApplied = false;
                }
            });
        } else {
            blocksApplied = false;
        }
    }
}

function updateRules(rules) {
    const allHosts = new Set();
    const allUrls = new Set();

    if (Array.isArray(rules.domains)) {
        rules.domains.forEach(domain => {
            if (domain && typeof domain === 'string') allHosts.add(domain.trim().toLowerCase());
        });
    }

    if (Array.isArray(rules.urls)) {
        rules.urls.forEach(url => {
            if (url && typeof url === 'string') allUrls.add(url.trim());
        });
    }

    // Electron internal Request interception
    const { session } = require('electron');
    if (session && session.defaultSession) {
        try {
            session.defaultSession.webRequest.onBeforeRequest(null);
        } catch (e) {
            console.error('[WebRequest Reset Error]', e);
        }
    }

    if (rules.mode === 'allow' && rules.active && (allHosts.size > 0 || allUrls.size > 0)) {
        const finishAllowMode = () => {
            startProxy(allHosts, allUrls, 'allow');
            setMacProxy(true, () => {
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                    windowManager.mainWindow.webContents.send('blocker-status', '✓ Allow-only mode ACTIVE.');
                }
            });
        };
        if (blocksApplied || hasActiveHostsBlocks()) {
            runElevated('clear', [], () => {
                blocksApplied = false;
                finishAllowMode();
            });
        } else {
            finishAllowMode();
        }
    } else if (rules.mode === 'block' && rules.active && (allHosts.size > 0 || allUrls.size > 0)) {
        if (allUrls.size > 0 && session && session.defaultSession) {
            const urlFilters = Array.from(allUrls)
                .map(toWebRequestPattern)
                .filter(Boolean);
            if (urlFilters.length > 0) {
                try {
                    session.defaultSession.webRequest.onBeforeRequest({ urls: urlFilters }, (details, callback) => {
                        callback({ cancel: true });
                    });
                } catch (e) {
                    console.error('[WebRequest Apply Error]', e);
                }
            }
        }

        const domains = Array.from(allHosts);
        if (domains.length === 0 && !blocksApplied && !hasActiveHostsBlocks()) {
            // Only URL blocking requested, no hosts file modification needed
            startProxy(allHosts, allUrls, 'block');
            setMacProxy(true, () => {
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                    windowManager.mainWindow.webContents.send('blocker-status', 'Domains & URLs blocked successfully');
                }
            });
            return;
        }

        const userDataDir = app.getPath('userData');
        const tempPath = path.join(userDataDir, 'fokus_domains.json');
        fs.promises.mkdir(userDataDir, { recursive: true })
            .then(() => fs.promises.writeFile(tempPath, JSON.stringify(domains), { encoding: 'utf-8', mode: 0o600 }))
            .then(() => {
                runElevated('apply-file', [tempPath], (error) => {
                    fs.promises.unlink(tempPath).catch(() => {});
                    if (error) {
                        if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                            windowManager.mainWindow.webContents.send('blocker-error', error.message);
                        }
                        return;
                    } 
                    
                    blocksApplied = domains.length > 0;
                    
                    if (allUrls.size > 0) {
                        startProxy(allHosts, allUrls, 'block');
                        setMacProxy(true, () => {
                            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                                windowManager.mainWindow.webContents.send('blocker-status', 'Domains & URLs blocked successfully');
                            }
                        });
                    } else {
                        stopProxy();
                        setMacProxy(false, () => {
                            if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                                windowManager.mainWindow.webContents.send('blocker-status', 'Domains blocked successfully');
                            }
                        });
                    }
                });
            })
            .catch(e => {
                console.error('[BlockerService] Failed to prepare domain list:', e);
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                    windowManager.mainWindow.webContents.send('blocker-error', 'Failed to prepare domain list.');
                }
            });
    } else {
        stopProxy();
        setMacProxy(false, () => {
            if (blocksApplied || hasActiveHostsBlocks()) {
                runElevated('clear', [], (error) => {
                    if (!error) blocksApplied = false;
                    if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                        windowManager.mainWindow.webContents.send('blocker-status', 'Blocks cleared');
                    }
                });
            } else {
                if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
                    windowManager.mainWindow.webContents.send('blocker-status', 'Blocks cleared');
                }
            }
        });
    }
}

function cleanup(callback) {
    if (blockerRules.active && blockerRules.alwaysRun) {
        if (callback) callback();
        return false;
    }
    if (blockerRules.active) {
        blockerRules.active = false;
        if (store) {
            try { store.set('blocker-rules', blockerRules); } catch (e) {}
        }
    }
    stopProxy();
    setMacProxy(false, () => {
        if (blocksApplied || hasActiveHostsBlocks()) {
            runElevated('clear', [], () => {
                blocksApplied = false;
                if (callback) callback();
            });
            return true;
        }
        if (callback) callback();
        return false;
    });
    return true;
}

module.exports = { init, cleanup, runElevated, stopProxy, setMacProxy, getBlocksApplied: () => blocksApplied };
