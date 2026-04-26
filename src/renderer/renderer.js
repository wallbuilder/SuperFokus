import { setupWorkflowEventListeners, setupWorkflowPresetsEventListeners, isWorkflowRunning } from './features/workflows.js';
import { ipcRenderer, normalizeHost } from './utils/ipc.js';
import { store, migrateStore } from './utils/storage.js';

// Migrate data before initializing modules
migrateStore();

import { customAlert, closeSidebar, toggleSidebar } from './ui/modals.js';
import { toggleTheme, applyTheme, applyHeaderToggleVisibility } from './ui/theme.js';
import { updateStatsUI, renderChart } from './utils/stats.js';
import { isPomoRunning, stopPomoStyle } from './features/pomo-timer.js';
import { isRepeatingRunning, stopRepeatingReminders, initializeRepeatingButtonListeners } from './features/repeating.js';
import { isSprintRunning, stopSprintMode } from './features/micro-sprint.js';
import { isFlowRunning, stopFlowState } from './features/flow-state.js';

// Import modules that attach event listeners on load
import './features/site-blocker.js';
import './features/health-mode.js';

// Startup Animation Logic
window.addEventListener('DOMContentLoaded', () => {
  try {
    const startupScreen = document.getElementById('startup-screen');
    const loadingBar = document.getElementById('startup-loading-bar');
    const loadingText = document.getElementById('startup-loading-text');
    if (!startupScreen) {
      console.error('Startup screen element not found!');
      return;
    }
    
    const steps = [
      { progress: 15, text: 'Loading core modules...' },
      { progress: 35, text: 'Initializing UI components...' },
      { progress: 65, text: 'Loading user presets...' },
      { progress: 85, text: 'Binding event listeners...' },
      { progress: 100, text: 'Starting SuperFokus...' }
    ];

    let currentStep = 0;

    function executeNextStep() {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        if (loadingBar) loadingBar.style.width = step.progress + '%';
        if (loadingText) loadingText.innerText = step.text;
        
        // Execute actual initialization at specific steps to synchronize progress
        if (currentStep === 1) {
            initializeDomElements();
        } else if (currentStep === 3) {
            initializeButtonListeners();
            updateStatsUI();
            renderChart();
        }

        currentStep++;
        setTimeout(executeNextStep, 300); // 300ms per step
      } else {
        // Wait briefly at 100% then fade out
        setTimeout(() => {
          startupScreen.style.opacity = '0';
          setTimeout(() => {
            startupScreen.style.display = 'none';
          }, 1000); // matches the 1s CSS transition
        }, 300);
      }
    }

    // Start loading sequence
    setTimeout(executeNextStep, 200);

  } catch (error) {
    console.error('[Startup] Error during initialization:', error);
  }
});

function initializeDomElements() {
  try {
    // Workflow elements
    window.workflowStack = document.getElementById('workflow-stack');
    window.workflowStackPlaceholder = document.getElementById('workflow-stack-placeholder');
    window.workflowTotalDurationEl = document.getElementById('workflow-total-duration');
    
    // Other elements that might be accessed early
    window.workflowPaletteItems = document.querySelectorAll('.workflow-palette-item');
    
    // Dynamically inject the Break block into the palette if it hasn't been added to the HTML
    if (window.workflowPaletteItems && window.workflowPaletteItems.length > 0) {
        const paletteContainer = window.workflowPaletteItems[0].parentNode;
        const hasBreak = Array.from(window.workflowPaletteItems).some(el => el.dataset.type === 'break');
        if (!hasBreak && paletteContainer) {
            const breakItem = document.createElement('div');
            breakItem.className = 'workflow-palette-item';
            breakItem.dataset.type = 'break';
            breakItem.draggable = true;
            breakItem.innerHTML = '<strong>Break ⛾</strong><br><small>Drag to add</small>';
            paletteContainer.appendChild(breakItem);
            window.workflowPaletteItems = document.querySelectorAll('.workflow-palette-item');
        }
    }

    // Set up workflow event listeners
    setupWorkflowEventListeners();

    // Set up workflow presets event listeners
    setupWorkflowPresetsEventListeners();
  } catch (error) {
    console.error('[Startup] Error initializing DOM elements:', error);
  }
}

function initializeButtonListeners() {
  try {
    initializeRepeatingButtonListeners();
  } catch (error) {
    console.error('[Startup] Error initializing button listeners:', error);
  }
}

const modalCloses = document.querySelectorAll('.modal-close');
modalCloses.forEach(close => {
    close.addEventListener('click', () => {
        close.closest('.modal-overlay').classList.remove('active');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Forcefully guard Stop buttons to ensure they never get disabled.
// When modes start, they often lock all inputs/buttons, which accidentally disables the Stop buttons.
setInterval(() => {
    document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent ? btn.textContent.toLowerCase() : '';
        const isStopBtn = text.includes('stop') || btn.id.includes('stop') || btn.className.includes('stop');
        
        if (isStopBtn) {
            if (btn.disabled) {
                btn.disabled = false;
            }
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
        }
    });
}, 500);

// Global delegated listeners for fallback button handling
// Using capture phase (true) ensures we read the button text BEFORE any other click handlers mutate it from "Start" to "Stop"
document.addEventListener('click', (e) => {
    // 1. Micro-Task Sprint Stop Button
    const sprintBtn = e.target.closest('button');
    const isSprintStop = e.target.closest('#stop-sprint-btn, #sprint-stop-btn, #micro-sprint-stop-btn, .stop-sprint-btn, [data-action="stop-sprint"]') || 
                         (e.target.closest('#config-micro-sprint') && sprintBtn && sprintBtn.textContent.toLowerCase().includes('stop'));
    if (isSprintStop && typeof stopSprintMode === 'function') {
        stopSprintMode();
    }

    // 2. Flow State Stop Button
    const flowBtn = e.target.closest('button');
    const isFlowStop = e.target.closest('#stop-flow-btn, #flow-stop-btn, #flow-state-stop-btn, .stop-flow-btn, [data-action="stop-flow"]') ||
                       (e.target.closest('#config-flow-state') && flowBtn && flowBtn.textContent.toLowerCase().includes('stop'));
    if (isFlowStop && typeof stopFlowState === 'function') {
        stopFlowState();
    }

    // 3. Site Blocker Save & Apply Button
    const saveBlockerBtn = e.target.closest('#site-blocker-save-btn, #save-blocker-btn') || 
                          (e.target.tagName === 'BUTTON' && e.target.innerText.includes('Save & Apply'));
    if (saveBlockerBtn) {
        try {
            const container = saveBlockerBtn.closest('.active, .modal-content, .sidebar-modal, body') || document;
            let mode = 'block';
            const modeSelect = container.querySelector('select[id*="mode"]');
            const modeCheck = container.querySelector('input[type="checkbox"][id*="mode"]');
            if (modeSelect) mode = modeSelect.value.includes('allow') ? 'allow' : 'block';
            else if (modeCheck) mode = modeCheck.checked ? 'allow' : 'block';
            const active = container.querySelector('input[type="checkbox"][id*="active"], input[type="checkbox"][id*="enable"], input[type="checkbox"][id*="blocker-switch"]')?.checked || false;
            const alwaysRun = container.querySelector('input[type="checkbox"][id*="always"]')?.checked || false;
            const domainsText = container.querySelector('textarea[id*="domain"]')?.value || '';
            const urlsText = container.querySelector('textarea[id*="url"]')?.value || '';
            const domains = domainsText.split('\n').map(d => d.trim()).filter(Boolean);
            const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);
            
            ipcRenderer.send('update-blocker-rules', { mode, active, alwaysRun, domains, urls });
            
            // Visual feedback so you know the save actually executed
            if (typeof customAlert === 'function') {
                customAlert('Site Blocker rules have been successfully saved and applied!');
            } else {
                alert('Site Blocker rules saved!');
            }
        } catch (err) {
            console.error('Fallback site blocker save failed:', err);
        }
    }
}, true);

// --- Mode Switching ---
const homeMenu = document.getElementById('home-menu');
const dashboardTitle = document.getElementById('dashboard-title');
const headerTitle = document.getElementById('header-title');

const configSections = {
  'repeating-reminders': document.getElementById('config-repeating-reminders'),
  'pomo-style': document.getElementById('config-pomo-style'),
  'micro-sprint': document.getElementById('config-micro-sprint'),
  'flow-state': document.getElementById('config-flow-state'),
  'workflows': document.getElementById('config-workflows')
};

document.querySelectorAll('.home-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-mode');
    
    homeMenu.style.display = 'none';
    Object.values(configSections).forEach(section => {
      if (section) section.classList.remove('active');
    });
    if (configSections[mode]) {
      configSections[mode].classList.add('active');
      const titleText = btn.innerText.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
      // Remove any leading icon characters like ⟳ ✓ ☑ ⏱ ⚙
      dashboardTitle.innerText = titleText.replace(/^[⟳✓☑⏱⚙]\s*/, '');
    }

    const dashboardSubtitle = document.getElementById('dashboard-subtitle');
    if (dashboardSubtitle) {
        dashboardSubtitle.innerHTML = '<span id="select-another-mode-btn" style="text-decoration: underline; cursor: pointer; color: var(--header-grad-1);">Select another Fokus Mode</span>';
        const selectAnotherBtn = document.getElementById('select-another-mode-btn');
        if (selectAnotherBtn) {
            selectAnotherBtn.addEventListener('click', () => {
                const modal = document.getElementById('choose-extra-mode');
                if (modal) {
                    if (typeof closeSidebar === 'function') closeSidebar();
                    document.querySelectorAll('.extra-mode-btn').forEach(mBtn => {
                        if (mBtn.getAttribute('data-switch-mode') === mode) {
                            mBtn.style.display = 'none';
                        } else {
                            mBtn.style.display = 'block';
                        }
                    });
                    modal.classList.add('active');
                }
            });
        }
    }
  });
});

document.querySelectorAll('.extra-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-switch-mode');
        const modal = document.getElementById('choose-extra-mode');
        if (modal) modal.classList.remove('active');
        
        const targetHomeBtn = document.querySelector(`.home-btn[data-mode="${mode}"]`);
        if (targetHomeBtn) {
            targetHomeBtn.click();
        }
    });
});

if (headerTitle) {
    headerTitle.addEventListener('click', () => {
        returnToHome(true);
    });
}

export function returnToHome(isManualUserAction = false) {
    // REMOVED: Forced stopping of modes! 
    // Now, navigating back to the home screen or switching to another view
    // will keep your active Fokus Modes (Pomo, Sprint, Flow, Workflows) running in the background.
    
    Object.values(configSections).forEach(section => {
      if (section) section.classList.remove('active');
    });
    if (homeMenu) homeMenu.style.display = 'grid';
    if (dashboardTitle) dashboardTitle.innerText = 'Dashboard';
    const dashboardSubtitle = document.getElementById('dashboard-subtitle');
    if (dashboardSubtitle) {
        dashboardSubtitle.innerHTML = '<span style="color: var(--timer-subtext);">Select a Fokus Mode to get started</span>';
    }
}
