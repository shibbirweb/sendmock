import { sampleRate, secondsToSamples } from "./audio-buffer";
import { BiquadFilter } from "./biquad-filter";

/** A soft, round kick: a sine whose pitch falls fast, with a tiny click. */
export function renderKick(random: () => number): Float32Array {
  const kickSamples = new Float32Array(secondsToSamples(0.4));
  let phase = 0;
  for (
    let sampleIndex = 0;
    sampleIndex < kickSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    const frequencyHz = 48 + 100 * Math.exp(-timeSeconds * 32);
    phase += (2 * Math.PI * frequencyHz) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-timeSeconds * 7.5);
    const click = timeSeconds < 0.004 ? (random() * 2 - 1) * 0.25 : 0;
    kickSamples[sampleIndex] = Math.tanh((body + click) * 1.4);
  }
  return kickSamples;
}

/** A hi-hat: high-passed noise; open hats ring longer. */
export function renderHat(random: () => number, isOpen: boolean): Float32Array {
  const lengthSeconds = isOpen ? 0.35 : 0.07;
  const decayRate = isOpen ? 11 : 70;
  const hatSamples = new Float32Array(secondsToSamples(lengthSeconds));
  const highpass = new BiquadFilter("highpass", 0.9);
  for (let sampleIndex = 0; sampleIndex < hatSamples.length; sampleIndex += 1) {
    const timeSeconds = sampleIndex / sampleRate;
    const noise = random() * 2 - 1;
    hatSamples[sampleIndex] =
      highpass.process(noise, 7500) * Math.exp(-timeSeconds * decayRate);
  }
  return hatSamples;
}

/** A clap: three quick band-passed noise bursts and a short tail. */
export function renderClap(random: () => number): Float32Array {
  const clapSamples = new Float32Array(secondsToSamples(0.3));
  const bandpass = new BiquadFilter("bandpass", 1.2);
  const burstStartsSeconds = [0, 0.011, 0.022];
  for (
    let sampleIndex = 0;
    sampleIndex < clapSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    const lastBurstSeconds = Math.max(
      ...burstStartsSeconds.filter((burstStart) => burstStart <= timeSeconds),
    );
    const sinceBurstSeconds = timeSeconds - lastBurstSeconds;
    const decayRate = lastBurstSeconds === 0.022 ? 16 : 140;
    const envelope = Math.exp(-sinceBurstSeconds * decayRate);
    clapSamples[sampleIndex] =
      bandpass.process(random() * 2 - 1, 1400) * envelope * 1.8;
  }
  return clapSamples;
}

/** Noise sweeping up in pitch and loudness into a reveal. */
export function renderRiser(
  random: () => number,
  lengthSeconds: number,
): Float32Array {
  const riserSamples = new Float32Array(secondsToSamples(lengthSeconds));
  const bandpass = new BiquadFilter("bandpass", 1.6);
  let tonePhase = 0;
  for (
    let sampleIndex = 0;
    sampleIndex < riserSamples.length;
    sampleIndex += 1
  ) {
    const progress = sampleIndex / riserSamples.length;
    const cutoffHz = 300 * 2 ** (progress * 4.6);
    tonePhase += (2 * Math.PI * (180 + progress * 700)) / sampleRate;
    const noise = bandpass.process(random() * 2 - 1, cutoffHz);
    const tone = Math.sin(tonePhase) * 0.12;
    riserSamples[sampleIndex] = (noise * 1.4 + tone) * progress ** 2.2;
  }
  return riserSamples;
}

/** A low, soft impact for reveals: a falling boom and a short air burst. */
export function renderImpact(random: () => number): Float32Array {
  const impactSamples = new Float32Array(secondsToSamples(2.2));
  const lowpass = new BiquadFilter("lowpass", 0.8);
  let phase = 0;
  for (
    let sampleIndex = 0;
    sampleIndex < impactSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    phase +=
      (2 * Math.PI * (38 + 60 * Math.exp(-timeSeconds * 9))) / sampleRate;
    const boom = Math.sin(phase) * Math.exp(-timeSeconds * 2.4);
    const air =
      lowpass.process(
        random() * 2 - 1,
        2500 * Math.exp(-timeSeconds * 3) + 200,
      ) *
      Math.exp(-timeSeconds * 4) *
      0.5;
    impactSamples[sampleIndex] = Math.tanh((boom + air) * 1.3);
  }
  return impactSamples;
}
