import { ipcRenderer, normalizeHost } from './utils/ipc.js';
import { store, migrateStore } from './utils/storage.js';

// Migrate data before initializing modules
(async () => {
    try {
        console.log('[Startup] Starting migration...');
        await migrateStore();
        console.log('[Startup] Migration complete. Loading modules...');

        // Parallelize all module imports for faster startup
        const [
            modals,
            theme,
            stats,
            audio,
            workflows,
            pomo,
            repeating,
            sprint,
            flow,
            blocker,
            health
        ] = await Promise.all([
            import('./ui/modals.js'),
            import('./ui/theme.js'),
            import('./utils/stats.js'),
            import('./utils/audio.js'),
            import('./features/workflows.js'),
            import('./features/pomo-timer.js'),
            import('./features/repeating.js'),
            import('./features/micro-sprint.js'),
            import('./features/flow-state.js'),
            import('./features/site-blocker.js'),
            import('./features/health-mode.js')
        ]);

        const { customAlert, closeSidebar, toggleSidebar } = modals;
        const { initTheme, applyTheme, applyHeaderToggleVisibility } = theme;
        const { initStats, updateStatsUI, renderChart } = stats;
        const { initAudio, playChime, playFallbackBeep, toggleAmbientNoise, loadFileAsDataURL, saveCustomSoundPack, deleteCustomSoundPack, updateCustomPackUI, updateSoundSelectors, updateCustomNotifsUI, updateCustomAmbientUI } = audio;
        const { initWorkflows, setupWorkflowEventListeners, setupWorkflowPresetsEventListeners, workflowState } = workflows;
        const { initPomo, pomoState, stopPomoStyle } = pomo;
        const { initRepeating, repeatingState, stopRepeatingReminders, initializeRepeatingButtonListeners } = repeating;
        const { initSprint, sprintState, stopSprintMode } = sprint;
        const { initFlow, flowState, stopFlowState } = flow;
        const { blockerState } = blocker;

        // Startup Animation Logic
        const initApp = async () => {
          console.log('[Startup] Initializing App UI...');
          try {
            const startupScreen = document.getElementById('startup-screen');
            const loadingBar = document.getElementById('startup-loading-bar');
            const loadingText = document.getElementById('startup-loading-text');
            
            if (!startupScreen) {
              console.error('[Startup] Startup screen element not found!');
              await runInitializationSteps();
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
              while (currentStep < steps.length) {
                const step = steps[currentStep];
                console.log(`[Startup] Step ${currentStep}: ${step.text}`);
                
                if (loadingBar) loadingBar.style.width = step.progress + '%';
                if (loadingText) loadingText.innerText = step.text;
                
                try {
                    if (currentStep === 1) {
                        // Parallelize DOM initialization and basic module setup
                        initializeDomElements(setupWorkflowEventListeners, setupWorkflowPresetsEventListeners);
                        
                        console.log('[Startup] Initializing modules in parallel...');
                        await Promise.all([
                            initTheme(),
                            initStats(),
                            initAudio(),
                            initWorkflows(),
                            initPomo(),
                            initRepeating(),
                            initSprint(),
                            initFlow()
                        ]);
                        console.log('[Startup] Modules initialized.');
                    } else if (currentStep === 2) {
                        initializeButtonListeners(initializeRepeatingButtonListeners);
                        try {
                            initializeCustomSoundpackListeners(
                                updateCustomNotifsUI, updateCustomAmbientUI, updateCustomPackUI, 
                                updateSoundSelectors, loadFileAsDataURL, saveCustomSoundPack, deleteCustomSoundPack
                            );
                        } catch (error) {
                            console.error('[Startup] Error in secondary listeners:', error);
                        }
                        
                        // Update UI components that depend on initialized data
                        await updateStatsUI();
                        renderChart();
                    }
                } catch (err) {
                    console.error(`[Startup] Error at step ${currentStep}:`, err);
                }

                currentStep++;
                // Reduced delay for a snappier feel
                await new Promise(r => setTimeout(r, 0));
              }

              console.log('[Startup] Initialization complete.');
              setTimeout(() => {
                startupScreen.style.opacity = '0';
                setTimeout(() => {
                  startupScreen.style.display = 'none';
                }, 400); // Faster fade out
              }, 0);
            };

            executeStepsSequentially();

          } catch (error) {
            console.error('[Startup] Critical error during initApp:', error);
          }
        };

        const runInitializationSteps = async () => {
            await Promise.all([
                initTheme(),
                initStats(),
                initAudio(),
                initWorkflows(),
                initPomo(),
                initRepeating(),
                initSprint(),
                initFlow()
            ]);
            initializeDomElements(setupWorkflowEventListeners, setupWorkflowPresetsEventListeners);
            initializeButtonListeners(initializeRepeatingButtonListeners);
            initializeCustomSoundpackListeners(
                updateCustomNotifsUI, updateCustomAmbientUI, updateCustomPackUI, 
                updateSoundSelectors, loadFileAsDataURL, saveCustomSoundPack, deleteCustomSoundPack
            );
            await updateStatsUI();
            renderChart();
        };

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
    } catch (criticalError) {
        console.error('[Startup] FATAL ERROR:', criticalError);
        // Attempt to remove loading screen even on fatal error so user isn't stuck forever
        const startupScreen = document.getElementById('startup-screen');
        if (startupScreen) {
            startupScreen.style.display = 'none';
        }
        alert('SuperFokus encountered a problem during startup: ' + criticalError.message + '\n\nSome features may be unavailable.');
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

function initializeCustomSoundpackListeners(
    updateCustomNotifsUI, updateCustomAmbientUI, updateCustomPackUI, 
    updateSoundSelectors, loadFileAsDataURL, saveCustomSoundPack, deleteCustomSoundPack
) {
    let tempCustomNotifFiles = [];
    let tempCustomAmbientFiles = [];

    const customNotifUploadBtn = document.getElementById('custom-notif-upload-btn');
    const customNotifUploadInput = document.getElementById('custom-notif-upload');
    const customNotifPreview = document.getElementById('custom-notif-preview');

    const customAmbientUploadBtn = document.getElementById('custom-ambient-upload-btn');
    const customAmbientUploadInput = document.getElementById('custom-ambient-upload');
    const customAmbientPreview = document.getElementById('custom-ambient-preview');

    const saveCustomPackBtn = document.getElementById('save-custom-pack-btn');
    const customPackNameInput = document.getElementById('custom-pack-name');
    const customPacksSelector = document.getElementById('custom-packs-selector');
    const deleteCustomPackBtn = document.getElementById('delete-custom-pack-btn');
    
    // Initial UI updates after elements are confirmed to exist
    updateCustomNotifsUI();
    updateCustomAmbientUI();
    updateCustomPackUI();
    updateSoundSelectors();
    // Custom Notification Upload
    if (customNotifUploadBtn && customNotifUploadInput && customNotifPreview) {
        customNotifUploadBtn.addEventListener('click', () => customNotifUploadInput.click());
        customNotifUploadInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                const dataUrl = await loadFileAsDataURL(file);
                tempCustomNotifFiles.push(dataUrl);
            }
            renderTempCustomSounds(tempCustomNotifFiles, customNotifPreview, 'notif');
            e.target.value = ''; // Clear input
        });
    }

    // Custom Ambient Upload
    if (customAmbientUploadBtn && customAmbientUploadInput && customAmbientPreview) {
        customAmbientUploadBtn.addEventListener('click', () => customAmbientUploadInput.click());
        customAmbientUploadInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                const dataUrl = await loadFileAsDataURL(file);
                tempCustomAmbientFiles.push(dataUrl);
            }
            renderTempCustomSounds(tempCustomAmbientFiles, customAmbientPreview, 'ambient');
            e.target.value = ''; // Clear input
        });
    }

    // Save Custom Soundpack
    if (saveCustomPackBtn && customPackNameInput) {
        saveCustomPackBtn.addEventListener('click', async () => {
            const packName = customPackNameInput.value.trim();
            if (packName) {
                await saveCustomSoundPack(packName, tempCustomNotifFiles, tempCustomAmbientFiles);
                // Clear temporary files and UI after saving
                tempCustomNotifFiles.length = 0;
                tempCustomAmbientFiles.length = 0;
                renderTempCustomSounds(tempCustomNotifFiles, customNotifPreview, 'notif');
                renderTempCustomSounds(tempCustomAmbientFiles, customAmbientPreview, 'ambient');
                customPackNameInput.value = '';
            } else {
                alert('Please enter a name for your custom soundpack.');
            }
        });
    }

    // Delete Custom Soundpack
    if (deleteCustomPackBtn && customPacksSelector) {
        deleteCustomPackBtn.addEventListener('click', async () => {
            const packName = customPacksSelector.value;
            await deleteCustomSoundPack(packName);
        });
    }

    // Load Custom Soundpack into main selector
    if (customPacksSelector) {
        customPacksSelector.addEventListener('change', (e) => {
            const packName = e.target.value;
            if (packName && packName !== 'none') {
                // When a custom pack is selected in its own creator dropdown,
                // we want to load it into the main sound pack selector as well.
                const mainSoundPackSelector = document.getElementById('sound-pack-selector');
                if (mainSoundPackSelector) {
                    mainSoundPackSelector.value = packName;
                    mainSoundPackSelector.dispatchEvent(new Event('change')); // Trigger change event
                }
            }
        });
    }

    function renderTempCustomSounds(files, previewContainer, type) {
        previewContainer.innerHTML = '';
        if (files.length === 0) {
            const emptyMsg = document.createElement('small');
            emptyMsg.style.color = 'var(--timer-subtext)';
            emptyMsg.innerText = `No custom ${type} sounds added yet.`;
            previewContainer.appendChild(emptyMsg);
            return;
        }

        files.forEach((fileDataUrl, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.style.display = 'flex';
            fileDiv.style.alignItems = 'center';
            fileDiv.style.gap = '8px';
            fileDiv.style.background = 'var(--input-bg)';
            fileDiv.style.padding = '5px 10px';
            fileDiv.style.borderRadius = '5px';
            fileDiv.style.border = '1px solid var(--border-color)';

            const fileName = `Custom ${type === 'notif' ? 'Notification' : 'Ambient'} ${index + 1}`;
            const fileNameSpan = document.createElement('span');
            fileNameSpan.innerText = fileName;
            fileNameSpan.style.flex = '1';
            fileNameSpan.style.fontSize = '0.85rem';

            const playBtn = document.createElement('button');
            playBtn.className = 'action-btn';
            playBtn.style.margin = '0';
            playBtn.style.padding = '4px 8px';
            playBtn.style.background = 'var(--header-grad-1)';
            playBtn.style.width = 'auto';
            playBtn.innerText = 'Play';
            playBtn.onclick = () => {
                const audio = new Audio(fileDataUrl);
                audio.play().catch(e => console.error('Error playing custom sound:', e));
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn';
            deleteBtn.style.margin = '0';
            deleteBtn.style.padding = '4px 8px';
            deleteBtn.style.background = '#e74c3c';
            deleteBtn.style.width = 'auto';
            deleteBtn.innerText = '✕';
            deleteBtn.onclick = () => {
                if (type === 'notif') {
                    tempCustomNotifFiles.splice(index, 1);
                    renderTempCustomSounds(tempCustomNotifFiles, customNotifPreview, 'notif');
                } else {
                    tempCustomAmbientFiles.splice(index, 1);
                    renderTempCustomSounds(tempCustomAmbientFiles, customAmbientPreview, 'ambient');
                }
            };

            fileDiv.appendChild(fileNameSpan);
            fileDiv.appendChild(playBtn);
            fileDiv.appendChild(deleteBtn);
            previewContainer.appendChild(fileDiv);
        });
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
const homeMenu = document.getElementById('home-menu'); if (!homeMenu) console.warn('Missing home-menu element');
const dashboardTitle = document.getElementById('dashboard-title'); if (!dashboardTitle) console.warn('Missing dashboard-title element');
const headerTitle = document.getElementById('header-title'); if (!headerTitle) console.warn('Missing header-title element');

const configSections = {
  'repeating-reminders': document.getElementById('config-repeating-reminders'),
  'pomo-style': document.getElementById('config-pomo-style'),
  'micro-sprint': document.getElementById('config-micro-sprint'),
  'flow-state': document.getElementById('config-flow-state'),
  'health-mode': document.getElementById('config-health-mode'),
  'workflows': document.getElementById('config-workflows')
};

// Add warnings for missing config sections
for (const key in configSections) {
    if (Object.prototype.hasOwnProperty.call(configSections, key)) {
        if (!configSections[key]) {
            console.warn(`Missing config section element: ${key}`);
        }
    }
}

document.querySelectorAll('.home-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-mode');
    
    if (homeMenu) homeMenu.style.display = 'none';
    Object.values(configSections).forEach(section => {
      if (section) section.classList.remove('active');
    });
    if (configSections[mode]) {
      configSections[mode].classList.add('active');
      const titleText = btn.innerText.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
      // Remove any leading icon characters like ⟳ ✓ ☑ ⏱ ⚙ ❤️ ♡
      if (dashboardTitle) dashboardTitle.innerText = titleText.replace(/^[⟳✓☑⏱⚙❤️♡]\s*/, '');    }

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
