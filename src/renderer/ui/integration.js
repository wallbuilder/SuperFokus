import { store } from '../utils/storage.js';
import { customAlert } from './modals.js';
import { ipcRenderer } from '../utils/ipc.js';

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

    // Create Test Notification Button dynamically next to Save button
    const testNotifBtn = document.createElement('button');
    testNotifBtn.className = 'action-btn';
    testNotifBtn.innerText = 'Test Notification';
    testNotifBtn.style.marginRight = '10px';
    testNotifBtn.style.backgroundColor = 'var(--input-bg)';
    testNotifBtn.style.color = 'var(--text-color)';
    testNotifBtn.style.border = '1px solid var(--border-color)';
    
    testNotifBtn.addEventListener('click', async () => {
        if ('Notification' in window && Notification.permission !== "granted") {
            await Notification.requestPermission();
        }
        
        if (Notification.permission === 'denied') {
            customAlert('macOS is blocking notifications! Please open System Settings -> Notifications, and enable them for the Terminal/Code Editor you are using to run this app.');
        } else {
            if (ipcRenderer) {
                ipcRenderer.send('show-os-notification', { 
                    title: 'SuperFokus Test', 
                    body: 'Notifications are working properly!' 
                });
            }
            
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('SuperFokus Test', { body: 'Notifications are working properly!', silent: false });
            }
        }
    });

    if (saveBtn && saveBtn.parentNode) {
        saveBtn.parentNode.insertBefore(testNotifBtn, saveBtn);
    }

    // Save functionality
    saveBtn.addEventListener('click', async () => {
        store.set('notif-start-enabled', startToggle.checked);
        store.set('notif-start-title', startTitle.value.trim() || 'Round Started');
        store.set('notif-start-body', startBody.value.trim() || 'Time to focus!');
        
        store.set('notif-end-enabled', endToggle.checked);
        store.set('notif-end-title', endTitle.value.trim() || 'Round Ended');
        store.set('notif-end-body', endBody.value.trim() || 'Great job! Take a break.');

        const originalText = saveBtn.innerText;
        const originalBackground = saveBtn.style.backgroundColor || '';
        const originalTransition = saveBtn.style.transition || '';

        saveBtn.style.transition = 'background-color 0.2s ease';
        saveBtn.innerText = 'Setting Saved';
        saveBtn.style.backgroundColor = '#e74c3c'; // SuperFokus red
        
        setTimeout(() => { 
            saveBtn.innerText = originalText; 
            saveBtn.style.backgroundColor = originalBackground;
            setTimeout(() => { saveBtn.style.transition = originalTransition; }, 200);
        }, 5000);
    });
}
