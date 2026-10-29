import {
  createSeededRandom,
  midiToFrequency,
  mixInto,
  sampleRate,
  secondsToSamples,
} from "./audio-buffer";
import { BiquadFilter, type FilterKind } from "./biquad-filter";

type ToneSpec = {
  frequencyHz: number;
  /** Optional end frequency for a short glide. */
  toFrequencyHz?: number;
  lengthSeconds: number;
  decayRate: number;
  /** A warm overtone an octave up (harmonic, so it never sounds metallic). */
  overtoneGain?: number;
  /** Longer attacks sound softer; the default is a gentle 4 ms. */
  attackSeconds?: number;
};

/** A soft sine tone with a gentle attack and an exponential decay. */
function renderTone(toneSpec: ToneSpec): Float32Array {
  const toneSamples = new Float32Array(
    secondsToSamples(toneSpec.lengthSeconds),
  );
  const endFrequencyHz = toneSpec.toFrequencyHz ?? toneSpec.frequencyHz;
  let phase = 0;
  for (
    let sampleIndex = 0;
    sampleIndex < toneSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    const glideProgress = Math.min(1, timeSeconds / 0.05);
    const frequencyHz =
      toneSpec.frequencyHz +
      (endFrequencyHz - toneSpec.frequencyHz) * glideProgress;
    phase += (2 * Math.PI * frequencyHz) / sampleRate;
    const attack = Math.min(1, timeSeconds / (toneSpec.attackSeconds ?? 0.004));
    const envelope = attack * Math.exp(-timeSeconds * toneSpec.decayRate);
    const overtone = Math.sin(phase * 2) * (toneSpec.overtoneGain ?? 0);
    toneSamples[sampleIndex] = (Math.sin(phase) + overtone) * envelope;
  }
  return toneSamples;
}

type NoiseSweepSpec = {
  lengthSeconds: number;
  filterKind: FilterKind;
  /** Cutoff over the sound's progress, 0 to 1. */
  getCutoffHz: (progress: number) => number;
  /** Loudness over the sound's progress, 0 to 1. */
  getLoudness: (progress: number) => number;
};

/** Filtered noise whose colour and loudness follow the given curves. */
function renderNoiseSweep(
  random: () => number,
  sweepSpec: NoiseSweepSpec,
): Float32Array {
  const sweepSamples = new Float32Array(
    secondsToSamples(sweepSpec.lengthSeconds),
  );
  const filter = new BiquadFilter(sweepSpec.filterKind, 1.1);
  for (
    let sampleIndex = 0;
    sampleIndex < sweepSamples.length;
    sampleIndex += 1
  ) {
    const progress = sampleIndex / sweepSamples.length;
    const filtered = filter.process(
      random() * 2 - 1,
      sweepSpec.getCutoffHz(progress),
    );
    sweepSamples[sampleIndex] = filtered * sweepSpec.getLoudness(progress);
  }
  return sweepSamples;
}

const random = createSeededRandom(1042);

/** A soft button click: a tiny noise snap and a short high tick. */
export function renderClickSound(): Float32Array {
  const clickSamples = new Float32Array(secondsToSamples(0.08));
  const snap = renderNoiseSweep(random, {
    lengthSeconds: 0.03,
    filterKind: "highpass",
    getCutoffHz: () => 2500,
    getLoudness: (progress) => Math.exp(-progress * 6),
  });
  mixInto(clickSamples, snap, 0, 0.6);
  mixInto(
    clickSamples,
    renderTone({ frequencyHz: 1100, lengthSeconds: 0.05, decayRate: 110 }),
    0,
    0.5,
  );
  return clickSamples;
}

/** Something appears: a small rounded pop that glides up. */
export function renderAppearSound(): Float32Array {
  return renderTone({
    frequencyHz: 520,
    toFrequencyHz: 820,
    lengthSeconds: 0.18,
    decayRate: 28,
    overtoneGain: 0.08,
  });
}

/** Data leaves: a short airy swoosh that rises. */
export function renderSendSound(): Float32Array {
  const sendSamples = renderNoiseSweep(random, {
    lengthSeconds: 0.32,
    filterKind: "bandpass",
    getCutoffHz: (progress) => 700 * 2 ** (progress * 2.4),
    getLoudness: (progress) => Math.sin(progress * Math.PI) ** 1.5,
  });
  mixInto(
    sendSamples,
    renderTone({
      frequencyHz: 660,
      toFrequencyHz: 990,
      lengthSeconds: 0.2,
      decayRate: 18,
    }),
    0.04,
    0.12,
  );
  return sendSamples;
}

/** Data lands: two quick soft blips, low then high. */
export function renderArriveSound(): Float32Array {
  const arriveSamples = new Float32Array(secondsToSamples(0.3));
  mixInto(
    arriveSamples,
    renderTone({
      frequencyHz: midiToFrequency(76),
      lengthSeconds: 0.18,
      decayRate: 30,
      attackSeconds: 0.006,
    }),
    0,
    0.7,
  );
  mixInto(
    arriveSamples,
    renderTone({
      frequencyHz: midiToFrequency(81),
      lengthSeconds: 0.24,
      decayRate: 26,
      attackSeconds: 0.006,
    }),
    0.06,
    0.6,
  );
  return arriveSamples;
}

/** Success: a warm two-note chime that rises a fourth. */
export function renderSuccessSound(): Float32Array {
  const successSamples = new Float32Array(secondsToSamples(1));
  mixInto(
    successSamples,
    renderTone({
      frequencyHz: midiToFrequency(72),
      attackSeconds: 0.008,
      lengthSeconds: 0.9,
      decayRate: 7,
      overtoneGain: 0.12,
    }),
    0,
    0.6,
  );
  mixInto(
    successSamples,
    renderTone({
      frequencyHz: midiToFrequency(76),
      attackSeconds: 0.008,
      lengthSeconds: 0.85,
      decayRate: 6,
      overtoneGain: 0.12,
    }),
    0.09,
    0.7,
  );
  return successSamples;
}

/** Error: two soft low tones falling, rounded so it never sounds harsh. */
export function renderErrorSound(): Float32Array {
  const errorSamples = new Float32Array(secondsToSamples(0.5));
  const lowpass = new BiquadFilter("lowpass", 0.7);
  mixInto(
    errorSamples,
    renderTone({
      frequencyHz: 392,
      lengthSeconds: 0.18,
      decayRate: 14,
      overtoneGain: 0.25,
    }),
    0,
    0.7,
  );
  mixInto(
    errorSamples,
    renderTone({
      frequencyHz: 311,
      lengthSeconds: 0.3,
      decayRate: 10,
      overtoneGain: 0.25,
    }),
    0.14,
    0.75,
  );
  return errorSamples.map((sampleValue) => lowpass.process(sampleValue, 1800));
}

type KeystrokeSpec = {
  clickCutoffHz: number;
  thockFrequencyHz: number;
};

/** The four key sounds typing takes turns on, slightly different keys. */
export const keystrokeSpecs: KeystrokeSpec[] = [
  { clickCutoffHz: 2200, thockFrequencyHz: 180 },
  { clickCutoffHz: 2600, thockFrequencyHz: 200 },
  { clickCutoffHz: 1900, thockFrequencyHz: 165 },
  { clickCutoffHz: 2400, thockFrequencyHz: 190 },
];

/** One soft key press: a muted click and a low thock, no sharp highs. */
export function renderKeystrokeSound(
  keystrokeSpec: KeystrokeSpec,
): Float32Array {
  const keystrokeSamples = new Float32Array(secondsToSamples(0.07));
  const click = renderNoiseSweep(random, {
    lengthSeconds: 0.03,
    filterKind: "bandpass",
    getCutoffHz: () => keystrokeSpec.clickCutoffHz,
    getLoudness: (progress) => Math.exp(-progress * 7),
  });
  const thock = renderTone({
    frequencyHz: keystrokeSpec.thockFrequencyHz,
    lengthSeconds: 0.06,
    decayRate: 70,
  });
  mixInto(keystrokeSamples, click, 0, 0.7);
  mixInto(keystrokeSamples, thock, 0, 0.6);
  return keystrokeSamples;
}

/** The calm notes event sounds take turns on (G4, A4, C5, D5, E5). */
export const fireNotes = [67, 69, 72, 74, 76];

/**
 * An event lights up: a soft, low, rounded note like a gentle marimba drop.
 * Slow attack, pure tone, no high overtone, so a run of them stays calm.
 */
export function renderFireSound(midiNote: number): Float32Array {
  return renderTone({
    frequencyHz: midiToFrequency(midiNote),
    lengthSeconds: 0.6,
    decayRate: 7,
    overtoneGain: 0.05,
    attackSeconds: 0.012,
  });
}

/** A page slides in: a quick swipe of air that falls in pitch. */
export function renderPageSound(): Float32Array {
  return renderNoiseSweep(random, {
    lengthSeconds: 0.36,
    filterKind: "bandpass",
    getCutoffHz: (progress) => 3200 * 2 ** (-progress * 1.8),
    getLoudness: (progress) =>
      Math.min(1, progress * 6) * Math.exp(-progress * 4),
  });
}

/** A scene transition: a soft whoosh that peaks in the middle, where the scenes swap. */
export function renderWhooshSound(lengthSeconds: number): Float32Array {
  const whooshSamples = renderNoiseSweep(random, {
    lengthSeconds,
    filterKind: "bandpass",
    getCutoffHz: (progress) => 400 + 2600 * Math.sin(progress * Math.PI),
    getLoudness: (progress) => Math.sin(progress * Math.PI) ** 2,
  });
  const swell = renderTone({ frequencyHz: 90, lengthSeconds, decayRate: 0 });
  swell.forEach((sampleValue, sampleIndex) => {
    swell[sampleIndex] =
      sampleValue * Math.sin((sampleIndex / swell.length) * Math.PI) ** 2;
  });
  mixInto(whooshSamples, swell, 0, 0.25);
  return whooshSamples;
}

/** The logo lands: a soft low thump and a bright arpeggiated chime. */
export function renderRevealSound(): Float32Array {
  const revealSamples = new Float32Array(secondsToSamples(2.4));
  mixInto(
    revealSamples,
    renderTone({
      frequencyHz: 70,
      toFrequencyHz: 46,
      lengthSeconds: 0.9,
      decayRate: 5,
    }),
    0,
    0.9,
  );
  [72, 76, 79, 84].forEach((midiNote, noteIndex) => {
    const chime = renderTone({
      frequencyHz: midiToFrequency(midiNote),
      lengthSeconds: 2,
      decayRate: 2.6,
      overtoneGain: 0.1,
    });
    mixInto(revealSamples, chime, 0.03 + noteIndex * 0.07, 0.32);
  });
  return revealSamples;
}
