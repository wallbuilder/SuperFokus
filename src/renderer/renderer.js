import { store, migrateStore } from './utils/storage.js';
import { initializeDomElements, initializeButtonListeners, initializeCustomSoundpackListeners } from './dom-init.js';

// Modular Refactor of renderer.js
// --- Mode Switching Definitions ---
const homeMenu = document.getElementById('home-menu');
const dashboardTitle = document.getElementById('dashboard-title');
const headerTitle = document.getElementById('header-title');

const configSections = {
  'repeating-reminders': document.getElementById('config-repeating-reminders'),
  'pomo-style': document.getElementById('config-pomo-style'),
  'micro-sprint': document.getElementById('config-micro-sprint'),
  'flow-state': document.getElementById('config-flow-state'),
  'health-mode': document.getElementById('config-health-mode'),
  'workflows': document.getElementById('config-workflows')
};

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

// Initial Setup
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

export function switchMode(mode) {
  if (homeMenu) homeMenu.style.display = 'none';
  Object.values(configSections).forEach(section => {
    if (section) section.classList.remove('active');
  });
  if (configSections[mode]) {
    configSections[mode].classList.add('active');
    const btn = document.querySelector(`.home-btn[data-mode="${mode}"]`);
    if (btn) {
      const titleText = btn.innerText.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
      if (dashboardTitle) dashboardTitle.innerText = titleText.replace(/^[⟳✓☑⏱⚙❤️♡]\s*/, '');
    }
  }

  const dashboardSubtitle = document.getElementById('dashboard-subtitle');
  if (dashboardSubtitle) {
      dashboardSubtitle.innerHTML = '<span id="select-another-mode-btn" style="text-decoration: underline; cursor: pointer; color: var(--header-grad-1);">Select another Fokus Mode</span>';
      const selectAnotherBtn = document.getElementById('select-another-mode-btn');
      if (selectAnotherBtn) {
          selectAnotherBtn.addEventListener('click', () => {
              const modal = document.getElementById('choose-extra-mode');
              if (modal) modal.classList.add('active');
          });
      }
  }
}

document.querySelectorAll('.home-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-mode');
    switchMode(mode);
  });
});

document.querySelectorAll('.extra-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-switch-mode');
        const modal = document.getElementById('choose-extra-mode');
        if (modal) modal.classList.remove('active');
        const targetHomeBtn = document.querySelector(`.home-btn[data-mode="${mode}"]`);
        if (targetHomeBtn) targetHomeBtn.click();
    });
});

if (headerTitle) {
    headerTitle.addEventListener('click', () => returnToHome(true));
}

// Startup Logic
(async () => {
    try {
        console.log('[Startup] Starting migration...');
        await migrateStore();
        console.log('[Startup] Migration complete. Loading modules...');

        const [
            theme, stats, audio, workflows, pomo, repeating, sprint, flow, integration, siteBlocker
        ] = await Promise.all([
            import('./ui/theme.js'),
            import('./utils/stats.js'),
            import('./utils/audio.js'),
            import('./features/workflows.js'),
            import('./features/pomo-timer.js'),
            import('./features/repeating.js'),
            import('./features/micro-sprint.js'),
            import('./features/flow-state.js'),
            import('./ui/integration.js'),
            import('./features/site-blocker.js')
        ]);


        const initApp = async () => {
          console.log('[Startup] Initializing App UI...');
          if (window.electronAPI && window.electronAPI.platform === 'darwin') {
              document.body.classList.add('platform-darwin');
          }
          const startupScreen = document.getElementById('startup-screen');
          const loadingBar = document.getElementById('startup-loading-bar');
          const loadingText = document.getElementById('startup-loading-text');
          
          if (!startupScreen) {
            await runInitializationSteps(theme, stats, audio, workflows, pomo, repeating, sprint, flow, integration, siteBlocker);
            return;
          }
          
          const steps = [
            { progress: 20, text: 'Core modules loaded.' },
            { progress: 50, text: 'Initializing UI & Features...' },
            { progress: 80, text: 'Finalizing setup...' },
            { progress: 100, text: 'Starting SuperFokus...' }
          ];

          let currentStep = 0;
          const executeStepsSequentially = async () => {
              if (loadingBar) loadingBar.style.width = '100%';
              if (loadingText) loadingText.innerText = 'Starting SuperFokus...';

              initializeDomElements(workflows.setupWorkflowEventListeners, workflows.setupWorkflowPresetsEventListeners);
              await Promise.all([
                  theme.initTheme(), stats.initStats(), audio.initAudio(), workflows.initWorkflows(),
                  pomo.initPomo(), repeating.initRepeating(), sprint.initSprint(), flow.initFlow(),
                  integration.setupIntegrationUI(), siteBlocker.initSiteBlocker()
              ]);

              initializeButtonListeners(repeating.initializeRepeatingButtonListeners); 
              initializeCustomSoundpackListeners(
                  audio.updateCustomNotifsUI, audio.updateCustomAmbientUI, audio.updateCustomPackUI,
                  audio.updateSoundSelectors, audio.loadFileAsDataURL, audio.saveCustomSoundPack, audio.deleteCustomSoundPack
              );
              await stats.updateStatsUI();
              stats.renderChart();

              startupScreen.style.opacity = '0';
              setTimeout(() => { startupScreen.style.display = 'none'; }, 400);
          };
          executeStepsSequentially();
        };

        const runInitializationSteps = async (theme, stats, audio, workflows, pomo, repeating, sprint, flow, integration, siteBlocker) => {
            initializeDomElements(workflows.setupWorkflowEventListeners, workflows.setupWorkflowPresetsEventListeners);
            await Promise.all([
                theme.initTheme(), stats.initStats(), audio.initAudio(), workflows.initWorkflows(),
                pomo.initPomo(), repeating.initRepeating(), sprint.initSprint(), flow.initFlow(),
                integration.setupIntegrationUI(), siteBlocker.initSiteBlocker()
            ]);
            initializeButtonListeners(repeating.initializeRepeatingButtonListeners);
            initializeCustomSoundpackListeners(
                audio.updateCustomNotifsUI, audio.updateCustomAmbientUI, audio.updateCustomPackUI, 
                audio.updateSoundSelectors, audio.loadFileAsDataURL, audio.saveCustomSoundPack, audio.deleteCustomSoundPack
            );
            await stats.updateStatsUI();
            stats.renderChart();
        };

        if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', initApp);
        else initApp();
    } catch (criticalError) {
        console.error('[Startup] FATAL ERROR:', criticalError);
        const startupScreen = document.getElementById('startup-screen');
        if (startupScreen) startupScreen.style.display = 'none';
        alert('SuperFokus encountered a problem during startup: ' + criticalError.message);
    }
})();
