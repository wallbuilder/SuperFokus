import { pomoState, setPresetAndStart as pomoSetPresetAndStart, stopPomoStyle } from './pomo-timer.js';
import { sprintState, setPresetAndStart as sprintSetPresetAndStart, stopSprintMode } from './micro-sprint.js';
import { repeatingState, setPresetAndStart as repeatingSetPresetAndStart, stopRepeatingReminders } from './repeating.js';
import { sharedState } from '../utils/state.js';

export const timerState = {
    pomo: pomoState,
    sprint: sprintState,
    repeating: repeatingState
};

export function setPresetAndStart(type, presetKey) {
    if (type === 'pomo') {
        pomoSetPresetAndStart(presetKey);
    } else if (type === 'sprint') {
        sprintSetPresetAndStart(presetKey);
    } else if (type === 'repeating') {
        repeatingSetPresetAndStart(presetKey);
    }
}

export function stopAllActive() {
    if (typeof stopPomoStyle === 'function') stopPomoStyle();
    if (typeof stopSprintMode === 'function') stopSprintMode();
    if (typeof stopRepeatingReminders === 'function') stopRepeatingReminders();
    sharedState.isWorkflowRunning = false;
}
