const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { execFile, exec } = require('child_process');

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^((([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}:[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){5}:([0-9A-Fa-f]{1,4}:)?)[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){4}:([0-9A-Fa-f]{1,4}:){0,2})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){3}:([0-9A-Fa-f]{1,4}:){0,3})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){2}:([0-9A-Fa-f]{1,4}:){0,4})[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:){1}:([0-9A-Fa-f]{1,4}:){0,5})[0-9A-Fa-f]{1,4}|(::([0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})|(::[0-9A-Fa-f]{1,4})|([0-9A-Fa-f]{1,4}::)|(::))(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/;

// Determine hosts file path based on platform
function getHostsFilePath() {
  if (process.platform === 'darwin') return '/etc/hosts';
  if (process.platform === 'win32') {
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
                execFile('killall', ['-HUP', 'mDNSResponder'], () => resolve());
            });
        } else if (platform === 'win32') {
            execFile('ipconfig', ['/flushdns'], () => resolve());
        } else {
            exec('systemd-resolve --flush-caches || resolvectl flush-caches || service nscd restart || true', () => resolve());
        }
    });
}

async function clearBlocksAsync(retries = 3) {
    let attempts = 0;
    while (attempts < retries) {
        try {
            if (!fsSync.existsSync(HOSTS_FILE)) throw new Error('Hosts file not found');
            let content = await fs.readFile(HOSTS_FILE, 'utf-8');
            const startIndex = content.indexOf(START_MARKER);
            const endIndex = content.indexOf(END_MARKER);
            if (startIndex !== -1 && endIndex !== -1) {
                content = content.substring(0, startIndex).trimEnd() + \"\n\" + content.substring(endIndex + END_MARKER.length).trimStart();
                await fs.writeFile(HOSTS_FILE, content.trim() + \"\n\", 'utf-8');
            }
            await flushDnsCache();
            return { success: true };
        } catch (e) {
            attempts++;
            if (attempts >= retries) throw e;
            await new Promise(r => setTimeout(r, 100 * attempts));
        }
    }
}

async function applyBlocksAsync(domains, retries = 3) {
    const domainSet = new Set();
    domains.forEach(raw => {
        if (!raw || typeof raw !== 'string') return;
        const host = raw.trim().toLowerCase();
        if (validateDomain(host)) {
            domainSet.add(host);
            if (host.startsWith('www.')) domainSet.add(host.replace(/^www\./, ''));
            else domainSet.add('www.' + host);
        }
    });
    const validatedDomains = Array.from(domainSet).filter(d => validateDomain(d));

    let attempts = 0;
    while (attempts < retries) {
        try {
            let content = await fs.readFile(HOSTS_FILE, 'utf-8');
            const startIndex = content.indexOf(START_MARKER);
            const endIndex = content.indexOf(END_MARKER);
            if (startIndex !== -1 && endIndex !== -1) {
                content = content.substring(0, startIndex).trimEnd() + \"\n\" + content.substring(endIndex + END_MARKER.length).trimStart();
            }
            content = content.trimEnd();
            if (validatedDomains.length > 0) {
                content += \"\n\n\" + START_MARKER + \"\n\";
                validatedDomains.forEach(d => {
                    content += \"0.0.0.0 \" + d + \"\n::1 \" + d + \"\n\";
                });
                content += END_MARKER + \"\n\";
            }
            await fs.writeFile(HOSTS_FILE, content.trim() + \"\n\", 'utf-8');
            await flushDnsCache();
            return { success: true, count: validatedDomains.length };
        } catch (e) {
            attempts++;
            if (attempts >= retries) throw e;
            await new Promise(r => setTimeout(r, 100 * attempts));
        }
    }
}

(async () => {
    const action = process.argv[2];
    const base64Data = process.argv[3];
    let commandArgs = [];
    if (base64Data) {
        try {
            const decoded = Buffer.from(base64Data, 'base64').toString();
            commandArgs = JSON.parse(decoded);
            if (!Array.isArray(commandArgs)) commandArgs = [commandArgs];
        } catch (e) { commandArgs = [base64Data]; }
    }
    try {
        if (action === 'clear') { await clearBlocksAsync(); }
        else if (action === 'apply') { await applyBlocksAsync(commandArgs[0]?.split(',').filter(Boolean) || []); }
        else if (action === 'apply-file') {
            const domains = JSON.parse(await fs.readFile(commandArgs[0], 'utf-8'));
            await applyBlocksAsync(domains);
        }
        process.exit(0);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
})();
