# Handoff Report: SFX Customizability Analysis (R1)

## 1. Observation

I directly observed the following components, patterns, and logic in the codebase:

### Sounds Settings UI Component
- **File**: `index.html` (lines 1156–1261)
  - Contains `#sound-pack-selector`, `#notification-sound-selector`, and `#ambient-noise-selector`.
  - Individual chime upload UI elements:
    ```html
    <button class="action-btn" id="upload-chime-btn">Upload Custom Notification</button>
    <div id="custom-notifs-container"></div>
    ```
- **File**: `src/renderer/utils/audio/audio-ui.js` (lines 156–160):
  - Hardcoded limit of 3 for chimes checks:
    ```javascript
    if (customNotifs.length >= 3) {
        uploadBtn.style.display = 'none';
    } else {
        uploadBtn.style.display = 'block';
    }
    ```

### Storing & Fetching
- **File**: `src/renderer/utils/audio.js` (lines 35–38):
  - Fetches list of custom notifications on initialization:
    ```javascript
    const savedCustomNotifs = await store.get('customNotifsData', []);
    if (Array.isArray(savedCustomNotifs)) {
        setCustomNotifs(savedCustomNotifs);
    }
    ```

### File Upload & Disk Saving
- **File**: `src/renderer/utils/audio.js` (lines 98–117):
  - Direct file reading as DataURL:
    ```javascript
    chimeFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                customNotifs.push(dataUrl);
                store.set('customNotifsData', customNotifs);
                ...
    ```
- **File**: `src/renderer/utils/audio/audio-storage.js` (lines 4–9):
  - The correct file-saving helper `loadFileAsDataURL(file)`:
    ```javascript
    export async function loadFileAsDataURL(file) {
        if (window.electronAPI) {
            const arrayBuffer = await file.arrayBuffer();
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const filePath = await window.electronAPI.invoke('save-audio-file', fileName, arrayBuffer);
            return filePath;
        }
        ...
    ```
- **File**: `src/main/services/IpcMainHandlers.js` (lines 134–142):
  - Main process handler for `save-audio-file`:
    ```javascript
    ipcMain.handle('save-audio-file', async (event, fileName, arrayBuffer) => {
        if (!windowManager.isOriginSafe(event)) return null;
        const safeFileName = path.basename(fileName);
        const soundsDir = path.join(app.getPath('userData'), 'sounds');
        await require('fs').promises.mkdir(soundsDir, { recursive: true });
        const filePath = path.join(soundsDir, safeFileName);
        await require('fs').promises.writeFile(filePath, Buffer.from(arrayBuffer));
        return `file://${filePath.replace(/\\/g, '/')}`;
    });
    ```

### Deletion and Disk Cleanup
- **File**: `src/renderer/utils/audio/audio-ui.js` (lines 142–147):
  - Chime delete action splicing without IPC delete invocation:
    ```javascript
    delBtn.onclick = () => {
        customNotifs.splice(idx, 1);
        store.set('customNotifsData', customNotifs);
        updateCustomNotifsUI();
        updateSoundSelectors();
    };
    ```
- **File**: `src/main/services/IpcMainHandlers.js` (lines 144–154):
  - Main process IPC channel for deleting files:
    ```javascript
    ipcMain.handle('delete-audio-file', async (event, fileUrl) => {
        if (!windowManager.isOriginSafe(event)) return;
        if (fileUrl.startsWith('file://')) {
            const filePath = decodeURI(fileUrl.replace('file://', ''));
            if (filePath.includes('sounds')) {
                try {
                    await require('fs').promises.unlink(filePath);
                } catch (e) {}
            }
        }
    });
    ```

---

## 2. Logic Chain

1. **Limit Gaps**: The project demands up to 10 custom notification sounds (R1). Observations in `audio.js` and `audio-ui.js` reveal a hardcoded limit of `3`. Thus, we must raise these checks to `10`.
2. **Persistence Gaps**: Currently, custom chimes are read as base64 DataURLs in `audio.js` and stored directly into `electron-store` settings (`customNotifsData`). This violates local file management protocols, leading to bloated store files.
3. **Saving to Disk**: By replacing the raw `FileReader` in `chimeFileInput`'s event listener with `await loadFileAsDataURL(file)`, the renderer will automatically route files through the main process IPC handler `save-audio-file` to save them physically to disk as `file://` URLs, solving the persistence gap.
4. **Deletion Gaps**: The individual chime deletion handler (`delBtn.onclick` in `audio-ui.js`) only splices the array and updates `electron-store`, leaving the physical files as zombies under `sounds/`. Adding `await window.electronAPI.invoke('delete-audio-file', soundSrc)` prior to splicing completes the required cleanup flow.

---

## 3. Caveats

- **Fallback Path**: In a non-Electron browser environment, `window.electronAPI` is undefined. The helper `loadFileAsDataURL` falls back to base64 DataURLs. The deletion flow should gracefully check for `window.electronAPI` to avoid throwing errors in fallback environments.
- **Preload Bindings**: Preload scripts in `src/main/preload.js` must allow `save-audio-file` and `delete-audio-file` channels, which is already confirmed via grep search.

---

## 4. Conclusion

- We need to:
  1. Increase the chime limit checks from 3 to 10 in `src/renderer/utils/audio.js` and `src/renderer/utils/audio/audio-ui.js`.
  2. Implement local file upload inside `chimeFileInput`'s handler in `src/renderer/utils/audio.js` by using the existing helper `loadFileAsDataURL`.
  3. Implement physical disk file deletion in the delete button handler inside `updateCustomNotifsUI` in `src/renderer/utils/audio/audio-ui.js` by invoking the `delete-audio-file` IPC handler.

---

## 5. Verification Method

- **Automated Tests**:
  - Run the test suite: `npm test` or `npx playwright test tests/e2e/sound-settings.spec.js`.
  - Create a new E2E test in `tests/e2e/sound-settings.spec.js` that tests uploading 10 chime sounds, verifies the upload button hides, deletes them all, and verifies the button shows again.
- **Manual Verification**:
  - Verify that custom notification files uploaded under Electron are created in the folder `%APPDATA%/SuperFokus/sounds/` with a naming scheme matching `<timestamp>-<filename>`.
  - Verify that deleting the sound from the list deletes the matching physical file in `%APPDATA%/SuperFokus/sounds/`.
