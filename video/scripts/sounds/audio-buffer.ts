/** Shared building blocks for the trailer's UI sounds (docs/plan/23, Sound effects). */
export const sampleRate = 44100;

export function secondsToSamples(seconds: number): number {
  return Math.round(seconds * sampleRate);
}

export function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

/** Adds `sourceSamples` into `targetSamples` at `startSeconds` with a gain. */
export function mixInto(
  targetSamples: Float32Array,
  sourceSamples: Float32Array,
  startSeconds: number,
  gain: number,
) {
  const startSample = secondsToSamples(startSeconds);
  for (
    let sampleIndex = 0;
    sampleIndex < sourceSamples.length;
    sampleIndex += 1
  ) {
    const targetIndex = startSample + sampleIndex;
    if (targetIndex >= targetSamples.length) {
      break;
    }
    targetSamples[targetIndex] =
      (targetSamples[targetIndex] ?? 0) +
      (sourceSamples[sampleIndex] ?? 0) * gain;
  }
}

/** Scales a sound so its loudest sample sits at `peakLevel`, with short fades. */
export function normaliseSound(soundSamples: Float32Array, peakLevel: number) {
  let peak = 0;
  for (const sampleValue of soundSamples) {
    peak = Math.max(peak, Math.abs(sampleValue));
  }
  const gain = peak > 0 ? peakLevel / peak : 1;
  const fadeSamples = secondsToSamples(0.004);
  for (
    let sampleIndex = 0;
    sampleIndex < soundSamples.length;
    sampleIndex += 1
  ) {
    const fadeIn = Math.min(1, sampleIndex / fadeSamples);
    const fadeOut = Math.min(
      1,
      (soundSamples.length - sampleIndex) / fadeSamples,
    );
    soundSamples[sampleIndex] =
      (soundSamples[sampleIndex] ?? 0) * gain * fadeIn * fadeOut;
  }
}

/** A seeded random source, so the same script always writes the same sounds. */
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
