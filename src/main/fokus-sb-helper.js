const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { execFile, exec } = require('child_process');
const { normalizeHost, DOMAIN_REGEX, IP_REGEX } = require('../utils/url-utils.js');

// Determine hosts file path based on platform
function getHostsFilePath() {
  if (process.platform === 'darwin') return '/etc/hosts';
  if (process.platform === 'win32') {
    // Standard path is %SystemRoot%\System32\drivers\etc\hosts
    // On 64-bit Windows, 32-bit processes are redirected to SysWOW64.
    // Using Sysnative helps bypass this redirection if it exists.
    const sysRoot = process.env.SystemRoot || 'C:\\Windows';
    const sysNative = path.join(sysRoot, 'Sysnative\\drivers\\etc\\hosts');
    const system32 = path.join(sysRoot, 'System32\\drivers\\etc\\hosts');
    
    if (fsSync.existsSync(sysNative)) return sysNative;
    return system32;
  }
  return '/etc/hosts';
}

const HOSTS_FILE = getHostsFilePath();
const START_MARKER = '# --- SuperFokus Block Start ---';
const END_MARKER = '# --- SuperFokus Block End ---';

function validateDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const d = domain.trim().toLowerCase();
    if (!d || d.length > 253) return false;
    return DOMAIN_REGEX.test(d) || IP_REGEX.test(d);
}

function flushDnsCache() {
    return new Promise((resolve) => {
        const platform = process.platform;

        if (platform === 'darwin') {
            execFile('dscacheutil', ['-flushcache'], (err) => {
                if (err) console.warn('dscacheutil flush failed:', err.message);
                execFile('killall', ['-HUP', 'mDNSResponder'], (err2) => {
                    if (err2) console.warn('mDNSResponder killall failed:', err2.message);
                    resolve();
                });
            });
        } else if (platform === 'win32') {
            execFile('ipconfig', ['/flushdns'], (err) => {
                if (err) console.warn('ipconfig flushdns failed:', err.message);
                resolve();
            });
        } else {
            // For Linux, try common options
            exec('systemd-resolve --flush-caches || resolvectl flush-caches || service nscd restart || true', (err) => {
                if (err) console.warn('Linux DNS flush failed:', err.message);
                resolve();
            });
        }
    });
}

async function clearBlocksAsync(retries = 3) {
    try {
        if (!fsSync.existsSync(HOSTS_FILE)) {
            throw new Error('Hosts file not found at ' + HOSTS_FILE);
        }

        let attempts = 0;
        while (attempts < retries) {
            try {
                const content = await fs.readFile(HOSTS_FILE, 'utf-8');
                const startIndex = content.indexOf(START_MARKER);
                const endIndex = content.indexOf(END_MARKER);

                if (startIndex !== -1 && endIndex !== -1) {
                    const before = content.substring(0, startIndex);
                    const after = content.substring(endIndex + END_MARKER.length);
                    let newContent = before + after;
                    await fs.writeFile(HOSTS_FILE, newContent, 'utf-8');
                    console.log('Successfully cleared blocks.');
                    await flushDnsCache();
                    return { success: true };
                } else {
                    console.log('No SuperFokus blocks found.');
                    await flushDnsCache();
                    return { success: true };
                }
            } catch (e) {
                attempts++;
                if (attempts >= retries) throw e;
                await new Promise(r => setTimeout(r, 100 * attempts));
            }
        }
    } catch (e) {
        console.error('Error clearing blocks:', e.message);
        throw new Error(`Failed to clear hosts blocks: ${e.message}`);
    }
}

async function applyBlocksAsync(domains, retries = 3) {
    try {
        const domainSet = new Set();

        function addHost(host) {
            if (!host) return;
            host = host.toLowerCase();
            domainSet.add(host);
            if (host.startsWith('www.')) {
                const root = host.replace(/^www\./, '');
                if (root) domainSet.add(root);
            } else {
                domainSet.add(`www.${host}`);
            }
        }

        for (const raw of domains) {
            if (!raw || typeof raw !== 'string') continue;
            if (!validateDomain(raw)) {
                throw new Error(`Invalid domain format after normalization: "${raw}".`);
            }
            addHost(raw);
        }

        const validatedDomains = Array.from(domainSet).filter(host => validateDomain(host));
        
        let attempts = 0;
        while (attempts < retries) {
            try {
                let content = await fs.readFile(HOSTS_FILE, 'utf-8');
                
                // Clear existing blocks first in memory
                const startIndex = content.indexOf(START_MARKER);
                const endIndex = content.indexOf(END_MARKER);
                if (startIndex !== -1 && endIndex !== -1) {
                    content = content.substring(0, startIndex) + content.substring(endIndex + END_MARKER.length);
                }
                content = content.trimEnd();

                // Append new blocks if any
                if (validatedDomains.length > 0) {
                    const lines = [
                        '',
                        '',
                        START_MARKER,
                        ...validatedDomains.flatMap(d => [`0.0.0.0 ${d}`, `::1 ${d}`]),
                        END_MARKER
                    ];
                    content += lines.join('\n');
                }

                await fs.writeFile(HOSTS_FILE, content, 'utf-8');
                console.log(`Successfully updated hosts file with ${validatedDomains.length} domain(s).`);
                await flushDnsCache();
                return { success: true, count: validatedDomains.length };
            } catch (e) {
                attempts++;
                if (attempts >= retries) throw e;
                await new Promise(r => setTimeout(r, 100 * attempts));
            }
        }
    } catch (e) {
        console.error('Error applying blocks:', e.message);
        throw new Error(`Failed to apply hosts blocks: ${e.message}`);
    }
}

(async () => {
    const action = process.argv[2];
    const base64Data = process.argv[3];
    let commandArgs = [];

    if (base64Data) {
        try {
            // Try to decode as JSON-encoded Base64 (new secure format)
            const decoded = Buffer.from(base64Data, 'base64').toString();
            commandArgs = JSON.parse(decoded);
            if (!Array.isArray(commandArgs)) commandArgs = [commandArgs];
        } catch (e) {
            // Fallback for legacy plain-text arguments
            commandArgs = [base64Data];
        }
    }

    try {
        if (action === 'clear') {
            await clearBlocksAsync();
            process.exit(0);
        } else if (action === 'apply') {
            const domains = commandArgs[0] ? commandArgs[0].split(',').filter(Boolean) : [];
            await applyBlocksAsync(domains);
            process.exit(0);
        } else if (action === 'apply-file') {
            const dataPath = commandArgs[0];
            if (!dataPath || !fsSync.existsSync(dataPath)) {
                throw new Error('Data file not found: ' + dataPath);
            }
            const domains = JSON.parse(fsSync.readFileSync(dataPath, 'utf-8'));
            await applyBlocksAsync(domains);
            process.exit(0);
        } else {
            throw new Error('Invalid action: ' + action);
        }
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
})();
