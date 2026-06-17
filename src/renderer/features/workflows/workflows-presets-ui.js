import { store } from '../../utils/storage.js';
import { customAlert } from '../../ui/modals.js';
import { 
    workflowBlocks, 
    workflowPresets, 
    workflowPresetsSelect, 
    setWorkflowPresets 
} from './workflows-state.js';
import { renderWorkflowStack, updateWorkflowCurrentPresetDisplay } from './workflows-ui.js';

export function setupWorkflowPresetsEventListeners() {
    try {
        const deleteWorkflowPresetBtn = document.getElementById('delete-workflow-preset-btn');
        const saveWorkflowPresetBtn = document.getElementById('save-workflow-preset-btn');
        const confirmSaveWorkflowPresetBtn = document.getElementById('confirm-save-workflow-preset-btn');
        const cancelSaveWorkflowPresetBtn = document.getElementById('cancel-save-workflow-preset-btn');
        const saveWorkflowPresetContainer = document.getElementById('save-workflow-preset-container');
        const workflowPresetNameInput = document.getElementById('workflow-preset-name-input');
        
        if (workflowPresetsSelect) {
            workflowPresetsSelect.addEventListener('change', async (e) => {
                const val = e.target.value;
                if (deleteWorkflowPresetBtn) {
                    deleteWorkflowPresetBtn.style.display = val.startsWith('custom-preset-') ? 'block' : 'none';
                }
                if (val.startsWith('custom-preset-')) {
                    const key = val.replace('custom-preset-', '');
                    if (workflowPresets[key]) {
                        // Using mutation of workflowBlocks array which is shared
                        workflowBlocks.length = 0;
                        const newBlocks = JSON.parse(JSON.stringify(workflowPresets[key]));
                        newBlocks.forEach(b => workflowBlocks.push(b));
                        await renderWorkflowStack();
                    }
                }
                updateWorkflowCurrentPresetDisplay();
            });
        }

        if (deleteWorkflowPresetBtn) {
            deleteWorkflowPresetBtn.addEventListener('click', () => {
                const val = workflowPresetsSelect.value;
                if (val.startsWith('custom-preset-')) {
                    const key = val.replace('custom-preset-', '');
                    if (confirm(`Are you sure you want to delete preset "${key}"?`)) {
                        delete workflowPresets[key];
                        store.set('workflowPresets', workflowPresets);
                        updateWorkflowPresetOptions();
                        workflowPresetsSelect.value = 'custom';
                        workflowPresetsSelect.dispatchEvent(new Event('change'));
                    }
                }
            });
        }

        if (saveWorkflowPresetBtn) {
            saveWorkflowPresetBtn.addEventListener('click', () => {
                if (workflowBlocks.length === 0) {
                    customAlert('Add blocks to the stack before saving as preset.');
                    return;
                }
                if (saveWorkflowPresetContainer) saveWorkflowPresetContainer.style.display = 'flex';
                if (workflowPresetNameInput) workflowPresetNameInput.focus();
            });
        }

        if (confirmSaveWorkflowPresetBtn) {
            confirmSaveWorkflowPresetBtn.addEventListener('click', () => {
                const name = workflowPresetNameInput.value;
                if (name && name.trim()) {
                    workflowPresets[name.trim()] = JSON.parse(JSON.stringify(workflowBlocks));
                    store.set('workflowPresets', workflowPresets);
                    updateWorkflowPresetOptions();
                    workflowPresetsSelect.value = `custom-preset-${name.trim()}`;
                    workflowPresetNameInput.value = '';
                    if (saveWorkflowPresetContainer) saveWorkflowPresetContainer.style.display = 'none';
                    updateWorkflowCurrentPresetDisplay();
                }
            });
        }

        if (cancelSaveWorkflowPresetBtn) {
            cancelSaveWorkflowPresetBtn.addEventListener('click', () => {
                if (workflowPresetNameInput) workflowPresetNameInput.value = '';
                if (saveWorkflowPresetContainer) saveWorkflowPresetContainer.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('[Startup] Error setting up workflow presets event listeners:', error);
    }
}

export function updateWorkflowPresetOptions() {
    if (!workflowPresetsSelect) return;
    Array.from(workflowPresetsSelect.options).forEach(opt => {
        if (opt.value.startsWith('custom-preset-')) {
            workflowPresetsSelect.removeChild(opt);
        }
    });
    Object.keys(workflowPresets).forEach(key => {
        const option = document.createElement('option');
        option.value = `custom-preset-${key}`;
        option.textContent = `Custom: ${key}`; // escapeHtml not strictly needed for textContent
        workflowPresetsSelect.appendChild(option);
    });
}
