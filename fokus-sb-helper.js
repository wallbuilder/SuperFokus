const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const HOSTS_FILE = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const START_MARKER = '# --- SuperFokus Block Start ---';
const END_MARKER = '# --- SuperFokus Block End ---';

// Domain validation regex: basic domain and IP validation
const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function validateDomain(domain) {
    domain = domain.trim();
    if (!domain || domain.length === 0) return false;
    if (domain.length > 253) return false;
    return DOMAIN_REGEX.test(domain);
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
                    
                    // Clean up leftover empty lines if necessary\n                    let newContent = before + after;
                    await fs.writeFile(HOSTS_FILE, newContent, 'utf-8');
                    console.log('Successfully cleared blocks.');
                    return { success: true };
                } else {
                    console.log('No SuperFokus blocks found.');
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

async function applyBlocksAsync(domains, retries = 3) {\n    try {
        // Validate all domains first
        const validatedDomains = [];\n        for (const domain of domains) {
            const trimmed = domain.trim();
            if (!trimmed) continue;
            if (!validateDomain(trimmed)) {
                throw new Error(`Invalid domain format: "${trimmed}". Domains must be valid hostnames.`);
            }
            validatedDomains.push(trimmed);
        }
        
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
                    ...validatedDomains.map(d => `127.0.0.1 ${d}`),
                    END_MARKER,
                    ''
                ];
                
                await fs.appendFile(HOSTS_FILE, lines.join('\\n'), 'utf-8');
                console.log(`Successfully applied blocks for ${validatedDomains.length} domain(s).`);
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
            await clearBlocksAsync();\n            process.exit(0);
        } else if (action === 'apply') {
            const domains = domainsArg ? domainsArg.split(',').filter(Boolean) : [];
            await applyBlocksAsync(domains);
            process.exit(0);\n        } else {
            throw new Error('Invalid action: ' + action);
        }
    } catch (e) {
        console.error(e.message);
        console.error(JSON.stringify({ error: e.message }));
        process.exit(1);
    }
})();
