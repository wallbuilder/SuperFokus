const fs = require('fs');
const path = require('path');

const HOSTS_FILE = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const START_MARKER = '# --- SuperFokus Block Start ---';
const END_MARKER = '# --- SuperFokus Block End ---';

const action = process.argv[2];
const domainsArg = process.argv[3]; // comma separated

function clearBlocks() {
    try {
        if (!fs.existsSync(HOSTS_FILE)) return;
        const content = fs.readFileSync(HOSTS_FILE, 'utf-8');
        const startIndex = content.indexOf(START_MARKER);
        const endIndex = content.indexOf(END_MARKER);
        
        if (startIndex !== -1 && endIndex !== -1) {
            const before = content.substring(0, startIndex);
            const after = content.substring(endIndex + END_MARKER.length);
            
            // Clean up left over empty lines if necessary
            let newContent = before + after;
            fs.writeFileSync(HOSTS_FILE, newContent, 'utf-8');
            console.log('Successfully cleared blocks.');
        } else {
            console.log('No SuperFokus blocks found.');
        }
    } catch (e) {
        console.error('Error clearing blocks:', e);
        process.exit(1);
    }
}

function applyBlocks(domains) {
    try {
        clearBlocks(); // always clear first to avoid duplicates
        
        if (!domains || domains.length === 0) return;
        
        const lines = [
            '',
            START_MARKER,
            ...domains.map(d => `127.0.0.1 ${d}`),
            END_MARKER,
            ''
        ];
        
        fs.appendFileSync(HOSTS_FILE, lines.join('\n'), 'utf-8');
        console.log('Successfully applied blocks.');
    } catch (e) {
        console.error('Error applying blocks:', e);
        process.exit(1);
    }
}

if (action === 'clear') {
    clearBlocks();
} else if (action === 'apply') {
    const domains = domainsArg ? domainsArg.split(',').filter(Boolean) : [];
    applyBlocks(domains);
} else {
    console.error('Invalid action');
    process.exit(1);
}
