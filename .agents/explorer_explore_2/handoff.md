# Handoff Report: Classic Pack Sound Generation Distortion Analysis (R2)

## 1. Observation
- **Target File**: `src/renderer/utils/audio/audio-engine.js`
- **Observed Lines**: Lines 50–64 of `audio-engine.js`:
  ```javascript
  const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      if (type.startsWith('classic')) {
          output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise
          lastOut = output[i];
          output[i] *= 3.5;
      } else {
          output[i] = white * 0.5; // Pinkish
      }
  }
  ```
- **Interface Contract**: In `PROJECT.md` line 26: 
  `Output buffer values for brown noise generation in audio-engine.js must be within range [-1.0, 1.0].`
- **Requirement**: In `ORIGINAL_REQUEST.md` line 43:
  `Modify or remove the scaling factor and normalize the audio range to prevent amplitude from exceeding [-1.0, 1.0] to eliminate clipping, pops, and distortion.`

---

## 2. Logic Chain
1. The white noise generation `Math.random() * 2 - 1` yields values uniformly in `[-1.0, 1.0)`.
2. The brown noise integrator `output[i] = (lastOut + (0.02 * white)) / 1.02` attenuates high frequencies but limits maximum steady-state values to `[-1.0, 1.0]`. In practice, peak absolute values over a 2-second buffer typically vary between `0.10` and `0.35` due to random distribution.
3. The static multiplier `output[i] *= 3.5` increases the amplitude. However, whenever the unscaled sample exceeds $\approx \pm 0.2857$ in magnitude, the scaled output sample `output[i]` exceeds the range `[-1.0, 1.0]`.
4. When played back via Web Audio API, buffer samples exceeding `[-1.0, 1.0]` undergo hard digital clipping at the system's DAC stage, causing audible distortion, crackling, and popping.
5. Therefore, removing the static `*= 3.5` multiplier and replacing it with a linear peak normalization step will scale the generated audio precisely to a safe maximum level (e.g. peak of `0.95` or `1.0`), preventing any clipping or distortion while maintaining clear, optimal volume.

---

## 3. Caveats
- The subsequent Web Audio API filter nodes (`lowpass`, `bandpass`) might slightly affect the final signal peak after the buffer is read, but since processing occurs internally in floating point, DAC clipping is primarily prevented by keeping the source buffer within `[-1.0, 1.0]`.
- Performance impact of a second pass over the buffer of 2 seconds (e.g. 88,200 samples) to calculate the peak and normalize is negligible (less than 1 ms in JavaScript).

---

## 4. Conclusion
The audio clipping and distortion in the Classic Pack brown noise are caused by the hardcoded `output[i] *= 3.5` scaling factor. We recommend:
1. Generating the raw brown noise buffer without the static `3.5` multiplier.
2. Performing a linear peak normalization pass over the buffer to scale the maximum absolute sample value to a target peak of `0.95` (for headroom) or `1.0`.

---

## 5. Verification Method
- **Automated Tests**: Run the project's Playwright E2E suite using `npm test`.
- **Code Check**: Inspect `src/renderer/utils/audio/audio-engine.js` to ensure the static `output[i] *= 3.5;` is replaced with peak normalization.
- **Audio Verification**: Run the app, select Classic Ambient, and listen to confirm clean audio without popping.
