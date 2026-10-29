import {
  createStereoBuffer,
  midiToFrequency,
  sampleRate,
  secondsToSamples,
  type StereoBuffer,
} from "./audio-buffer";
import { BiquadFilter } from "./biquad-filter";

/** A band-limited sawtooth step (polyBLEP), so high notes do not alias. */
function getSawSample(phase: number, phaseStep: number): number {
  let value = 2 * phase - 1;
  if (phase < phaseStep) {
    const position = phase / phaseStep;
    value -= position + position - position * position - 1;
  } else if (phase > 1 - phaseStep) {
    const position = (phase - 1) / phaseStep;
    value -= position * position + position + position + 1;
  }
  return value;
}

/** A plucked arpeggio note: two detuned saws through a closing filter. */
export function renderPluck(
  midiNote: number,
  brightness: number,
): Float32Array {
  const pluckSamples = new Float32Array(secondsToSamples(0.5));
  const lowpass = new BiquadFilter("lowpass", 1.4);
  const frequencyHz = midiToFrequency(midiNote);
  const phases = [0, 0.37];
  const detuneRatios = [1, 1.006];
  for (
    let sampleIndex = 0;
    sampleIndex < pluckSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    let oscillatorSum = 0;
    phases.forEach((phase, voiceIndex) => {
      const phaseStep =
        (frequencyHz * (detuneRatios[voiceIndex] ?? 1)) / sampleRate;
      oscillatorSum += getSawSample(phase, phaseStep);
      phases[voiceIndex] = (phase + phaseStep) % 1;
    });
    const cutoffHz = 400 + brightness * 4200 * Math.exp(-timeSeconds * 16);
    const attack = Math.min(1, timeSeconds / 0.003);
    pluckSamples[sampleIndex] =
      lowpass.process(oscillatorSum * 0.5, cutoffHz) *
      attack *
      Math.exp(-timeSeconds * 7);
  }
  return pluckSamples;
}

/** A warm pad chord: three detuned saws per note, spread left and right. */
export function renderPad(
  midiNotes: number[],
  lengthSeconds: number,
  cutoffHz: number,
): StereoBuffer {
  const padBuffer = createStereoBuffer(secondsToSamples(lengthSeconds + 1.2));
  const detuneCents = [-9, 0, 9];
  const leftFilter = new BiquadFilter("lowpass", 0.8);
  const rightFilter = new BiquadFilter("lowpass", 0.8);
  const oscillators = midiNotes.flatMap((midiNote, noteIndex) =>
    detuneCents.map((cents, detuneIndex) => ({
      phaseStep: (midiToFrequency(midiNote) * 2 ** (cents / 1200)) / sampleRate,
      phase: (noteIndex * 0.31 + detuneIndex * 0.17) % 1,
      pan: detuneIndex - 1,
    })),
  );
  const voiceGain = 1 / Math.sqrt(oscillators.length);
  for (
    let sampleIndex = 0;
    sampleIndex < padBuffer.left.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    let leftSum = 0;
    let rightSum = 0;
    for (const oscillator of oscillators) {
      const value = getSawSample(oscillator.phase, oscillator.phaseStep);
      oscillator.phase = (oscillator.phase + oscillator.phaseStep) % 1;
      leftSum += value * (1 - oscillator.pan * 0.6);
      rightSum += value * (1 + oscillator.pan * 0.6);
    }
    const attack = Math.min(1, timeSeconds / 0.5);
    const release = Math.min(
      1,
      Math.max(0, (lengthSeconds + 1.2 - timeSeconds) / 1.2),
    );
    const envelope = attack * release * voiceGain * 0.5;
    padBuffer.left[sampleIndex] =
      leftFilter.process(leftSum, cutoffHz) * envelope;
    padBuffer.right[sampleIndex] =
      rightFilter.process(rightSum, cutoffHz) * envelope;
  }
  return padBuffer;
}

/** Sub bass: a sine with a little saturated octave on top. */
export function renderBass(
  midiNote: number,
  lengthSeconds: number,
): Float32Array {
  const bassSamples = new Float32Array(secondsToSamples(lengthSeconds));
  const frequencyHz = midiToFrequency(midiNote);
  for (
    let sampleIndex = 0;
    sampleIndex < bassSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    const phase = 2 * Math.PI * frequencyHz * timeSeconds;
    const attack = Math.min(1, timeSeconds / 0.006);
    const release = Math.min(1, (lengthSeconds - timeSeconds) / 0.04);
    const body = Math.sin(phase) + 0.25 * Math.tanh(2 * Math.sin(2 * phase));
    bassSamples[sampleIndex] = body * attack * release * 0.7;
  }
  return bassSamples;
}

/** A small bell: a sine with an inharmonic partial and a long decay. */
export function renderBell(midiNote: number): Float32Array {
  const bellSamples = new Float32Array(secondsToSamples(1.8));
  const frequencyHz = midiToFrequency(midiNote);
  for (
    let sampleIndex = 0;
    sampleIndex < bellSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    const phase = 2 * Math.PI * frequencyHz * timeSeconds;
    const fundamental = Math.sin(phase) * Math.exp(-timeSeconds * 2.6);
    const partial = Math.sin(phase * 2.76) * 0.35 * Math.exp(-timeSeconds * 6);
    const attack = Math.min(1, timeSeconds / 0.002);
    bellSamples[sampleIndex] = (fundamental + partial) * attack;
  }
  return bellSamples;
}

/** A soft lead note: one saw and a square-ish octave below, gently filtered. */
export function renderLead(
  midiNote: number,
  lengthSeconds: number,
): Float32Array {
  const leadSamples = new Float32Array(secondsToSamples(lengthSeconds + 0.3));
  const lowpass = new BiquadFilter("lowpass", 1.1);
  const phaseStep = midiToFrequency(midiNote) / sampleRate;
  let phase = 0;
  let vibratoPhase = 0;
  for (
    let sampleIndex = 0;
    sampleIndex < leadSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    vibratoPhase += (2 * Math.PI * 5.5) / sampleRate;
    const vibrato =
      1 + 0.003 * Math.sin(vibratoPhase) * Math.min(1, timeSeconds / 0.4);
    phase = (phase + phaseStep * vibrato) % 1;
    const saw = getSawSample(phase, phaseStep);
    const attack = Math.min(1, timeSeconds / 0.012);
    const release = Math.min(
      1,
      Math.max(0, (lengthSeconds + 0.3 - timeSeconds) / 0.3),
    );
    leadSamples[sampleIndex] =
      lowpass.process(saw, 2600) *
      attack *
      release *
      Math.exp(-timeSeconds * 0.8) *
      0.6;
  }
  return leadSamples;
}
