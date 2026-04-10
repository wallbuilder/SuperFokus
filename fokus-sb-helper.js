const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Determine hosts file path based on platform
const HOSTS_FILE = process.platform === 'darwin'
  ? '/etc/hosts'
  : process.platform === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts'; // Default to Unix/Linux path

const START_MARKER = '# --- SuperFokus Block Start ---';
const END_MARKER = '# --- SuperFokus Block End ---';

// Domain validation regex: basic domain and IP validation
const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function normalizeHost(value) {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.trim();
    if (!cleaned) return null;

    let hostname = null;
    try {
        let url = cleaned;
        if (!/^https?:\/\//i.test(url)) {
            url = `http://${url}`;
        }
        hostname = new URL(url).hostname.toLowerCase();
    } catch (e) {
        hostname = cleaned.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0].toLowerCase();
    }

    if (!hostname) return null;
    hostname = hostname.split(':')[0];

    if (hostname === 'localhost') return null;
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);

    if (!DOMAIN_REGEX.test(hostname) && !IP_REGEX.test(hostname)) {
        return null;
    }

    return hostname;
}

function validateDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const d = domain.trim().toLowerCase();
    if (!d || d.length > 253) return false;
    return DOMAIN_REGEX.test(d) || IP_REGEX.test(d);
}

function flushDnsCache() {
    return new Promise((resolve) => {
        const platform = process.platform;
        let cmd;

        if (platform === 'darwin') {
            // macOS DNS cache refresh
            cmd = 'dscacheutil -flushcache; killall -HUP mDNSResponder';
        } else if (platform === 'win32') {
            cmd = 'ipconfig /flushdns';
        } else {
            // Linux best-effort
            cmd = 'systemd-resolve --flush-caches || resolvectl flush-caches || service nscd restart || true';
        }

        exec(cmd, (err) => {
            if (err) {
                console.warn('DNS flush failed:', err.message);
            } else {
                console.log('DNS cache flushed successfully:', cmd);
            }
            resolve();
        });
    });
}

async function clearBlocksAsync(retries = 3) {
    try {
        // Check if file exists
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

                    // Clean up leftover empty lines if necessary
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
                // Wait before retry (exponential backoff)
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
        // Normalize and validate domains first
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
            const host = normalizeHost(raw);
            if (!host) {
                throw new Error(`Invalid domain format: "${raw}". Domains must be valid hostnames or URLs.`);
            }
            addHost(host);
        }

        const validatedDomains = Array.from(domainSet).filter(host => validateDomain(host));

        // Clear existing blocks first to avoid duplicates
        await clearBlocksAsync(retries);

        if (validatedDomains.length === 0) {
            console.log('No valid domains to apply.');
            return { success: true };
        }

        let attempts = 0;
        while (attempts < retries) {
            try {
                const lines = [
                    '',
                    START_MARKER,
                    ...validatedDomains.flatMap(d => [`0.0.0.0 ${d}`, `::1 ${d}`]),
                    END_MARKER,
                    ''
                ];

                await fs.appendFile(HOSTS_FILE, lines.join('\n'), 'utf-8');
                console.log(`Successfully applied blocks for ${validatedDomains.length} domain(s).`);
                await flushDnsCache();
                return { success: true, count: validatedDomains.length };
            } catch (e) {
                attempts++;
                if (attempts >= retries) throw e;
                // Wait before retry (exponential backoff)
                await new Promise(r => setTimeout(r, 100 * attempts));
            }
        }
    } catch (e) {
        console.error('Error applying blocks:', e.message);
        throw new Error(`Failed to apply hosts blocks: ${e.message}`);
    }
}

// Main async execution
(async () => {
    const action = process.argv[2];
    const domainsArg = process.argv[3]; // comma separated

    try {
        if (action === 'clear') {
            await clearBlocksAsync();
            process.exit(0);
        } else if (action === 'apply') {
            const domains = domainsArg ? domainsArg.split(',').filter(Boolean) : [];
            await applyBlocksAsync(domains);
            process.exit(0);
        } else {
            throw new Error('Invalid action: ' + action);
        }
    } catch (e) {
        console.error(e.message);
        console.error(JSON.stringify({ error: e.message }));
        process.exit(1);
    }
})();
