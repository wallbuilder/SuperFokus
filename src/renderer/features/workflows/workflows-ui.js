import { store } from '../../utils/storage.js';
import { escapeHtml } from '../../utils/ui-helpers.js';
import { 
    workflowBlocks, 
    workflowPresets, 
    workflowPresetsSelect, 
    getAvailablePresetsForType, 
    getPresetDetails, 
    calculateBlockDuration 
} from './workflows-state.js';

export async function renderWorkflowStack() {
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

        const fragment = document.createDocumentFragment();

        // Fetch all necessary data in parallel
        const blockData = await Promise.all(workflowBlocks.map(async (block, index) => {
            const [dur, availablePresets, presetDetails] = await Promise.all([
                calculateBlockDuration(block),
                getAvailablePresetsForType(block.type),
                getPresetDetails(block.type, block.presetKey)
            ]);
            return { block, index, dur, availablePresets, presetDetails };
        }));

        let totalDuration = 0;

        for (const { block, index, dur, availablePresets, presetDetails } of blockData) {
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
                    presetSelectHtml += '<option value="' + escapeHtml(preset.key) + '" ' + selected + '>' + escapeHtml(preset.label) + '</option>';
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
                            <div class="block-duration-display" style="padding: 8px; text-align: center; font-weight: 600; color: var(--header-grad-1); background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);">${dur}m</div>
                        </div>
                    </div>
                `;
            } else {
                cyclesHtml = `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                        <label style="font-size: 0.75rem; color: var(--timer-subtext); text-transform: uppercase; font-weight: 500;">Total Duration</label>
                        <div class="block-duration-display" style="padding: 8px; text-align: center; font-weight: 600; color: var(--header-grad-1); background: var(--timer-bg); border-radius: 6px; border: 1px solid var(--border-color);">${dur}m</div>
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
                    <div style="font-size: 1.2rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--container-bg); color: var(--heading-color); border-radius: 6px;">${typeIcon}</div>
                    <div style="flex: 1; font-weight: 600; font-size: 0.95rem;">${block.type === 'pomo' ? 'Pomo Style' : block.type === 'sprint' ? 'Micro-Task Sprint' : block.type === 'repeating' ? 'Repeating Reminders' : 'Break Block'}</div>
                    <button class="remove-block-btn" data-index="${index}" style="margin: 0; width: auto; padding: 4px 8px; background: var(--container-bg); color: var(--heading-color); border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.8rem; transition: all 0.2s;">×</button>
                </div>

                <!-- Block Content -->
                <div style="padding: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${blockContentHtml}
                        ${cyclesHtml}
                    </div>
                </div>
            `;

            fragment.appendChild(blockEl);
        }

        window.workflowStack.appendChild(fragment);

        await updateTotalDuration();
    } catch (error) {
        console.error('[Startup] Error rendering workflow stack:', error);
    }
}

export async function updateTotalDuration() {
    let totalDuration = 0;
    for (const block of workflowBlocks) {
        totalDuration += await calculateBlockDuration(block);
    }
    
    let durationText = `${totalDuration}m`;
    if (totalDuration >= 60) {
        const hours = Math.floor(totalDuration / 60);
        const mins = totalDuration % 60;
        durationText = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (window.workflowTotalDurationEl) window.workflowTotalDurationEl.innerText = durationText;
}

export async function updateBlockDurationDisplay(index) {
    const block = workflowBlocks[index];
    if (!block) return;
    const dur = await calculateBlockDuration(block);
    const blockEls = window.workflowStack.querySelectorAll('.workflow-block');
    if (blockEls[index]) {
        const durationEl = blockEls[index].querySelector('.block-duration-display');
        if (durationEl) durationEl.innerText = `${dur}m`;
    }
}

export function setupWorkflowEventListeners() {
    try {
        if (!window.workflowPaletteItems || !window.workflowStack) return;

        window._draggedWorkflowItem = { type: null, index: null };

        function getPlaceholder() {
            let ph = document.getElementById('workflow-drop-placeholder');
            if (!ph) {
                ph = document.createElement('div');
                ph.id = 'workflow-drop-placeholder';
                ph.style.border = '2px dashed var(--header-grad-1)';
                ph.style.borderRadius = '12px';
                ph.style.margin = '5px 0';
                ph.style.background = 'var(--timer-bg)';
                ph.style.pointerEvents = 'none';
                ph.style.opacity = '0.5';
                ph.style.minHeight = '60px';
                ph.style.padding = '12px';
            }
            return ph;
        }

        window.workflowPaletteItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
                item.style.opacity = '0.5';
                window._draggedWorkflowItem = { type: item.dataset.type, index: null };
            });
            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
                window._draggedWorkflowItem = { type: null, index: null };
                const ph = document.getElementById('workflow-drop-placeholder');
                if (ph) ph.remove();
            });
        });

        window.workflowStack.addEventListener('dragover', (e) => {
            e.preventDefault(); // allow drop
            window.workflowStack.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';

            const ph = getPlaceholder();
            if (window._draggedWorkflowItem.type) {
                const labels = {
                    'pomo': 'Pomo Style',
                    'sprint': 'Micro-Task Sprint',
                    'repeating': 'Repeating Reminders',
                    'break': 'Break Block'
                };
                ph.innerHTML = `<div style="font-weight: 600; color: var(--heading-color);">${labels[window._draggedWorkflowItem.type] || 'Block'}</div><small style="color: var(--timer-subtext);">Drop to add</small>`;
            } else if (window._draggedWorkflowItem.index !== null) {
                ph.innerHTML = `<div style="font-weight: 600; color: var(--heading-color);">Move Block</div>`;
            }

            const children = Array.from(window.workflowStack.children).filter(c => c !== ph && c.classList.contains('workflow-block') && c.style.display !== 'none');
            let inserted = false;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const rect = child.getBoundingClientRect();
                const childMidY = rect.top + rect.height / 2;
                if (e.clientY < childMidY) {
                    window.workflowStack.insertBefore(ph, child);
                    inserted = true;
                    break;
                }
            }
            if (!inserted && children.length > 0) {
                window.workflowStack.appendChild(ph);
            } else if (children.length === 0) {
                window.workflowStack.appendChild(ph);
            }
        });

        window.workflowStack.addEventListener('dragleave', (e) => {
            if (e.target === window.workflowStack) {
                window.workflowStack.style.backgroundColor = '';
            }
        });

        window.workflowStack.addEventListener('drop', async (e) => {
            e.preventDefault();
            window.workflowStack.style.backgroundColor = '';
            const ph = document.getElementById('workflow-drop-placeholder');
            
            // Calculate index where the placeholder is
            let targetIndex = workflowBlocks.length;
            if (ph && ph.parentNode === window.workflowStack) {
                const children = Array.from(window.workflowStack.children).filter(c => c.classList.contains('workflow-block') || c.id === 'workflow-drop-placeholder');
                targetIndex = children.indexOf(ph);
                if (targetIndex < 0) targetIndex = workflowBlocks.length;
                ph.remove();
            }

            const data = e.dataTransfer.getData('text/plain');
            
            if (data.startsWith('reorder:')) {
                const fromIndex = parseInt(data.split(':')[1], 10);
                if (!isNaN(fromIndex)) {
                    const [movedBlock] = workflowBlocks.splice(fromIndex, 1);
                    // Adjust targetIndex if fromIndex was before targetIndex, because splice shifted everything left
                    if (fromIndex < targetIndex) {
                        targetIndex--;
                    }
                    workflowBlocks.splice(targetIndex, 0, movedBlock);
                    await renderWorkflowStack();
                }
                window._draggedWorkflowItem = { type: null, index: null };
                return;
            }

            const type = data;
            if (type && ['pomo', 'sprint', 'repeating', 'break'].includes(type)) {
                // Insert at target index
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
                    const availablePresets = await getAvailablePresetsForType(type);
                    const defaultPresetKey = availablePresets.length > 0 ? availablePresets[0].key : 'custom';
                
                    block = {
                        id: 'block-' + Date.now(),
                        type: type,
                        name: type === 'pomo' ? 'Pomo Session' : (type === 'sprint' ? 'Micro-Sprint' : 'Repeating Reminder'),
                        cycles: 1,
                        presetKey: defaultPresetKey
                    };
                }
                workflowBlocks.splice(targetIndex, 0, block);
                await renderWorkflowStack();

                // If modifying a preset, switch back to custom
                if (workflowPresetsSelect && workflowPresetsSelect.value !== 'custom') {
                    workflowPresetsSelect.value = 'custom';
                    updateWorkflowCurrentPresetDisplay();
                }
            }
            window._draggedWorkflowItem = { type: null, index: null };
        });

        // Event delegation for workflow stack interactions
        window.workflowStack.addEventListener('click', async (e) => {
            if (e.target.classList.contains('remove-block-btn')) {
                const index = parseInt(e.target.dataset.index, 10);
                if (!isNaN(index)) {
                    workflowBlocks.splice(index, 1);
                    await renderWorkflowStack();
                }
            }
        });

        window.workflowStack.addEventListener('change', async (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            if (isNaN(index)) return;

            if (e.target.classList.contains('block-preset-input')) {
                workflowBlocks[index].presetKey = e.target.value;
                await renderWorkflowStack(); // Re-render needed for preset details update
            } else if (e.target.classList.contains('block-cycles-input')) {
                workflowBlocks[index].cycles = Math.max(1, parseInt(e.target.value, 10) || 1);
                updateBlockDurationDisplay(index);
                await updateTotalDuration();
            } else if (e.target.classList.contains('block-break-duration')) {
                workflowBlocks[index].duration = Math.max(1, parseInt(e.target.value, 10) || 1);
                updateBlockDurationDisplay(index);
                await updateTotalDuration();
            } else if (e.target.classList.contains('block-break-screen')) {
                workflowBlocks[index].blocksScreen = e.target.checked;
            }
        });

    } catch (error) {
        console.error('[Startup] Error setting up workflow event listeners:', error);
    }
}

export function updateWorkflowCurrentPresetDisplay() {
    const presetDisplay = document.getElementById('workflow-current-preset');
    if (!presetDisplay) return;
    
    const val = workflowPresetsSelect.value;
    if (val === 'custom') {
        presetDisplay.innerText = 'Custom';
    } else if (val.startsWith('custom-preset-')) {
        const key = val.replace('custom-preset-', '');
        presetDisplay.innerText = escapeHtml(key);
    } else {
        presetDisplay.innerText = 'Custom';
    }
}
