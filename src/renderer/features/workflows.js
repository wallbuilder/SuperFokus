import { store } from '../utils/storage.js';
import { workflowState, setWorkflowPresets } from './workflows/workflows-state.js';
import { setupWorkflowEventListeners, renderWorkflowStack } from './workflows/workflows-ui.js';
import { setupWorkflowPresetsEventListeners, updateWorkflowPresetOptions } from './workflows/workflows-presets-ui.js';
import { startNextWorkflowBlock, setupEngineListeners } from './workflows/workflows-engine.js';

/**
 * Facade for Workflows Feature
 * Re-exports the public API to maintain backward compatibility.
 */

export async function initWorkflows() {
    const presets = await store.get('workflowPresets', {});
    setWorkflowPresets(presets);
    updateWorkflowPresetOptions();
    // updateWorkflowCurrentPresetDisplay is called inside setupWorkflowPresetsEventListeners if needed
    // or we can call it here if we export it
    await renderWorkflowStack();
    setupEngineListeners(); // Initialize engine's IPC and click listeners
}

export { 
    workflowState, 
    setupWorkflowEventListeners, 
    setupWorkflowPresetsEventListeners, 
    startNextWorkflowBlock 
};
