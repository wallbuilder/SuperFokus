import { store } from './storage.js';
import { ipcRenderer } from './ipc.js';

export async function triggerHTML5Notification(title, body) {
    // Attempt via main process native module
    if (ipcRenderer) {
        ipcRenderer.send('show-os-notification', { title, body });
        return; // Prioritize OS-level native notifications
    }

    // Fallback to renderer HTML5 API if IPC is unavailable
    if (!('Notification' in window)) {
        console.warn('This environment does not support desktop notifications');
        return;
    }

    if (Notification.permission === 'granted') {
        new Notification(title, { body, silent: false });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification(title, { body, silent: false });
        }
    }
}

export async function showOSNotification(type) {
    const startEnabled = await store.get('notif-start-enabled', false);
    const endEnabled = await store.get('notif-end-enabled', false);
    
    let title = '';
    let body = '';

    if (type === 'start' && startEnabled) {
        title = await store.get('notif-start-title', 'Round Started');
        body = await store.get('notif-start-body', 'Time to focus!');
    } else if (type === 'end' && endEnabled) {
        title = await store.get('notif-end-title', 'Round Ended');
        body = await store.get('notif-end-body', 'Great job! Take a break.');
    } else {
        return; // Notifications disabled for this type
    }

    await triggerHTML5Notification(title, body);
}
