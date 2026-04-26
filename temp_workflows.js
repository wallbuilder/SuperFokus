// Workflow elements will be initialized in initializeDomElements()
let workflowBlocks = [];
let workflowPresets = store.get('workflowPresets', {});
const workflowPresetsSelect = document.getElementById('workflow-presets');

function updateWorkflowPresetOptions() {
    if (!workflowPresetsSelect) return;
    Array.from(workflowPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            workflowPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(workflowPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`;
        workflowPresetsSelect.appendChild(option);
    });
}
updateWorkflowPresetOptions();

function updateWorkflowCurrentPresetDisplay() {
    const presetDisplay = document.getElementById('workflow-current-preset');
    if (!presetDisplay) return;
    
    const val = workflowPresetsSelect.value;
    if (val === 'custom') {
        presetDisplay.innerText = 'Custom';
    } else if (val.startsWith('custom-preset-')) {
        const key = val.replace('custom-preset-', '');
        presetDisplay.innerText = key;
    } else {
        presetDisplay.innerText = 'Custom';
    }
}

// Helper: Get available presets for a given type
function getAvailablePresetsForType(type) {
    const presets = [];
    if (type === 'pomo') {
        presets.push({ key: 'deep-work', label: 'Deep Work - 50/10' });
        presets.push({ key: 'quick-study', label: 'Quick Study - 25/5' });
        presets.push({ key: 'homework', label: 'Homework - 45/15' });
        Object.keys(customPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    } else if (type === 'sprint') {
        presets.push({ key: 'custom', label: 'Custom' });
        Object.keys(sprintPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    } else if (type === 'repeating') {
        presets.push({ key: 'custom', label: 'Custom' });
        Object.keys(repeatingPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    }
    return presets;
}

// Helper: Get preset details based on type and presetKey
function getPresetDetails(type, presetKey) {
    const details = {
        type: type,
        presetKey: presetKey,
        displayName: '',
        sequence: null,
        duration: null,
        rounds: null,
        interval: null
    };

    if (type === 'pomo') {
        let seq = null;
        if (presetKey === 'deep-work') {
            seq = [{ type: 'work', duration: 50 }, { type: 'break', duration: 10 }];
            details.displayName = 'Deep Work - 50/10';
        } else if (presetKey === 'quick-study') {
            seq = [{ type: 'work', duration: 25 }, { type: 'break', duration: 5 }];
            details.displayName = 'Quick Study - 25/5';
        } else if (presetKey === 'homework') {
            seq = [{ type: 'work', duration: 45 }, { type: 'break', duration: 15 }];
            details.displayName = 'Homework - 45/15';
        } else if (presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (customPresets[key]) {
                seq = customPresets[key];
                details.displayName = `Custom: ${key}`;
            }
        }
        if (seq) {
            details.sequence = seq;
            const totalMins = seq.reduce((acc, p) => acc + (p.unit === 'secs' ? p.duration/60 : p.duration), 0);
            details.duration = Math.round(totalMins * 10) / 10;
        }
    } else if (type === 'sprint') {
        if (presetKey === 'custom') {
            details.displayName = 'Custom Sprint';
            details.duration = parseInt(sprintDurationSelect.value, 10) || 15;
        } else if (presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (sprintPresets[key]) {
                details.displayName = `Custom: ${key}`;
                const val = sprintPresets[key].durationVal;
                details.duration = val === 'custom' ? (sprintPresets[key].customMins || 20) : (parseInt(val, 10) || 15);
            }
        }
    } else if (type === 'repeating') {
        if (presetKey === 'custom') {
            details.displayName = 'Custom Reminders';
            const intervalMins = parseInt(reminderIntervalInput.value, 10) || 0;
            const intervalSecs = parseInt(reminderIntervalSecondsInput.value, 10) || 0;
            const rounds = parseInt(reminderRoundsInput.value, 10) || 1;
            details.interval = { mins: intervalMins, secs: intervalSecs };
            details.rounds = rounds;
            details.duration = Math.round(((intervalMins * 60 + intervalSecs) * rounds) / 60);
        } else if (presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (repeatingPresets[key]) {
                details.displayName = `Custom: ${key}`;
                details.interval = { 
                    mins: repeatingPresets[key].intervalMins || 0, 
                    secs: repeatingPresets[key].intervalSecs || 0 
                };
                details.rounds = repeatingPresets[key].rounds || 1;
                const minsTotal = details.interval.mins;
                const secsTotal = details.interval.secs;
                details.duration = Math.round(((minsTotal * 60 + secsTotal) * details.rounds) / 60);
            }
        }
    }

    return details;
}

function calculateBlockDuration(block) {
    let baseMins = 0;
    
    if (block.type === 'break') {
        baseMins = block.duration || 5;
        return Math.max(1, Math.round(baseMins * block.cycles));
    }

    // If block has presetKey, use it for calculation
    if (block.presetKey) {
        const details = getPresetDetails(block.type, block.presetKey);
        baseMins = details.duration || 0;
    } else {
        // Fallback to old behavior for blocks without presetKey
        if (block.type === 'pomo') {
            baseMins = pomoSequence.reduce((acc, p) => acc + (p.unit === 'secs' ? p.duration/60 : p.duration), 0);
        } else if (block.type === 'sprint') {
            let dur = sprintDurationSelect.value;
            baseMins = dur === 'custom' ? (parseInt(customSprintDurationInput.value, 10) || 20) : parseInt(dur, 10);
        } else if (block.type === 'repeating') {
            const intervalMins = parseInt(reminderIntervalInput.value, 10) || 0;
            const intervalSecs = parseInt(reminderIntervalSecondsInput.value, 10) || 0;
            const rounds = parseInt(reminderRoundsInput.value, 10) || 1;
            baseMins = ((intervalMins * 60 + intervalSecs) * rounds) / 60;
        }
    }
    
    return Math.max(1, Math.round(baseMins * block.cycles));
}

function addWorkflowBlock(type) {
    let block;
    if (type === 'break') {
        block = {
            id: 'block-' + Date.now(),
            type: 'break',
            name: 'Break Block',
            cycles: 1,
            duration: 5,
            blocksScreen: false
        };
    } else {
        // Get the first available preset as default
        const availablePresets = getAvailablePresetsForType(type);
        const defaultPresetKey = availablePresets.length > 0 ? availablePresets[0].key : 'custom';
        block = {
            id: 'block-' + Date.now(),
            type: type,
            name: type === 'pomo' ? 'Pomo Session' : (type === 'sprint' ? 'Micro-Sprint' : 'Repeating Reminder'),
            cycles: 1,
            presetKey: defaultPresetKey
        };
    }
    workflowBlocks.push(block);
    renderWorkflowStack();
}

function renderWorkflowStack() {
    try {
        if (!window.workflowStack) {
            console.error('[Startup] workflowStack element not found!');
            return;
        }
        
        const existingBlocks = window.workflowStack.querySelectorAll('.workflow-block');
        existingBlocks.forEach(b => b.remove());

        if (workflowBlocks.length === 0) {
            if (window.workflowStackPlaceholder) window.workflowStackPlaceholder.style.display = 'block';
            if (window.workflowTotalDurationEl) window.workflowTotalDurationEl.innerText = '0m';
            return;
        }

        if (window.workflowStackPlaceholder) window.workflowStackPlaceholder.style.display = 'none';
        let totalDuration = 0;

        workflowBlocks.forEach((block, index) => {
            const dur = calculateBlockDuration(block);
            totalDuration += dur;

            const blockEl = document.createElement('div');
            blockEl.className = 'workflow-block';
            blockEl.draggable = true;
            blockEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', `reorder:${index}`);
                e.dataTransfer.effectAllowed = 'move';
                window._draggedWorkflowItem = { type: null, index: index };
                setTimeout(() => blockEl.style.opacity = '0.5', 0);
            });
            blockEl.addEventListener('dragend', (e) => {
                blockEl.style.opacity = '1';
                window._draggedWorkflowItem = { type: null, index: null };
                const ph = document.getElementById('workflow-drop-placeholder');
                if (ph) ph.remove();
            });
            
            let typeIcon = '';
            let typeColor = '#6a11cb'; // Default to valid hex for pomo
            if (block.type === 'pomo') {
                typeIcon = '✓';
            } else if (block.type === 'sprint') {
                typeIcon = '☑';
                typeColor = '#3498db';
            } else if (block.type === 'repeating') {
                typeIcon = '⟳';
                typeColor = '#27ae60';
            } else if (block.type === 'break') {
                typeIcon = '⛾';
                typeColor = '#f1c40f';
            }

            const availablePresets = getAvailablePresetsForType(block.type);
            const presetDetails = getPresetDetails(block.type, block.presetKey);

            // Create preset details static content
            let presetDetailsHtml = '';
            if (block.type === 'pomo' && presetDetails.sequence) {
                presetDetailsHtml = '<div style="font-size: 0.85rem; color: var(--text-color); margin-top: 8px; padding: 8px; background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);">';
                presetDetails.sequence.forEach(phase => {
                    const phaseType = phase.type === 'work' ? 'Work' : 'Break';
                    const phaseColor = phase.type === 'work' ? '#27ae60' : '#f39c12';
                    const phaseDuration = phase.unit === 'secs' ? `${phase.duration}s` : `${phase.duration}m`;
                    presetDetailsHtml += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="color: ${phaseColor};">${phaseType}:</span><span>${phaseDuration}</span></div>`;
                });
                presetDetailsHtml += '</div>';
            } else if (block.type === 'sprint') {
                presetDetailsHtml = `<div style="font-size: 0.85rem; color: var(--text-color); margin-top: 8px; padding: 8px; background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);"><div style="display: flex; justify-content: space-between;"><span>Duration:</span><span>${presetDetails.duration}m</span></div></div>`;
            } else if (block.type === 'repeating') {
                const interval = presetDetails.interval;
                presetDetailsHtml = `<div style="font-size: 0.85rem; color: var(--text-color); margin-top: 8px; padding: 8px; background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);"><div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Interval:</span><span>${interval.mins}m ${interval.secs}s</span></div><div style="display: flex; justify-content: space-between;"><span>Rounds:</span><span>${presetDetails.rounds}</span></div></div>`;
            }

            let blockContentHtml = '';
            if (block.type === 'break') {
                blockContentHtml = `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; color: var(--timer-subtext); text-transform: uppercase; font-weight: 500;">Duration (mins)</label>
                                <input type="number" class="block-break-duration" data-index="${index}" value="${block.duration || 5}" min="1" style="padding: 8px; text-align: center; border: 1px solid var(--input-border); border-radius: 6px; background: var(--input-bg); font-weight: 600; color: var(--heading-color);">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; align-items: center; background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);">
                                <label style="font-size: 0.75rem; color: var(--timer-subtext); text-transform: uppercase; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" class="block-break-screen" data-index="${index}" ${block.blocksScreen ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                                    Block Screen
                                </label>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                let presetSelectHtml = '<select class="block-preset-input" data-index="' + index + '" style="flex: 1; padding: 6px; border: 1px solid var(--input-border); border-radius: 4px; background: var(--input-bg); color: var(--text-color); font-size: 0.9rem;">';
                availablePresets.forEach(preset => {
                    const selected = preset.key === block.presetKey ? 'selected' : '';
                    presetSelectHtml += '<option value="' + preset.key + '" ' + selected + '>' + preset.label + '</option>';
                });
                presetSelectHtml += '</select>';

                blockContentHtml = `
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.75rem; color: var(--timer-subtext); text-transform: uppercase; font-weight: 500;">Preset</label>
                        ${presetSelectHtml}
                    </div>
                    ${presetDetailsHtml}
                `;
            }

            let cyclesHtml = '';
            if (block.type !== 'break') {
                cyclesHtml = `
                    <!-- Cycles and Duration Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; color: var(--timer-subtext); text-transform: uppercase; font-weight: 500;">Cycles</label>
                            <input type="number" class="block-cycles-input" value="${block.cycles}" min="1" data-index="${index}" style="padding: 8px; text-align: center; border: 1px solid var(--input-border); border-radius: 6px; background: var(--input-bg); font-weight: 600; color: var(--heading-color);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; color: var(--timer-subtext); text-transform: uppercase; font-weight: 500;">Total Duration</label>
                            <div style="padding: 8px; text-align: center; font-weight: 600; color: var(--header-grad-1); background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);">${dur}m</div>
                        </div>
                    </div>
                `;
            }

            blockEl.style.cssText = `
                background: var(--container-bg);
                border-radius: 12px;
                border: 2px solid ${typeColor}40;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                transition: all 0.2s ease;
                overflow: hidden;
            `;

            blockEl.innerHTML = `
                <!-- Colored Header -->
                <div style="background: linear-gradient(135deg, ${typeColor} 0%, ${typeColor}dd 100%); padding: 12px 15px; color: white; display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 6px;">${typeIcon}</div>
                    <div style="flex: 1; font-weight: 600; font-size: 0.95rem;">${block.type === 'pomo' ? 'Pomo Style' : block.type === 'sprint' ? 'Micro-Task Sprint' : block.type === 'repeating' ? 'Repeating Reminders' : 'Break Block'}</div>
                    <button class="remove-block-btn" data-index="${index}" style="margin: 0; width: auto; padding: 4px 8px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.8rem; transition: all 0.2s;">×</button>
                </div>

                <!-- Block Content -->
                <div style="padding: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${blockContentHtml}
                        ${cyclesHtml}
                    </div>
                </div>
            `;

            window.workflowStack.appendChild(blockEl);
        });

        let durationText = `${totalDuration}m`;
        if (totalDuration >= 60) {
            const hours = Math.floor(totalDuration / 60);
            const mins = totalDuration % 60;
            durationText = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }
        if (window.workflowTotalDurationEl) window.workflowTotalDurationEl.innerText = durationText;
    } catch (error) {
        console.error('[Startup] Error rendering workflow stack:', error);
    }
}

// --- Workflow Execution Logic ---
let isWorkflowRunning = false;
let currentWorkflowBlockIndex = 0;
let currentWorkflowCycle = 0;

const startWorkflowBtn = document.getElementById('start-workflow-btn');
const stopWorkflowBtn = document.getElementById('stop-workflow-btn');

function resetWorkflowState() {
    isWorkflowRunning = false;
    currentWorkflowBlockIndex = 0;
    currentWorkflowCycle = 0;
    if (startWorkflowBtn) startWorkflowBtn.style.display = 'block';
    if (stopWorkflowBtn) stopWorkflowBtn.style.display = 'none';
}

function startNextWorkflowBlock() {
    if (!isWorkflowRunning) return;

    if (currentWorkflowBlockIndex >= workflowBlocks.length) {
        customAlert('Workflow Complete!');
        resetWorkflowState();
        const workflowsHomeBtn = document.querySelector('.home-btn[data-mode="workflows"]');
        if (workflowsHomeBtn) workflowsHomeBtn.click();
        return;
    }

    const currentBlock = workflowBlocks[currentWorkflowBlockIndex];
    
    if (currentWorkflowCycle >= currentBlock.cycles) {
        currentWorkflowBlockIndex++;
        currentWorkflowCycle = 0;
        startNextWorkflowBlock();
        return;
    }

    currentWorkflowCycle++;
    
    // Execute Break Block if it is next in the Workflow
    if (currentBlock.type === 'break') {
        const durationSecs = (currentBlock.duration || 5) * 60;
        
        // Ensure timer is registered in main BEFORE showing the popup
        ipcRenderer.send('start-timer', { id: 'workflow-break', seconds: durationSecs });
        
        ipcRenderer.send('show-break-popup', { 
            type: 'Break', 
            duration: durationSecs, 
            fullScreen: currentBlock.blocksScreen,
            autoStart: true 
        });
        
        if (!currentBlock.blocksScreen) {
            ipcRenderer.send('open-pomo-timer');
            ipcRenderer.send('update-pomo-timer', {
                phase: 'Break Time',
                timeLeft: formatTime(durationSecs),
                percent: 100
            });
        }
        return;
    }
    
    const modeMap = {
        'pomo': 'pomo-style',
        'sprint': 'micro-sprint',
        'repeating': 'repeating-reminders'
    };
    
    const targetHomeBtn = document.querySelector(`.home-btn[data-mode="${modeMap[currentBlock.type]}"]`);
    if (targetHomeBtn) {
        targetHomeBtn.click();
    }

    setTimeout(() => {
        if (currentBlock.type === 'pomo') {
            const pomoPresetsSelect = document.getElementById('pomo-presets');
            if (pomoPresetsSelect) {
                pomoPresetsSelect.value = currentBlock.presetKey;
                pomoPresetsSelect.dispatchEvent(new Event('change'));
                const startPomoBtn = document.getElementById('start-pomo-btn');
                if (startPomoBtn) startPomoBtn.click();
            }
        } else if (currentBlock.type === 'sprint') {
            const sprintPresetsSelect = document.getElementById('sprint-presets');
            if (sprintPresetsSelect) {
                sprintPresetsSelect.value = currentBlock.presetKey;
                sprintPresetsSelect.dispatchEvent(new Event('change'));
                const startSprintBtn = document.getElementById('start-sprint-btn');
                if (startSprintBtn) startSprintBtn.click();
            }
        } else if (currentBlock.type === 'repeating') {
            const repeatingPresetsSelect = document.getElementById('repeating-presets');
            if (repeatingPresetsSelect) {
                repeatingPresetsSelect.value = currentBlock.presetKey;
                repeatingPresetsSelect.dispatchEvent(new Event('change'));
                
                const reminderRoundsInput = document.getElementById('reminder-rounds');
                if (reminderRoundsInput) reminderRoundsInput.value = 1; // 1 round per cycle
                
                const startRepeatingBtn = document.getElementById('start-repeating-btn');
                if (startRepeatingBtn) startRepeatingBtn.click();
            }
        }
    }, 100); // slight delay to ensure UI updates after switching modes
}

if (startWorkflowBtn) {
    startWorkflowBtn.addEventListener('click', () => {
        if (workflowBlocks.length === 0) {
            customAlert('Please add blocks to your Building Stack first.');
            return;
        }
        isWorkflowRunning = true;
        currentWorkflowBlockIndex = 0;
        currentWorkflowCycle = 0;
        startWorkflowBtn.style.display = 'none';
        if (stopWorkflowBtn) stopWorkflowBtn.style.display = 'block';
        startNextWorkflowBlock();
    });
}

if (stopWorkflowBtn) {
    stopWorkflowBtn.addEventListener('click', () => {
        isWorkflowRunning = false;
        
        ipcRenderer.send('stop-timer', 'workflow-break');
        ipcRenderer.send('close-popup');
        ipcRenderer.send('close-fullscreen');
        ipcRenderer.send('close-pomo-timer');

        if (typeof isPomoRunning !== 'undefined' && isPomoRunning) stopPomoStyle();
        if (typeof isRepeatingRunning !== 'undefined' && isRepeatingRunning) stopRepeatingReminders();
        if (typeof isSprintRunning !== 'undefined' && isSprintRunning) stopSprintMode();
        
        resetWorkflowState();
        
        const workflowsHomeBtn = document.querySelector('.home-btn[data-mode="workflows"]');
        if (workflowsHomeBtn) workflowsHomeBtn.click();
    });
}

ipcRenderer.on('timer-complete-workflow-break', () => {
    playChime();
    ipcRenderer.send('close-popup');
    ipcRenderer.send('close-fullscreen');
    ipcRenderer.send('close-pomo-timer');
    
    if (isWorkflowRunning) {
        setTimeout(() => { if (typeof startNextWorkflowBlock === 'function') startNextWorkflowBlock(); }, 500);
    }
});

