/** Shared audio building blocks for the trailer music (docs/plan/23, Music). */
export const sampleRate = 44100;

export type StereoBuffer = {
  left: Float32Array;
  right: Float32Array;
};

export function createStereoBuffer(lengthSamples: number): StereoBuffer {
  return {
    left: new Float32Array(lengthSamples),
    right: new Float32Array(lengthSamples),
  };
}

export function secondsToSamples(seconds: number): number {
  return Math.round(seconds * sampleRate);
}

export function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

/** Adds a mono sound at `startSeconds`, panned from -1 (left) to 1 (right). */
export function addMonoSound(
  targetBuffer: StereoBuffer,
  monoSamples: Float32Array,
  startSeconds: number,
  gain: number,
  pan = 0,
) {
  const startSample = secondsToSamples(startSeconds);
  const leftGain = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const rightGain = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  const lastSample = Math.min(
    monoSamples.length,
    targetBuffer.left.length - startSample,
  );
  for (let sampleIndex = 0; sampleIndex < lastSample; sampleIndex += 1) {
    const value = monoSamples[sampleIndex] ?? 0;
    const targetIndex = startSample + sampleIndex;
    if (targetIndex >= 0) {
      targetBuffer.left[targetIndex] =
        (targetBuffer.left[targetIndex] ?? 0) + value * leftGain;
      targetBuffer.right[targetIndex] =
        (targetBuffer.right[targetIndex] ?? 0) + value * rightGain;
    }
  }
}

/** Adds a stereo sound at `startSeconds` with one gain. */
export function addStereoSound(
  targetBuffer: StereoBuffer,
  stereoSound: StereoBuffer,
  startSeconds: number,
  gain: number,
) {
  const startSample = secondsToSamples(startSeconds);
  const lastSample = Math.min(
    stereoSound.left.length,
    targetBuffer.left.length - startSample,
  );
  for (let sampleIndex = 0; sampleIndex < lastSample; sampleIndex += 1) {
    const targetIndex = startSample + sampleIndex;
    if (targetIndex >= 0) {
      targetBuffer.left[targetIndex] =
        (targetBuffer.left[targetIndex] ?? 0) +
        (stereoSound.left[sampleIndex] ?? 0) * gain;
      targetBuffer.right[targetIndex] =
        (targetBuffer.right[targetIndex] ?? 0) +
        (stereoSound.right[sampleIndex] ?? 0) * gain;
    }
  }
}

/** Mixes `sourceBuffer` into `targetBuffer` with a gain. */
export function mixInto(
  targetBuffer: StereoBuffer,
  sourceBuffer: StereoBuffer,
  gain: number,
) {
  for (
    let sampleIndex = 0;
    sampleIndex < targetBuffer.left.length;
    sampleIndex += 1
  ) {
    targetBuffer.left[sampleIndex] =
      (targetBuffer.left[sampleIndex] ?? 0) +
      (sourceBuffer.left[sampleIndex] ?? 0) * gain;
    targetBuffer.right[sampleIndex] =
      (targetBuffer.right[sampleIndex] ?? 0) +
      (sourceBuffer.right[sampleIndex] ?? 0) * gain;
  }
}

/** A seeded random source, so the same script always writes the same track. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
