import { ipcRenderer } from './ipc.js';

export const store = {
    get: async (key, defaultValue) => {
        return await ipcRenderer.store.get(key, defaultValue);
    },
    set: (key, value) => {
        ipcRenderer.store.set(key, value);
    }
};

export async function migrateStore() {
    const isMigrated = await store.get('migratedToElectronStore', false);
    if (!isMigrated) {
        const keysToMigrate = [
            'darkMode', 'showHeaderDarkModeToggle', 'totalFocusTime', 'completedRounds', 
            'dailyStats', 'sessionHistory', 'customChimeData', 'customPomoPresets', 
            'repeatingPresets', 'sprintPresets', 'workflowPresets'
        ];
        for (const key of keysToMigrate) {
            const val = localStorage.getItem(key);
            if (val !== null) {
                try {
                    store.set(key, JSON.parse(val));
                } catch (e) {
                    console.error(`Migration failed for key: ${key}`, e);
                }
            }
        }
        store.set('migratedToElectronStore', true);
        console.log('[Migration] Settings moved to electron-store.');
    }
}
