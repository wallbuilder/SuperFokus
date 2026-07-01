# Project: SuperFokus SFX & Preset Enhancements

## Architecture
- Electron + React codebase.
- State storage: `electron-store` settings persistence.
- Audio Engine: `src/renderer/utils/audio/audio-engine.js` which performs sound generation.
- Settings Tab / Sounds: Configuration UI for custom notification sounds (SFX).
- Fokus Modes: Preset components for Pomo Timer, Micro Sprint, and Repeating Reminders.

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|---|---|---|---|---|
| 1 | Explore | Research SFX, Audio Engine, and Preset structures | None | DONE | 3903e548, 29373762, 7b7018f6 |
| 2 | SFX Customizability (R1) | Support up to 10 custom SFX, add delete option and disk cleanup | Explore | DONE | 92047946 |
| 3 | Audio Generation Fix (R2) | Modify audio-engine.js brown noise scaling factor and normalization | Explore | DONE | 92047946 |
| 4 | Preset Update Button (R3) | Implement green "Update" button flow for Pomo, Micro Sprint, Repeating Reminders | Explore | DONE | 92047946 |
| 5 | E2E Testing | Formulate and run E2E test cases for SFX, Audio, and Presets | All above | DONE | 41931d7e |

## Interface Contracts
### Custom SFX Settings
- Storage schema: array of custom SFX objects (name, filePath).
- Max limit: 10 custom SFX files.
- Delete flow: clean up both the list in storage and delete the physical file on disk.

### Audio Generation
- Output buffer values for brown noise generation in `audio-engine.js` must be within range `[-1.0, 1.0]`.

### Preset Update Flow
- Component tracks active preset (ID/name, type: built-in or custom).
- Inputs are monitored for deviation from active preset's initial values.
- UI button switches from "Save Preset" to green "Update" button when values differ, and reverts back when values are equal or saved.
- Saving updates custom preset in-place, or saves built-in preset as a new custom preset under the same name.
