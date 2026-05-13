import { ipcRenderer, normalizeHost } from '../utils/ipc.js';

// --- Blocker State ---
export const blockerState = {
    isBlockerActive: false,
    blockerMode: 'block',
    alwaysRun: false,
    domains: [],
    urls: []
};

// --- Site Blocker ---
const saveBlockerBtn = document.getElementById('save-blocker-btn');
const clearBlockerBtn = document.getElementById('clear-blocker-btn');
const clearBlockerModalBtn = document.getElementById('clear-blocker-modal-btn');
const siteBlockerMode = document.getElementById('site-blocker-mode');
const domainListInput = document.getElementById('domain-list');
const urlListInput = document.getElementById('url-list');
const siteBlockerEnabled = document.getElementById('site-blocker-enabled');
const siteBlockerAlwaysRun = document.getElementById('site-blocker-always-run');

// Removed work in progress block

// Show/hide mode messages based on selection
siteBlockerMode.addEventListener('change', () => {
    const proxyMsg = document.getElementById('proxy-message');
    const blockMsg = document.getElementById('block-message');
    if (siteBlockerMode.value === 'allow') {
        proxyMsg.style.display = 'block';
        blockMsg.style.display = 'none';
    } else {
        proxyMsg.style.display = 'none';
        blockMsg.style.display = 'block';
    }
    // Trigger change on load too
    window.addEventListener('load', () => {
        const currentMode = siteBlockerMode.value;
        if (currentMode === 'allow') {
            proxyMsg.style.display = 'block';
            blockMsg.style.display = 'none';
        } else {
            proxyMsg.style.display = 'none';
            blockMsg.style.display = 'block';
        }
    });
});

function updateBlocker() {
    blockerState.blockerMode = siteBlockerMode.value;
    const rawDomains = domainListInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const rawUrls = urlListInput ? urlListInput.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
    blockerState.isBlockerActive = siteBlockerEnabled.checked;
    blockerState.alwaysRun = siteBlockerAlwaysRun.checked;
    blockerState.urls = rawUrls;

    const domainSet = new Set();

    function addBlockingHost(host) {
        if (!host) return;
        host = host.toLowerCase();
        domainSet.add(host);
        if (!host.startsWith('www.')) {
            domainSet.add(`www.${host}`);
        } else {
            const root = host.replace(/^www\./, '');
            if (root) domainSet.add(root);
        }
    }

    rawDomains.forEach(d => {
        const host = normalizeHost(d);
        if (host) addBlockingHost(host);
    });

    rawUrls.forEach(u => {
        const host = normalizeHost(u);
        if (host) addBlockingHost(host);
    });

    blockerState.domains = Array.from(domainSet).sort();
    
    // Validation
    if (blockerState.isBlockerActive && blockerState.domains.length === 0) {
        alert('⚠️ No domains entered! Please add domains/URLs to block before enabling.');
        siteBlockerEnabled.checked = false;
        blockerState.isBlockerActive = false;
        return;
    }

    console.log('[Blocker]', {mode: blockerState.blockerMode, active: blockerState.isBlockerActive, domainCount: blockerState.domains.length, domains: blockerState.domains});
    ipcRenderer.send('update-blocker-rules', { 
        mode: blockerState.blockerMode, 
        domains: blockerState.domains, 
        urls: blockerState.urls, 
        active: blockerState.isBlockerActive, 
        alwaysRun: blockerState.alwaysRun 
    });
}


saveBlockerBtn.addEventListener('click', () => {
    updateBlocker();
    saveBlockerBtn.innerText = 'Saved!';
    saveBlockerBtn.style.background = '#2ecc71';
    setTimeout(() => {
        saveBlockerBtn.innerText = 'Save & Apply Blocker';
        saveBlockerBtn.style.background = '#3498db';
    }, 2000);
});

function handleClearBlocks(btn) {
    if (confirm('Are you sure you want to clear all SuperFokus block entries from your system hosts file?')) {
        ipcRenderer.send('clear-all-blocks');
        const oldText = btn.innerText;
        const oldBg = btn.style.background;
        btn.innerText = 'Cleared!';
        btn.style.background = '#2ecc71';
        setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = oldBg;
        }, 2000);
    }
}

if (clearBlockerBtn) {
    clearBlockerBtn.addEventListener('click', () => handleClearBlocks(clearBlockerBtn));
}

if (clearBlockerModalBtn) {
    clearBlockerModalBtn.addEventListener('click', () => handleClearBlocks(clearBlockerModalBtn));
}

// Sync blocker state to main if it should always run
siteBlockerEnabled.addEventListener('change', updateBlocker);
siteBlockerAlwaysRun.addEventListener('change', updateBlocker);