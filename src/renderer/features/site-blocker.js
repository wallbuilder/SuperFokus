import { ipcRenderer } from '../utils/ipc.js';
import { store } from '../utils/storage.js';

export const blockerState = {
    isBlockerActive: false,
    blockerMode: 'block',
    alwaysRun: false,
    domains: [],
    urls: []
};

let elements = {};

export async function initSiteBlocker() {
    elements = {
        saveBtn: document.getElementById('save-blocker-btn'),
        clearBtn: document.getElementById('clear-blocker-btn'),
        modeSelect: document.getElementById('site-blocker-mode'),
        domainInput: document.getElementById('domain-list'),
        urlInput: document.getElementById('url-list'),
        enabledCheck: document.getElementById('site-blocker-enabled'),
        alwaysRunCheck: document.getElementById('site-blocker-always-run'),
        statusDisplay: document.getElementById('blocker-status-display'),
        proxyMsg: document.getElementById('proxy-message'),
        blockMsg: document.getElementById('block-message')
    };

    if (!elements.saveBtn) return;

    // Load saved state
    const saved = await store.get('blocker-rules');
    if (saved) {
        blockerState.isBlockerActive = saved.active || false;
        blockerState.blockerMode = saved.mode || 'block';
        blockerState.alwaysRun = saved.alwaysRun || false;
        blockerState.domains = saved.domains || [];
        blockerState.urls = saved.urls || [];

        if (elements.enabledCheck) elements.enabledCheck.checked = blockerState.isBlockerActive;
        if (elements.modeSelect) elements.modeSelect.value = blockerState.blockerMode;
        if (elements.alwaysRunCheck) elements.alwaysRunCheck.checked = blockerState.alwaysRun;
        if (elements.domainInput) elements.domainInput.value = (saved.rawDomains || []).join('\\n');
        if (elements.urlInput) elements.urlInput.value = (saved.rawUrls || []).join('\\n');
        
        updateUIVisibility();
    }

    elements.modeSelect.addEventListener('change', updateUIVisibility);
    elements.saveBtn.addEventListener('click', saveAndApply);
    elements.clearBtn.addEventListener('click', clearAll);
    if (elements.enabledCheck) elements.enabledCheck.addEventListener('change', saveAndApply);
    if (elements.alwaysRunCheck) elements.alwaysRunCheck.addEventListener('change', saveAndApply);

    ipcRenderer.on('blocker-status', (msg) => updateStatus(msg, '#2ecc71'));
    ipcRenderer.on('blocker-error', (err) => updateStatus(err, '#e74c3c'));
}

function updateUIVisibility() {
    if (!elements.modeSelect) return;
    const isAllow = elements.modeSelect.value === 'allow';
    if (elements.proxyMsg) elements.proxyMsg.style.display = isAllow ? 'block' : 'none';
    if (elements.blockMsg) elements.blockMsg.style.display = isAllow ? 'none' : 'block';
}

function updateStatus(msg, color) {
    if (elements.statusDisplay) {
        elements.statusDisplay.innerText = msg;
        elements.statusDisplay.style.color = color;
    }
}

async function saveAndApply() {
    const rawDomains = elements.domainInput.value.split('\\n').map(s => s.trim()).filter(Boolean);
    const rawUrls = elements.urlInput ? elements.urlInput.value.split('\\n').map(s => s.trim()).filter(Boolean) : [];
    
    blockerState.isBlockerActive = elements.enabledCheck.checked;
    blockerState.blockerMode = elements.modeSelect.value;
    blockerState.alwaysRun = elements.alwaysRunCheck ? elements.alwaysRunCheck.checked : false;

    if (blockerState.isBlockerActive && rawDomains.length === 0) {
        alert('Please enter at least one domain.');
        elements.enabledCheck.checked = false;
        return;
    }

    const domainSet = new Set();
    rawDomains.forEach(d => {
        const host = ipcRenderer.normalizeHost(d) || d.toLowerCase();
        domainSet.add(host);
        if (!host.startsWith('www.')) domainSet.add('www.' + host);
        else domainSet.add(host.replace(/^www\\./, ''));
    });

    blockerState.domains = Array.from(domainSet).sort();
    blockerState.urls = rawUrls;

    const rules = {
        active: blockerState.isBlockerActive,
        mode: blockerState.blockerMode,
        alwaysRun: blockerState.alwaysRun,
        domains: blockerState.domains,
        urls: blockerState.urls,
        rawDomains,
        rawUrls
    };

    ipcRenderer.send('update-blocker-rules', rules);
    
    elements.saveBtn.innerText = 'Saved & Applied';
    setTimeout(() => { elements.saveBtn.innerText = 'Save & Apply Blocker'; }, 2000);
}

function clearAll() {
    if (confirm('Clear all SuperFokus block entries?')) {
        ipcRenderer.send('clear-all-blocks');
    }
}
