import { ipcRenderer } from './ipc.js';

export const store = {
    get: (key, defaultValue) => {
        return ipcRenderer.store.get(key, defaultValue);
    },
    set: (key, value) => {
        ipcRenderer.store.set(key, value);
    }
};

export function migrateStore() {
    if (!store.get('migratedToElectronStore', false)) {
        const keysToMigrate = [
            'darkMode', 'showHeaderDarkModeToggle', 'totalFocusTime', 'completedRounds', 
            'dailyStats', 'sessionHistory', 'customChimeData', 'customPomoPresets', 
            'repeatingPresets', 'sprintPresets', 'workflowPresets'
        ];
        keysToMigrate.forEach(key => {
            const val = localStorage.getItem(key);
            if (val !== null) {
                try {
                    store.set(key, JSON.parse(val));
                } catch (e) {
                    console.error(`Migration failed for key: ${key}`, e);
                }
            }
        });
        store.set('migratedToElectronStore', true);
        console.log('[Migration] Settings moved to electron-store.');
    }
}
