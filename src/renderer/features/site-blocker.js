import { ipcRenderer } from '../utils/ipc.js';

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

// --- Unsaved Changes Logic ---
let hasUnsavedBlockerChanges = false;

function markBlockerUnsaved() {
    hasUnsavedBlockerChanges = true;
    // Sync with global app state so the main UI knows to show the same unsaved popup as Themes
    window.hasUnsavedChanges = true; 
    
    // Dispatch a custom event in case the UI is listening for state changes
    window.dispatchEvent(new CustomEvent('blocker-unsaved-change'));
}

if (siteBlockerMode) siteBlockerMode.addEventListener('change', markBlockerUnsaved);
if (domainListInput) domainListInput.addEventListener('input', markBlockerUnsaved);
if (urlListInput) urlListInput.addEventListener('input', markBlockerUnsaved);
if (siteBlockerEnabled) siteBlockerEnabled.addEventListener('change', markBlockerUnsaved);
if (siteBlockerAlwaysRun) siteBlockerAlwaysRun.addEventListener('change', markBlockerUnsaved);

// Intercept window close (app exit) to warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedBlockerChanges) {
        e.preventDefault();
        e.returnValue = ''; // Triggers the default OS/browser warning dialog
    }
});

// Global interception for exiting the site blocker via UI buttons
document.addEventListener('click', (e) => {
    if (!hasUnsavedBlockerChanges) return;
    
    // Detect if the user is clicking a navigation or close button
    const isExitButton = e.target.closest('.close-btn') || 
                         e.target.closest('.sidebar-item') || 
                         e.target.closest('.back-btn') || 
                         e.target.closest('[onclick*="close"]') ||
                         e.target.closest('[data-dismiss]');
    
    // Ignore clicks inside the actual site blocker container
    const isInsideBlocker = e.target.closest('#site-blocker-container') || 
                            e.target.closest('.site-blocker-content');

    if (isExitButton && !isInsideBlocker) {
        // If the app uses a global modal function for themes, attempt to use it
        if (typeof window.showUnsavedModal === 'function') {
            e.preventDefault();
            e.stopPropagation();
            window.showUnsavedModal(() => {
                hasUnsavedBlockerChanges = false;
                window.hasUnsavedChanges = false;
                e.target.click(); // Re-trigger the click to proceed
            });
        } else {
            // Native confirm fallback
            if (!confirm('You have unsaved changes in the Site Blocker. Are you sure you want to leave without saving?')) {
                e.preventDefault();
                e.stopPropagation();
            } else {
                hasUnsavedBlockerChanges = false;
                window.hasUnsavedChanges = false;
            }
        }
    }
}, true); // Capture phase to intercept before navigation processes

// Helper function to safely normalize URLs
function safeNormalizeHost(urlStr) {
    if (!urlStr) return '';
    const cleaned = urlStr.trim();
    if (!cleaned) return '';

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

    if (!hostname) return cleaned;
    hostname = hostname.split(':')[0];
    if (hostname === 'localhost') return '';
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);

    return hostname || cleaned;
}

// Show/hide mode messages based on selection
if (siteBlockerMode) {
    siteBlockerMode.addEventListener('change', () => {
        const proxyMsg = document.getElementById('proxy-message');
        const blockMsg = document.getElementById('block-message');
        if (siteBlockerMode.value === 'allow') {
            if (proxyMsg) proxyMsg.style.display = 'block';
            if (blockMsg) blockMsg.style.display = 'none';
        } else {
            if (proxyMsg) proxyMsg.style.display = 'none';
            if (blockMsg) blockMsg.style.display = 'block';
        }
    });
}

function updateBlocker() {
    if (!siteBlockerMode || !domainListInput || !siteBlockerEnabled) return;

    blockerState.blockerMode = siteBlockerMode.value;
    const rawDomains = domainListInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const rawUrls = urlListInput ? urlListInput.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
    blockerState.isBlockerActive = siteBlockerEnabled.checked;
    blockerState.alwaysRun = siteBlockerAlwaysRun ? siteBlockerAlwaysRun.checked : false;
    
    blockerState.urls = [];
    rawUrls.forEach(u => {
        let val = u.trim();
        if (!val) return;
        if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
        blockerState.urls.push(val);
    });

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
        const host = safeNormalizeHost(d);
        if (host) addBlockingHost(host);
    });

    blockerState.domains = Array.from(domainSet).sort();
    
    // Validation
    if (blockerState.isBlockerActive && blockerState.domains.length === 0 && blockerState.urls.length === 0) {
        alert('⚠️ No domains or URLs entered! Please add items to block before enabling.');
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


if (saveBlockerBtn) {
    saveBlockerBtn.addEventListener('click', () => {
        updateBlocker();
        hasUnsavedBlockerChanges = false;
        window.hasUnsavedChanges = false;
        saveBlockerBtn.innerText = 'Saved and Applied';
        saveBlockerBtn.style.background = '#e74c3c';
        setTimeout(() => {
            saveBlockerBtn.innerText = 'Save & Apply Blocker';
            saveBlockerBtn.style.background = '#3498db';
        }, 2000);
    });
}

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

// Removed auto-sync on switch toggle. 
// Changes are explicitly applied only when the Save button is clicked.

// --- IPC Listeners for Blocker Status ---
ipcRenderer.on('blocker-status', (msg) => {
    console.log('[Blocker Status]', msg);
    const statusEl = document.getElementById('blocker-status-display');
    if (statusEl) {
        statusEl.innerText = msg;
        statusEl.style.color = '#2ecc71';
    }
});

ipcRenderer.on('blocker-error', (err) => {
    console.error('[Blocker Error]', err);
    const statusEl = document.getElementById('blocker-status-display');
    if (statusEl) {
        statusEl.innerText = `⚠️ Error: ${err}`;
        statusEl.style.color = '#e74c3c';
    }
});

ipcRenderer.on('startup-cleanup-failed', (err) => {
    console.warn('[Startup Cleanup] Failed to clear zombie blocks:', err);
    const statusEl = document.getElementById('blocker-status-display');
    if (statusEl) {
        statusEl.innerText = `⚠️ Startup Warning: Old blocks could not be cleared. ${err}`;
        statusEl.style.color = '#f39c12';
    }
});