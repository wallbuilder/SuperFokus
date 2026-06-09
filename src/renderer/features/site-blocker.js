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
let hasUnsavedBlockerChanges = false;

function markBlockerUnsaved() {
    hasUnsavedBlockerChanges = true;
    window.hasUnsavedChanges = true; 
    window.dispatchEvent(new CustomEvent('blocker-unsaved-change'));
}

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
        if (elements.domainInput) elements.domainInput.value = (saved.rawDomains || []).join('\n');
        if (elements.urlInput) elements.urlInput.value = (saved.rawUrls || []).join('\n');
        
        updateUIVisibility();
    }

    elements.modeSelect.addEventListener('change', () => {
        updateUIVisibility();
        markBlockerUnsaved();
    });
    
    elements.saveBtn.addEventListener('click', saveAndApply);
    elements.clearBtn.addEventListener('click', clearAll);
    
    if (elements.enabledCheck) elements.enabledCheck.addEventListener('change', markBlockerUnsaved);
    if (elements.alwaysRunCheck) elements.alwaysRunCheck.addEventListener('change', markBlockerUnsaved);
    if (elements.domainInput) elements.domainInput.addEventListener('input', markBlockerUnsaved);
    if (elements.urlInput) elements.urlInput.addEventListener('input', markBlockerUnsaved);

    // Global interception for exiting with unsaved changes
    document.addEventListener('click', (e) => {
        if (!hasUnsavedBlockerChanges) return;
        
        const isExitButton = e.target.closest('.close-btn') || 
                             e.target.closest('.sidebar-item') || 
                             e.target.closest('.back-btn') || 
                             e.target.closest('[onclick*="close"]') ||
                             e.target.closest('[data-dismiss]');
        
        const isInsideBlocker = e.target.closest('#site-blocker-container') || 
                                e.target.closest('.site-blocker-content');

        if (isExitButton && !isInsideBlocker) {
            if (typeof window.showUnsavedModal === 'function') {
                e.preventDefault();
                e.stopPropagation();
                window.showUnsavedModal(() => {
                    hasUnsavedBlockerChanges = false;
                    window.hasUnsavedChanges = false;
                    e.target.click();
                });
            } else {
                if (!confirm('You have unsaved changes in the Site Blocker. Are you sure you want to leave without saving?')) {
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    hasUnsavedBlockerChanges = false;
                    window.hasUnsavedChanges = false;
                }
            }
        }
    }, true);

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

function safeNormalizeHost(urlStr) {
    if (!urlStr) return '';
    const cleaned = urlStr.trim();
    if (!cleaned) return '';

    let hostname = null;
    try {
        let url = cleaned;
        if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
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

async function saveAndApply() {
    const rawDomains = elements.domainInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    const rawUrls = elements.urlInput ? elements.urlInput.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
    
    blockerState.isBlockerActive = elements.enabledCheck.checked;
    blockerState.blockerMode = elements.modeSelect.value;
    blockerState.alwaysRun = elements.alwaysRunCheck ? elements.alwaysRunCheck.checked : false;

    const domainSet = new Set();
    rawDomains.forEach(d => {
        const host = safeNormalizeHost(d);
        if (host) {
            domainSet.add(host);
            if (!host.startsWith('www.')) domainSet.add('www.' + host);
            else domainSet.add(host.replace(/^www\./, ''));
        }
    });

    blockerState.domains = Array.from(domainSet).sort();
    
    blockerState.urls = [];
    rawUrls.forEach(u => {
        let val = u.trim();
        if (!val) return;
        if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
        blockerState.urls.push(val);
    });

    if (blockerState.isBlockerActive && blockerState.domains.length === 0 && blockerState.urls.length === 0) {
        alert('⚠️ No domains or URLs entered! Please add items to block before enabling.');
        elements.enabledCheck.checked = false;
        blockerState.isBlockerActive = false;
        return;
    }

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
    
    hasUnsavedBlockerChanges = false;
    window.hasUnsavedChanges = false;

    elements.saveBtn.innerText = 'Saved & Applied';
    elements.saveBtn.style.background = '#e74c3c';
    setTimeout(() => { 
        elements.saveBtn.innerText = 'Save & Apply Blocker'; 
        elements.saveBtn.style.background = '#3498db';
    }, 2000);
}

function clearAll() {
    if (confirm('Are you sure you want to clear all SuperFokus block entries from your system?')) {
        ipcRenderer.send('clear-all-blocks');
    }
}
