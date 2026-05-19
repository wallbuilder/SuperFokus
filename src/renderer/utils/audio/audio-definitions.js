export let soundPacks = {
    classic: {
        notifs: [
            { id: 'classic-notif-1', label: 'Classic Notification 1' },
            { id: 'classic-notif-2', label: 'Classic Notification 2' },
            { id: 'classic-notif-3', label: 'Classic Notification 3' },
            { id: 'nature-notif-1', label: 'Chime (Legacy)' }
        ],
        ambient: [
            { id: 'classic-bg-1', label: 'Classic Ambient 1' },
            { id: 'classic-bg-2', label: 'Classic Ambient 2' },
            { id: 'classic-bg-3', label: 'Classic Ambient 3' }
        ]
    },
    nature: {
        notifs: [
            { id: 'nature-notif-1', label: 'Nature Notification 1' },
            { id: 'nature-notif-2', label: 'Nature Notification 2' },
            { id: 'nature-notif-3', label: 'Nature Notification 3' }
        ],
        ambient: [
            { id: 'nature-bg-1', label: 'Nature Ambient 1' },
            { id: 'nature-bg-2', label: 'Nature Ambient 2' },
            { id: 'nature-bg-3', label: 'Nature Ambient 3' }
        ]
    },
    mechanical: {
        notifs: [
            { id: 'mech-notif-1', label: 'Mech Notification 1' },
            { id: 'mech-notif-2', label: 'Mech Notification 2' },
            { id: 'mech-notif-3', label: 'Mech Notification 3' }
        ],
        ambient: [
            { id: 'mech-bg-1', label: 'Mech Ambient 1' },
            { id: 'mech-bg-2', label: 'Mech Ambient 2' },
            { id: 'mech-bg-3', label: 'Mech Ambient 3' }
        ]
    }
};

export let customSoundPacks = {};
export let customNotifs = [];
export let customAmbientData = null;

export function setCustomSoundPacks(val) { customSoundPacks = val; }
export function setCustomNotifs(val) { customNotifs = val; }
export function setCustomAmbientData(val) { customAmbientData = val; }
