import { store } from './storage.js';

export async function showOSNotification(type) {
    // Check if permission is granted
    if (Notification.permission !== "granted") {
        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return;
        } else {
            return;
        }
    }

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

    new Notification(title, { body: body, silent: true });
}
