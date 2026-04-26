export const ipcRenderer = window.electronAPI;

export function normalizeHost(val) {
    return ipcRenderer.normalizeHost(val);
}
