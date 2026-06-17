import { ipcRenderer } from './ipc.js';

export const store = {
    get: async (key, defaultValue) => {
        return await ipcRenderer.store.get(key, defaultValue);
    },
    set: (key, value) => {
        ipcRenderer.store.set(key, value);
    },
    setMultiple: (dataObj) => {
        ipcRenderer.store.setMultiple(dataObj);
    },
    delete: (key) => {
        ipcRenderer.store.delete(key);
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
        const dataToMigrate = {};
        for (const key of keysToMigrate) {
            const val = localStorage.getItem(key);
            if (val !== null) {
                try {
                    dataToMigrate[key] = JSON.parse(val);
                } catch (e) {
                    console.error(`Migration failed for key: ${key}`, e);
                }
            }
        }
        
        if (Object.keys(dataToMigrate).length > 0) {
            store.setMultiple(dataToMigrate);
            for (const key of Object.keys(dataToMigrate)) {
                localStorage.removeItem(key);
            }
        }
        
        store.set('migratedToElectronStore', true);
        console.log('[Migration] Settings moved to electron-store and localStorage cleared.');
    }
}
