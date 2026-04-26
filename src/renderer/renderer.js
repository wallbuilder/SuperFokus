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
        returnToHome();
    });
}

export function returnToHome() {
    if (typeof isPomoRunning !== 'undefined' && isPomoRunning) stopPomoStyle();
    if (typeof isRepeatingRunning !== 'undefined' && isRepeatingRunning) stopRepeatingReminders();
    if (typeof isSprintRunning !== 'undefined' && isSprintRunning) stopSprintMode();
    if (typeof isFlowRunning !== 'undefined' && isFlowRunning) stopFlowState();
    
    if (typeof isWorkflowRunning !== 'undefined' && isWorkflowRunning) {
        const stopWf = document.getElementById('stop-workflow-btn');
        if (stopWf) stopWf.click();
    }
    
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
