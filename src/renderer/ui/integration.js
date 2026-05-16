import { store } from '../utils/storage.js';
import { customAlert } from './modals.js';

export async function setupIntegrationUI() {
    const startToggle = document.getElementById('notif-start-toggle');
    const startSettings = document.getElementById('notif-start-settings');
    const startTitle = document.getElementById('notif-start-title');
    const startBody = document.getElementById('notif-start-body');

    const endToggle = document.getElementById('notif-end-toggle');
    const endSettings = document.getElementById('notif-end-settings');
    const endTitle = document.getElementById('notif-end-title');
    const endBody = document.getElementById('notif-end-body');

    const saveBtn = document.getElementById('save-integration-settings-btn');

    // Load initial state
    const startEnabled = await store.get('notif-start-enabled', false);
    startToggle.checked = startEnabled;
    startSettings.style.display = startEnabled ? 'block' : 'none';
    startTitle.value = await store.get('notif-start-title', 'Round Started');
    startBody.value = await store.get('notif-start-body', 'Time to focus!');

    const endEnabled = await store.get('notif-end-enabled', false);
    endToggle.checked = endEnabled;
    endSettings.style.display = endEnabled ? 'block' : 'none';
    endTitle.value = await store.get('notif-end-title', 'Round Ended');
    endBody.value = await store.get('notif-end-body', 'Great job! Take a break.');

    // Toggle event listeners
    startToggle.addEventListener('change', async (e) => {
        startSettings.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked && Notification.permission !== "granted") {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
                startToggle.checked = false;
                startSettings.style.display = 'none';
                customAlert("Notification permission denied. Please allow notifications in your OS/browser settings.");
            }
        }
    });

    endToggle.addEventListener('change', async (e) => {
        endSettings.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked && Notification.permission !== "granted") {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
                endToggle.checked = false;
                endSettings.style.display = 'none';
                customAlert("Notification permission denied. Please allow notifications in your OS/browser settings.");
            }
        }
    });

    // Save functionality
    saveBtn.addEventListener('click', () => {
        store.set('notif-start-enabled', startToggle.checked);
        store.set('notif-start-title', startTitle.value.trim() || 'Round Started');
        store.set('notif-start-body', startBody.value.trim() || 'Time to focus!');
        
        store.set('notif-end-enabled', endToggle.checked);
        store.set('notif-end-title', endTitle.value.trim() || 'Round Ended');
        store.set('notif-end-body', endBody.value.trim() || 'Great job! Take a break.');

        customAlert('Integration settings saved!');
    });
}
