import { ipcRenderer, normalizeHost } from './utils/ipc.js';
import { store, migrateStore } from './utils/storage.js';

// Migrate data before initializing modules
(async () => {
    await migrateStore();

    const { customAlert, closeSidebar, toggleSidebar } = await import('./ui/modals.js');
    const { initTheme, toggleTheme, applyTheme, applyHeaderToggleVisibility } = await import('./ui/theme.js');
    const { initStats, updateStatsUI, renderChart } = await import('./utils/stats.js');
    const { initAudio } = await import('./utils/audio.js');
    const { initWorkflows, setupWorkflowEventListeners, setupWorkflowPresetsEventListeners, workflowState } = await import('./features/workflows.js');
    const { initPomo, pomoState, stopPomoStyle } = await import('./features/pomo-timer.js');
    const { initRepeating, repeatingState, stopRepeatingReminders, initializeRepeatingButtonListeners } = await import('./features/repeating.js');
    const { initSprint, sprintState, stopSprintMode } = await import('./features/micro-sprint.js');
    const { initFlow, flowState, stopFlowState } = await import('./features/flow-state.js');
    const { blockerState } = await import('./features/site-blocker.js');

    // Import modules that attach event listeners on load
    await import('./features/site-blocker.js');
    await import('./features/health-mode.js');

    // Startup Animation Logic
    const initApp = async () => {
      try {
        const startupScreen = document.getElementById('startup-screen');
        const loadingBar = document.getElementById('startup-loading-bar');
        const loadingText = document.getElementById('startup-loading-text');
        
        if (!startupScreen) {
          console.error('Startup screen element not found!');
          // Even if screen is missing, we must initialize the app logic
          initializeDomElements(setupWorkflowEventListeners, setupWorkflowPresetsEventListeners);
          await runInitializationSteps();
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

        const executeNextStep = async () => {
          if (currentStep < steps.length) {
            const step = steps[currentStep];
            if (loadingBar) loadingBar.style.width = step.progress + '%';
            if (loadingText) loadingText.innerText = step.text;
            
            // Execute actual initialization at specific steps to synchronize progress
            try {
                if (currentStep === 1) {
                    initializeDomElements(setupWorkflowEventListeners, setupWorkflowPresetsEventListeners);
                } else if (currentStep === 2) {
                    await initTheme();
                    await initStats();
                    await initAudio();
                    await initWorkflows();
                    await initPomo();
                    await initRepeating();
                    await initSprint();
                    await initFlow();
                } else if (currentStep === 3) {
                    initializeButtonListeners(initializeRepeatingButtonListeners);
                    await updateStatsUI();
                    renderChart();
                }
            } catch (err) {
                console.error(`[Startup] Error at step ${currentStep}:`, err);
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
        };

        // Start loading sequence
        setTimeout(executeNextStep, 200);

      } catch (error) {
        console.error('[Startup] Critical error during initialization:', error);
      }
    };

    // Helper for fallback initialization if startup screen fails
    const runInitializationSteps = async () => {
        await initTheme();
        await initStats();
        await initAudio();
        await initWorkflows();
        await initPomo();
        await initRepeating();
        await initSprint();
        await initFlow();
        initializeButtonListeners(initializeRepeatingButtonListeners);
        await updateStatsUI();
        renderChart();
    };

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();

function initializeDomElements(setupWorkflowEventListeners, setupWorkflowPresetsEventListeners) {
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
    if (typeof setupWorkflowEventListeners === 'function') {
        setupWorkflowEventListeners();
    }

    // Set up workflow presets event listeners
    if (typeof setupWorkflowPresetsEventListeners === 'function') {
        setupWorkflowPresetsEventListeners();
    }
  } catch (error) {
    console.error('[Startup] Error initializing DOM elements:', error);
  }
}

function initializeButtonListeners(initializeRepeatingButtonListeners) {
  try {
    if (typeof initializeRepeatingButtonListeners === 'function') {
        initializeRepeatingButtonListeners();
    }
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

// Fallback button handling logic moved to global delegated listeners below.

// Global delegated listeners for fallback button handling
// Using capture phase (true) ensures we read the button text BEFORE any other click handlers mutate it from "Start" to "Stop"
document.addEventListener('click', (e) => {
    // 1. Micro-Task Sprint Stop Button
    const sprintBtn = e.target.closest('button');
    const isSprintStop = e.target.closest('#stop-sprint-btn, #sprint-stop-btn, #micro-sprint-stop-btn, .stop-sprint-btn, [data-action="stop-sprint"]') || 
                         (e.target.closest('#config-micro-sprint') && sprintBtn && sprintBtn.textContent.toLowerCase().includes('stop'));
    // We don't have direct access to stopSprintMode here because it's dynamically imported, 
    // but the actual listener in micro-sprint.js will handle it.
    // This global listener seems to be for cases where the module isn't fully loaded or something?
    // Actually, it was using stopSprintMode if it's in scope.

    // 2. Flow State Stop Button
    const flowBtn = e.target.closest('button');
    const isFlowStop = e.target.closest('#stop-flow-btn, #flow-stop-btn, #flow-state-stop-btn, .stop-flow-btn, [data-action="stop-flow"]') ||
                       (e.target.closest('#config-flow-state') && flowBtn && flowBtn.textContent.toLowerCase().includes('stop'));
    
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
