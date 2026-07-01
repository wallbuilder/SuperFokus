# Original User Request

## Initial Request — 2026-06-24T17:02:01-07:00

Enhance the E2E test suite for the SuperFokus application by implementing coverage for play/pause timer state synchronization, electron-store settings persistence, sound pack selection and audio upload dialog functionality, and stats dashboard rendering.

Working directory: D:/coding/fokus
Integrity mode: development

## Requirements

### R1. Play/Pause Timer State Synchronization Test
Add E2E tests to verify that pausing/resuming a timer from the main window correctly and immediately updates the state inside the mini-timer window, and vice versa.

### R2. Settings Persistence Test
Add E2E tests to verify that custom interval configurations, selected themes, or accent color settings successfully persist across Electron application restarts.

### R3. Sound Settings & Custom Upload Test
Add E2E tests to verify switching sound packs updates configurations, and verify the audio-upload dialog triggers and handles file paths correctly. Use simple mocking/interception for native file dialogs and decoders.

### R4. Fokus Stats Dashboard Test
Add E2E tests to verify that the Fokus Stats panel opens successfully, renders the 7-day activity heatmap, and updates metrics after a focus session completes.

## Acceptance Criteria

### E2E Test Verification
- [ ] New Playwright E2E tests run successfully as part of `npm test` without introducing regressions.
- [ ] No zombie Electron processes remain active after running the test suite.

## Follow-up Request — 2026-06-30T21:26:17Z

Implement customizability enhancements for SFX, fix the audio clipping issue in the computer generated classic pack, and add a visual "Update" preset button.

Working directory: D:/coding/fokus
Integrity mode: development

## Requirements

### R1. Customizability Menu: Multiple Savable SFX & Delete Option
- In the Sounds tab, allow up to **10** custom notification sounds (SFX). Ensure they are properly saved, rendered, and persist across restarts.
- Provide an explicit delete option for each custom SFX sound. When deleted, it must update the selection options and clean up the stored data (and delete any corresponding physical audio files from disk if saved via Electron).

### R2. Fix Classic Pack Sound Generation Distortion
- In `src/renderer/utils/audio/audio-engine.js`, address the `output[i] *= 3.5` multiplier which changes the sound generation values of the computer-generated classic pack (brown noise).
- Modify or remove the scaling factor and normalize the audio range to prevent amplitude from exceeding `[-1.0, 1.0]` to eliminate clipping, pops, and distortion.

### R3. Visual Preset "Update" Button
- In all Fokus Modes that have preset support (Pomo Timer, Micro Sprint, Repeating Reminders):
  - Track if a preset (built-in or custom) is selected.
  - If the user changes any input/value from the selected preset's initial values, show a green "Update" button in place of the "Save Preset" button.
  - If the "Update" button is clicked:
    - If it's a custom preset, save the changes to the active preset in-place and save to storage.
    - If it's a built-in preset, save it as a new custom preset under the same name (or prompt/handle saving it as a custom preset).
  - The green "Update" button must change back to the regular "Save Preset" button once the preset is saved or if values match the selected preset again.

## Acceptance Criteria

### SFX Uploads & Management
- [ ] Users can upload up to 10 custom notification sounds (SFX).
- [ ] Deleting a custom SFX successfully deletes it from storage (and removes its local file if stored on disk) and updates all dropdown options.

### Classic Audio Generation
- [ ] The generated brown noise in classic pack plays cleanly without digital clipping or distortion.
- [ ] The values in the output buffer for brown noise do not exceed the bounds `[-1.0, 1.0]`.

### Preset UI Updates
- [ ] In Pomo, Micro Sprint, and Repeating Reminders: modifying values after selecting a preset changes the "Save Preset" button into a green "Update" button.
- [ ] Saving the modified preset reverts the "Update" button back to the "Save Preset" button.
- [ ] Existing E2E tests still pass, and new E2E tests are added to verify the custom SFX limits, deletion, and the green "Update" button flow.
