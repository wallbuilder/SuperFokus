# Outstanding Tasks for SuperFokus v1.0.0

This document outlines the remaining critical tasks to complete and verify the SuperFokus application, based on our recent discussions and the `mfokus1.0.0.md` specification. The goal is to ensure full functionality, stability, and adherence to security standards before the v1.0.0 release.

---

## 1. Critical Application Startup & Stability

Ensuring the application launches reliably and handles errors gracefully.

*   **Confirm Application Starts Successfully**
    *   **Description:** Verify that the Electron application launches without freezing on the loading screen or crashing prematurely.
    *   **Current Status:** Extensive debugging and fixes have been applied:
        *   Resolved `SyntaxError: Unexpected token 'catch'` in `src/renderer/renderer.js` by correcting `try-catch` block nesting.
        *   Improved main process (`src/main/main.js`) robustness to denied UAC prompts during startup cleanup by creating the main window before elevated operations.
        *   Implemented null-safety checks for module-level `document.getElementById` calls in `src/renderer/renderer.js`, `src/renderer/ui/theme.js`, and `src/renderer/utils/audio.js` to prevent `TypeError`s due to missing DOM elements.
    *   **Action Required:** User to run the application (`npm start` from terminal) and confirm successful launch. If issues persist, collect main and renderer process console logs.
    *   **Related Files:** `src/renderer/renderer.js`, `src/main/main.js`, `src/renderer/ui/theme.js`, `src/renderer/utils/audio.js`.

*   **Resolve `chime.mp3` `ERR_FILE_NOT_FOUND`**
    *   **Description:** The renderer console reported `Failed to load resource: net::ERR_FILE_NOT_FOUND' chime.mp3:1`. This indicates a missing audio asset or an incorrect file path. While not critical for startup, it impacts functionality.
    *   **Action Required:** Ensure `chime.mp3` is present in the `assets/sounds/` directory. If the file is indeed missing, either add it or update references in `src/renderer/utils/audio.js` or `index.html` to a valid sound file.
    *   **Related Files:** `index.html`, `src/renderer/utils/audio.js`, `assets/sounds/chime.mp3`.

---

## 2. Feature Verification

Thorough testing of newly implemented and modified features.

*   **Custom Soundpack Creator**
    *   **Description:** A new feature allowing users to create, save, load, and delete custom sound packs including custom notification and ambient sounds.
    *   **Action Required:**
        *   Navigate to the "Sounds" tab in Customization.
        *   Test creating a new soundpack: Enter a name, upload custom notification sounds, upload custom ambient sounds, and click "Save Custom Soundpack."
        *   Verify the new soundpack appears in the main soundpack selector and the "My Custom Soundpacks" dropdown.
        *   Test loading a custom soundpack and ensuring its sounds are available and play correctly.
        *   Test deleting a custom soundpack from the "My Custom Soundpacks" dropdown.
    *   **Related Files:** `index.html` (UI), `src/renderer/utils/audio.js` (logic), `src/renderer/renderer.js` (event handling).

*   **Site Blocker Functionality**
    *   **Description:** The site blocker received significant security enhancements and was reported as non-functional previously.
    *   **Action Required:**
        *   Test both "Block" and "Allow Only" modes with various domains and URLs.
        *   Verify that blocked sites are inaccessible and allowed sites are accessible.
        *   Confirm that the security enhancements (command injection prevention in `src/main/main.js` and `src/main/fokus-sb-helper.js`, `isOriginSafe` IPC checks, robust `normalizeHost` in `src/renderer/utils/utils.js`) have not introduced regressions and that the feature works reliably.
        *   Address the original bug report: "Site blocker does not do anything when you press save and apply Blocker. It does not work."
    *   **Related Files:** `index.html` (UI), `src/renderer/features/site-blocker.js` (renderer logic), `src/main/main.js` (main process interactions, `runElevated`), `src/main/fokus-sb-helper.js` (elevated script), `src/renderer/utils/utils.js` (`normalizeHost`, regexes).

*   **Custom Theme Creator**
    *   **Description:** The custom theme creator UI was refined, and several loose ends were addressed for maintainability and robustness.
    *   **Action Required:**
        *   Verify that custom theme colors can be set using the color pickers, saved, and applied correctly to the application's UI.
        *   Confirm that the "Reset Theme Colors" button functions as expected, reverting to default custom values.
        *   Ensure theme mode toggling (Light, Dark, Custom) works as expected.
    *   **Related Files:** `index.html` (UI), `src/renderer/ui/theme.js` (logic), `src/renderer/renderer.js` (event handling).

*   **Sounds Tab UI Refinement**
    *   **Description:** The "Sounds" tab UI in customization was restructured for better clarity and consistency with other settings.
    *   **Action Required:** Confirm the UI looks consistent with the rest of the application and is easier to understand, particularly how sound packs relate to ambient and notification sound selections.
    *   **Related Files:** `index.html`.

---

## 3. Quality of Life (QOL) Improvements (from `mfokus1.0.0.md`)

*   **Convert Health Mode to Fokus Mode and Add to Dashboard**
    *   **Description:** The existing "Health Mode" (`src/renderer/features/health-mode.js`) needs to be integrated into the main dashboard as a standard "Fokus Mode."
    *   **Action Required:**
        *   Refactor `health-mode.js` to fit the "Fokus Mode" pattern.
        *   Update `index.html` and `src/renderer/renderer.js` to add "Health Fokus Mode" to the dashboard's mode selection.
        *   Ensure all existing Health Mode functionalities (eye saver, posture check) work within the new Fokus Mode structure.
    *   **Related Files:** `src/renderer/features/health-mode.js`, `index.html`, `src/renderer/renderer.js`.

*   **Add Sidebar Color to Customization Menu**
    *   **Description:** Implement an option within the Customization menu to allow users to change the sidebar's background color.
    *   **Action Required:**
        *   Modify `index.html` to add a color picker or selection for sidebar color in the Customization menu.
        *   Update `src/renderer/ui/theme.js` to handle saving, loading, and applying the sidebar color.
        *   Ensure the new setting persists across sessions.
    *   **Related Files:** `index.html`, `src/renderer/ui/theme.js`.

---

## 4. Bug Fixes (from `mfokus1.0.0.md`)

*   **Sidebar Visibility with Open Menus**
    *   **Description:** Fix the bug where the sidebar unexpectedly closes when clicking inside an open customization menu. The sidebar should remain open as long as a menu is active, only closing when explicitly dismissed (e.g., via 'x' button or outside click on the main app).
    *   **Action Required:** Investigate event propagation and modal/sidebar interaction logic in `index.html`, `src/renderer/ui/modals.js`, and `src/renderer/renderer.js`. Adjust event listeners to prevent the sidebar from closing prematurely.
    *   **Related Files:** `index.html`, `src/renderer/ui/modals.js`, `src/renderer/renderer.js`.

---

## 5. Technical & Other Requirements (from `mfokus1.0.0.md`)

*   **Version Bump to "v1.0.0"**
    *   **Description:** Update the application's version number to "v1.0.0" in all relevant configuration and display files.
    *   **Action Required:**
        *   Update `package.json`.
        *   Update any UI elements that display the version (e.g., in `index.html` or an "About" modal).
    *   **Related Files:** `package.json`, `index.html`, potentially other display files.

*   **Update `UPDATE_DOCUMENTATION.txt`**
    *   **Description:** Document all changes, new features, bug fixes, and security enhancements implemented during this development cycle.
    *   **Action Required:** Create or update `UPDATE_DOCUMENTATION.txt` with a detailed account of all modifications.
    *   **Related Files:** `UPDATE_DOCUMENTATION.txt`.

*   **Final Bug Checks**
    *   **Description:** Conduct a rigorous, multi-pass testing process to ensure no new bugs were introduced and all existing features function flawlessly.
    *   **Action Required:** Follow the specified process: "check the app 3 times for any bugs. If bugs are found fix them and check 3 times again. Repeat the process until no bugs are found. Then check one last time."
    *   **Related Files:** Entire codebase (testing phase).

---
**Note:** This file was generated by the Gemini CLI. Please save this content and then you may clear my context if desired.
