# SFX Customizability Analysis and Design Recommendation

This analysis covers the implementation details, current gaps, and proposed design for **Requirement R1 (SFX Customizability Menu: Multiple Savable SFX & Delete Option)** as specified in `PROJECT.md` and `ORIGINAL_REQUEST.md`.

---

## 1. The Sounds Settings UI Component

The SFX configuration and management UI is located in:
- **File**: `index.html` (under the `<!-- Sounds Tab -->` container, `div#tab-sounds`, lines 1156–1261).
- **Core UI Structure**:
  - **Dropdown Selectors**:
    - `#sound-pack-selector`: Dropdown for selecting the active sound library pack (`classic`, `nature`, `mechanical`, or any saved custom soundpacks).
    - `#notification-sound-selector`: Dropdown listing notification sounds available under the active pack, plus any uploaded individual custom notification sounds.
    - `#ambient-noise-selector`: Dropdown listing ambient sounds under the active pack, plus custom ambient sound.
  - **Chime (Notification SFX) Upload & Management**:
    - `#chime-file-input`: Hidden `<input type="file" accept="audio/*">` triggered by the upload button.
    - `#upload-chime-btn`: Button to prompt the user to upload a custom notification sound.
    - `#custom-notifs-container`: A container (`div`) dynamically populated with list items representing the uploaded custom sounds, each displaying a "Delete" button.
  - **Dynamic Renderer Scripts**:
    - `src/renderer/utils/audio/audio-ui.js`: Handles rendering list items in `#custom-notifs-container`, updates selector options, and manages hiding/showing `#upload-chime-btn` when limit is reached.
    - `src/renderer/utils/audio.js`: Binds DOM event listeners to the upload file inputs and handles file changes.

---

## 2. Storing and Fetching Custom SFX

Custom notification settings are persisted locally via `electron-store`:
- **State Object / Key**: `'customNotifsData'` in `electron-store`.
- **Memory Representation**: `customNotifs` array in `src/renderer/utils/audio/audio-definitions.js` (initially `[]`).
- **Initialization/Fetch Flow**:
  - In `src/renderer/utils/audio.js` -> `initAudio()`:
    ```javascript
    const savedCustomNotifs = await store.get('customNotifsData', []);
    if (Array.isArray(savedCustomNotifs)) {
        setCustomNotifs(savedCustomNotifs);
    }
    ```
  - During renderer startup, these values are loaded and rendered in the settings UI drop-downs.

---

## 3. Uploading and Saving Custom SFX to Disk

There is a discrepancy in how files are uploaded between custom soundpacks and individual custom chimes.

### Custom Soundpacks (Correct Flow)
- Uses `loadFileAsDataURL(file)` from `src/renderer/utils/audio/audio-storage.js`.
- If `window.electronAPI` is present, it reads the file's ArrayBuffer and calls the IPC handler `'save-audio-file'`.
- The main-process IPC handler (in `src/main/services/IpcMainHandlers.js`) writes the audio buffer to the user's data directory:
  - Path: `app.getPath('userData')/sounds/<timestamp>-<safeFileName>`
  - Returns: `file://` URL pointing to the physical file.

### Individual Custom Chimes (Current Bug/Gap)
- In `src/renderer/utils/audio.js` (lines 98–117):
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
- **Issue**: Individual custom chimes bypass `loadFileAsDataURL` and write the raw, massive base64 DataURL directly into `electron-store` settings rather than saving a physical file to disk.

---

## 4. Deletion and Disk Cleanup Flow

### Custom Soundpacks (Correct Flow)
- In `src/renderer/utils/audio/audio-storage.js` -> `deleteCustomSoundPack()`:
  - Iterates over all notification and ambient URLs starting with `file://`.
  - Invokes `window.electronAPI.invoke('delete-audio-file', url)`.
  - The main-process IPC handler in `IpcMainHandlers.js` parses the file URL, decodes the URI, verifies it contains the `'sounds'` directory (as a security constraint), and calls `fs.promises.unlink` to delete the physical file from disk.

### Individual Custom Chimes (Current Bug/Gap)
- In `src/renderer/utils/audio/audio-ui.js` -> `updateCustomNotifsUI()` (lines 142–147):
  ```javascript
  delBtn.onclick = () => {
      customNotifs.splice(idx, 1);
      store.set('customNotifsData', customNotifs);
      updateCustomNotifsUI();
      updateSoundSelectors();
  };
  ```
- **Issue**: The delete handler removes the chime from the `customNotifs` memory array and updates the `electron-store` settings, but it does **not** call the IPC delete-audio-file channel. If it were saved as a physical file, it would remain as a zombie file on disk.

---

## Design Recommendation & Proposed Changes

To fulfill **Requirement R1**, the following changes should be implemented:

### 1. Increase SFX Limit to 10
Modify the hardcoded limit of `3` to `10` in:
- `src/renderer/utils/audio.js` (line 93):
  ```javascript
  // Change:
  if (customNotifs.length < 3)
  // To:
  if (customNotifs.length < 10)
  ```
- `src/renderer/utils/audio/audio-ui.js` (line 156):
  ```javascript
  // Change:
  if (customNotifs.length >= 3)
  // To:
  if (customNotifs.length >= 10)
  ```

### 2. Save Custom SFX Files to Disk
Update the upload change listener in `src/renderer/utils/audio.js` to use `loadFileAsDataURL` instead of raw `FileReader.readAsDataURL`:
```javascript
chimeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            const dataUrl = await loadFileAsDataURL(file);
            customNotifs.push(dataUrl);
            store.set('customNotifsData', customNotifs);
            updateCustomNotifsUI();
            updateSoundSelectors();
            
            const notifSelector = document.getElementById('notification-sound-selector');
            if (notifSelector) {
                notifSelector.value = `custom-notif-${customNotifs.length - 1}`;
            }
        } catch (err) {
            console.error('Error uploading custom notification sound:', err);
        }
    }
    e.target.value = '';
});
```

### 3. Clean Up Disk Files on Deletion
Update the delete button click listener in `src/renderer/utils/audio/audio-ui.js` to invoke the delete IPC handler:
```javascript
delBtn.onclick = async () => {
    const soundSrc = customNotifs[idx];
    if (window.electronAPI && soundSrc && soundSrc.startsWith('file://')) {
        try {
            await window.electronAPI.invoke('delete-audio-file', soundSrc);
        } catch (err) {
            console.error('Failed to delete custom audio file from disk:', err);
        }
    }
    customNotifs.splice(idx, 1);
    store.set('customNotifsData', customNotifs);
    updateCustomNotifsUI();
    updateSoundSelectors();
};
```

---

## Verification Plan

### Manual Verification
1. Open Customization -> Sounds.
2. Upload custom notifications up to 10 files. Verify that the upload button disappears on the 10th file.
3. Delete individual custom notifications. Verify they disappear from the selector, options update, and check that files under `%APPDATA%/SuperFokus/sounds/` are physically deleted.

### Automated Test Cases (Playwright)
Modify `tests/e2e/sound-settings.spec.js` to include:
- A loop test that uploads 10 fake chimes and asserts that the `#upload-chime-btn` becomes hidden (`display: none` or not visible).
- Deletion of all 10 chimes and verification that the `#upload-chime-btn` becomes visible again.
