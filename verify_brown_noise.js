// Empirical Verification of Brown Noise Generator logic
const assert = require('assert');

function runSimulation() {
    const sampleRate = 44100;
    const bufferSize = sampleRate * 2;
    const output = new Float32Array(bufferSize);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise
        lastOut = output[i];
    }

    let maxVal = 0;
    for (let i = 0; i < bufferSize; i++) {
        let absVal = Math.abs(output[i]);
        if (absVal > maxVal) {
            maxVal = absVal;
        }
    }
    
    assert(maxVal > 0, "Max value should be greater than 0");
    
    const targetPeak = 0.95;
    const scaleFactor = targetPeak / maxVal;
    for (let i = 0; i < bufferSize; i++) {
        output[i] *= scaleFactor;
    }
    
    // Check bounds
    let finalMaxVal = 0;
    for (let i = 0; i < bufferSize; i++) {
        const val = output[i];
        assert(val >= -1.0 && val <= 1.0, `Value ${val} at index ${i} is out of bounds [-1.0, 1.0]`);
        if (Math.abs(val) > finalMaxVal) {
            finalMaxVal = Math.abs(val);
        }
    }
    
    // Check that peak is exactly 0.95 within floating point precision
    assert(Math.abs(finalMaxVal - 0.95) < 1e-6, `Peak value ${finalMaxVal} is not equal to target 0.95`);
}

console.log("Starting 100 runs of the brown noise generator simulation...");
for (let run = 1; run <= 100; run++) {
    runSimulation();
}
console.log("All 100 simulations completed successfully! Output buffer limits and peak normalization verified.");
