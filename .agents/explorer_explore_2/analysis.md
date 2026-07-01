# Analysis: Classic Pack Sound Generation Distortion (R2)

## 1. Executive Summary
This report analyzes the audio distortion and digital clipping issues associated with the computer-generated "Classic Pack" brown noise in the SuperFokus application. Specifically, the analysis focuses on `src/renderer/utils/audio/audio-engine.js`, where a static multiplier of `3.5` is applied to synthetic brown noise samples. This multiplier regularly drives the output values beyond the valid AudioContext buffer range of `[-1.0, 1.0]`, causing hard digital clipping, pops, and crackles. We propose replacing the static multiplier with **linear peak normalization** to guarantee the amplitude remains strictly within `[-1.0, 1.0]` (specifically targeting a peak of `0.95` for headroom) while preserving the brown noise's spectral characteristics.

---

## 2. Codebase Investigation
The brown noise generation is located in `src/renderer/utils/audio/audio-engine.js` within the `startSynthAmbient` function (lines 50–64):

```javascript
50:     const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
51:     const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
52:     const output = buffer.getChannelData(0);
53:     
54:     let lastOut = 0;
55:     for (let i = 0; i < bufferSize; i++) {
56:         let white = Math.random() * 2 - 1;
57:         if (type.startsWith('classic')) {
58:             output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise
59:             lastOut = output[i];
60:             output[i] *= 3.5;
61:         } else {
62:             output[i] = white * 0.5; // Pinkish
63:         }
64:     }
```

### Analysis of the Sound Generation Algorithm
1. **White Noise Source**:
   `let white = Math.random() * 2 - 1;`
   Generates random values uniformly distributed in `[-1.0, 1.0)`.

2. **Leaky Integrator (Brown Noise Approximation)**:
   `output[i] = (lastOut + (0.02 * white)) / 1.02;`
   This is a discrete-time one-pole low-pass filter (integrator) represented by:
   $$y[i] = \frac{y[i-1] + 0.02 \cdot x[i]}{1.02} \approx 0.98039 \cdot y[i-1] + 0.01961 \cdot x[i]$$
   - **Pole**: $z = 1/1.02 \approx 0.98039$. Since the pole is inside the unit circle ($|z| < 1$), the filter is stable.
   - **DC Gain**: If $x[i] = A$ (constant), the steady-state output is $y[i] = A$. Since $x[i] \in [-1.0, 1.0)$, the maximum theoretical output of this filter is bounded by $[-1.0, 1.0]$.
   - **Practical Amplitude**: Because the input is zero-mean white noise, the random walk rarely approaches the absolute theoretical limits of $\pm 1.0$. Over a 2-second buffer (e.g. 88,200 or 96,000 samples), the peak absolute value typically ranges between `0.10` and `0.35` depending on the random seed.

3. **The Static Multiplier**:
   `output[i] *= 3.5;`
   To compensate for the attenuation of high frequencies and low overall volume of the unscaled brown noise, a hardcoded multiplier of `3.5` is applied. 
   - **Feedback Isolation**: Fortunately, the feedback state `lastOut` is updated on line 59 *before* the multiplication on line 60:
     ```javascript
     lastOut = output[i];
     output[i] *= 3.5;
     ```
     This prevents the scaled values from destabilizing the integrator.
   - **The Distortion Problem**: Whenever the unscaled brown noise $y[i]$ exceeds $\pm (1.0 / 3.5) \approx \pm 0.2857$, the scaled output sample `output[i]` exceeds the range `[-1.0, 1.0]`. When these out-of-bounds samples are played back via Web Audio API, they undergo hard digital clipping at the digital-to-analog converter (DAC) stage, manifesting as harsh pops, crackles, and digital distortion.

---

## 3. Recommended Design Solutions

We recommend replacing the static multiplier with **peak normalization** after the buffer is populated. This guarantees maximum possible clean volume without clipping.

### Option A: Peak Normalization with Headroom (Recommended)
This approach runs the synthesis loop without the static multiplier, finds the maximum absolute value in the buffer, and then scales all samples linearly so the peak is exactly `0.95` (leaving `0.05` or `0.5 dB` of headroom to prevent inter-sample clipping).

#### Code Proposal:
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
        } else {
            output[i] = white * 0.5; // Pinkish
        }
    }

    // Peak Normalization for Classic Brown Noise
    if (type.startsWith('classic')) {
        let maxVal = 0;
        for (let i = 0; i < bufferSize; i++) {
            let absVal = Math.abs(output[i]);
            if (absVal > maxVal) {
                maxVal = absVal;
            }
        }
        if (maxVal > 0) {
            const targetPeak = 0.95; // 0.95 peak amplitude for safety headroom
            const scaleFactor = targetPeak / maxVal;
            for (let i = 0; i < bufferSize; i++) {
                output[i] *= scaleFactor;
            }
        }
    }
```

### Option B: Soft Clipping (Tanh Wave-shaping)
Alternatively, a soft-clipping mathematical function like hyperbolic tangent (`Math.tanh`) can be used to compress values dynamically into the `(-1.0, 1.0)` range:
```javascript
output[i] = Math.tanh(output[i] * 3.5);
```
- **Pros**: Easy to compute per-sample; doesn't require a second pass.
- **Cons**: `Math.tanh` is non-linear and acts as a saturator, introducing harmonic distortion (added high-frequency harmonics). For a noise generator meant to produce clean brown noise, this ruins the spectral signature.
- **Verdict**: Inadequate because the objective is to *eliminate* clipping and distortion, not introduce warm harmonic distortion.

---

## 4. Verification and Testing Method
To verify that the output buffer values do not exceed `[-1.0, 1.0]` and that no clipping occurs:
1. **Automated Test**: Add an assertion in the E2E or unit tests that intercepts/retrieves the generated buffer and checks that:
   $$\max_{i} |output[i]| \le 1.0$$
2. **Manual Inspection**: Play the "Classic" ambient noise modes (`classic-bg-1`, `classic-bg-2`, `classic-bg-3`) in the UI and verify audibly that there are no digital crackles or pops, and that the volume levels are consistent and pleasant.
