import { store } from '../../utils/storage.js';
import { escapeHtml } from '../../utils/ui-helpers.js';
import { timerState } from '../TimerService.js';

// Centralized Workflow State
export const workflowState = {
    isWorkflowRunning: false,
    currentBlockIndex: 0,
    currentCycle: 0
};

export let workflowBlocks = [];
export let workflowPresets = {};
export const workflowPresetsSelect = document.getElementById('workflow-presets');

export function setWorkflowBlocks(blocks) {
    workflowBlocks = blocks;
}

export function setWorkflowPresets(presets) {
    workflowPresets = presets;
}

// Helper: Get available presets for a given type
export async function getAvailablePresetsForType(type) {
    const presets = [];
    if (type === 'pomo') {
        const customPresets = await store.get('customPomoPresets', {});
        presets.push({ key: 'deep-work', label: 'Deep Work - 50/10' });
        presets.push({ key: 'quick-study', label: 'Quick Study - 25/5' });
        presets.push({ key: 'homework', label: 'Homework - 45/15' });
        Object.keys(customPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    } else if (type === 'sprint') {
        const sprintPresets = await store.get('sprintPresets', {});
        presets.push({ key: 'custom', label: 'Custom' });
        Object.keys(sprintPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    } else if (type === 'repeating') {
        const repeatingPresets = await store.get('repeatingPresets', {});
        presets.push({ key: 'custom', label: 'Custom' });
        presets.push({ key: 'concentration', label: 'Concentration - 30s' });
        presets.push({ key: 'high-intensity', label: 'High-Intensity - 20s' });
        presets.push({ key: 'quick-work', label: 'Quick Work - 1m' });
        Object.keys(repeatingPresets).forEach(key => {
            presets.push({ key: `custom-preset-${key}`, label: `Custom: ${key}` });
        });
    }
    return presets;
}

// Helper: Get preset details based on type and presetKey
export async function getPresetDetails(type, presetKey) {
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
        const customPresets = await store.get('customPomoPresets', {});
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
        } else if (presetKey && presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (customPresets[key]) {
                seq = customPresets[key].sequence || customPresets[key];
                details.displayName = `Custom: ${escapeHtml(key)}`;
            }
        }
        if (seq) {
            details.sequence = seq;
            const totalMins = seq.reduce((acc, p) => acc + (p.unit === 'secs' ? p.duration/60 : p.duration), 0);
            details.duration = Math.round(totalMins * 10) / 10;
        }
    } else if (type === 'sprint') {
        const sprintPresets = await store.get('sprintPresets', {});
        if (presetKey === 'custom') {
            details.displayName = 'Custom Sprint';
            details.duration = timerState.sprint.sprintDurationSeconds / 60 || 15;
        } else if (presetKey && presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (sprintPresets[key]) {
                details.displayName = `Custom: ${escapeHtml(key)}`;
                const val = sprintPresets[key].durationVal;
                details.duration = val === 'custom' ? (sprintPresets[key].customMins || 20) : (parseInt(val, 10) || 15);
            }
        }
    } else if (type === 'repeating') {
        const repeatingPresets = await store.get('repeatingPresets', {});
        if (presetKey === 'custom') {
            details.displayName = 'Custom Reminders';
            const total = timerState.repeating.currentRepeatingTotalSeconds;
            const rounds = timerState.repeating.currentRounds === Infinity ? 1 : timerState.repeating.currentRounds;
            details.interval = { mins: Math.floor(total / 60), secs: total % 60 };
            details.rounds = rounds;
            details.duration = Math.round((total * rounds) / 60);
        } else if (presetKey === 'concentration') {
            details.displayName = 'Concentration - 30s';
            details.interval = { mins: 0, secs: 30 };
            details.rounds = 1;
            details.duration = 0.5;
        } else if (presetKey === 'high-intensity') {
            details.displayName = 'High-Intensity - 20s';
            details.interval = { mins: 0, secs: 20 };
            details.rounds = 1;
            details.duration = 0.33;
        } else if (presetKey === 'quick-work') {
            details.displayName = 'Quick Work - 1m';
            details.interval = { mins: 1, secs: 0 };
            details.rounds = 1;
            details.duration = 1;
        } else if (presetKey && presetKey.startsWith('custom-preset-')) {
            const key = presetKey.replace('custom-preset-', '');
            if (repeatingPresets[key]) {
                details.displayName = `Custom: ${escapeHtml(key)}`;
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

export async function calculateBlockDuration(block) {
    let baseMins = 0;
    
    if (block.type === 'break') {
        baseMins = block.duration || 5;
        return Math.max(1, Math.round(baseMins * block.cycles));
    }

    // If block has presetKey, use it for calculation
    if (block.presetKey) {
        const details = await getPresetDetails(block.type, block.presetKey);
        baseMins = details.duration || 0;
    } else {
        // Fallback to unified timerState for blocks without presetKey
        if (block.type === 'pomo') {
            const seq = timerState.pomo.pomoSequence;
            baseMins = seq.reduce((acc, p) => acc + (p.unit === 'secs' ? p.duration/60 : p.duration), 0);
        } else if (block.type === 'sprint') {
            baseMins = timerState.sprint.sprintDurationSeconds / 60 || 5;
        } else if (block.type === 'repeating') {
            baseMins = timerState.repeating.currentRepeatingTotalSeconds / 60 || 1;
        }
    }
    
    return Math.max(1, Math.round(baseMins * block.cycles));
}
