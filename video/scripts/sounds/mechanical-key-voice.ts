import {
  createSeededRandom,
  mixInto,
  sampleRate,
  secondsToSamples,
} from "./audio-buffer";
import { BiquadFilter, type FilterKind } from "./biquad-filter";

/**
 * One key of a mechanical keyboard. A press is several events, not one
 * click: the switch clicks, the keycap bottoms out on the plate and the case
 * rings low for a moment (the "thock"), then the key springs back with a
 * quieter click (docs/plan/23-promotional-video.md, Mechanical typing).
 */
export type MechanicalKeySpec = {
  /** Centre of the switch's click. */
  clickFrequencyHz: number;
  /** Centre of the keycap knocking on the plate. */
  knockFrequencyHz: number;
  /** The case's short low resonance. */
  bodyFrequencyHz: number;
  /** From the click to the bottom-out. */
  bottomOutDelaySeconds: number;
  /** From the click to the key coming back up. */
  releaseDelaySeconds: number;
  /** How loud the release is next to the press. */
  releaseGain: number;
};

/** Six slightly different keys, so fast typing never repeats one sample. */
export const mechanicalKeySpecs: MechanicalKeySpec[] = [
  {
    clickFrequencyHz: 3600,
    knockFrequencyHz: 1500,
    bodyFrequencyHz: 330,
    bottomOutDelaySeconds: 0.01,
    releaseDelaySeconds: 0.09,
    releaseGain: 0.8,
  },
  {
    clickFrequencyHz: 3900,
    knockFrequencyHz: 1650,
    bodyFrequencyHz: 360,
    bottomOutDelaySeconds: 0.008,
    releaseDelaySeconds: 0.082,
    releaseGain: 0.7,
  },
  {
    clickFrequencyHz: 3400,
    knockFrequencyHz: 1400,
    bodyFrequencyHz: 300,
    bottomOutDelaySeconds: 0.011,
    releaseDelaySeconds: 0.098,
    releaseGain: 0.85,
  },
  {
    clickFrequencyHz: 3750,
    knockFrequencyHz: 1550,
    bodyFrequencyHz: 345,
    bottomOutDelaySeconds: 0.009,
    releaseDelaySeconds: 0.086,
    releaseGain: 0.75,
  },
  {
    clickFrequencyHz: 3300,
    knockFrequencyHz: 1350,
    bodyFrequencyHz: 285,
    bottomOutDelaySeconds: 0.012,
    releaseDelaySeconds: 0.105,
    releaseGain: 0.9,
  },
  {
    clickFrequencyHz: 4000,
    knockFrequencyHz: 1700,
    bodyFrequencyHz: 375,
    bottomOutDelaySeconds: 0.0085,
    releaseDelaySeconds: 0.078,
    releaseGain: 0.65,
  },
];

/** Everything above this is rolled off, so the clicks stay crisp but never sharp. */
const softenAboveHz = 7000;

/**
 * How loud each part is in the mix. The resonant clicks pass little of the
 * noise, so they need more gain to stand next to the case's thock.
 */
const keyMixLevels = {
  switchClick: 6,
  keycapKnock: 3,
  caseThock: 0.35,
  caseOvertone: 0.12,
  releaseClick: 1.3,
  releaseBody: 0.12,
};

const random = createSeededRandom(2187);

type ResonantBurstSpec = {
  filterKind: FilterKind;
  centreHz: number;
  /** Higher rings more narrowly around the centre. */
  resonance: number;
  lengthSeconds: number;
  decayRate: number;
};

/** A tiny burst of noise through a resonant filter: a click or a knock. */
function renderResonantBurst(burstSpec: ResonantBurstSpec): Float32Array {
  const burstSamples = new Float32Array(
    secondsToSamples(burstSpec.lengthSeconds),
  );
  const filter = new BiquadFilter(burstSpec.filterKind, burstSpec.resonance);
  for (
    let sampleIndex = 0;
    sampleIndex < burstSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    burstSamples[sampleIndex] =
      filter.process(random() * 2 - 1, burstSpec.centreHz) *
      Math.exp(-timeSeconds * burstSpec.decayRate);
  }
  return burstSamples;
}

/** A short decaying resonance of the case or the keycap. */
function renderBodyMode(
  frequencyHz: number,
  lengthSeconds: number,
  decayRate: number,
): Float32Array {
  const modeSamples = new Float32Array(secondsToSamples(lengthSeconds));
  for (
    let sampleIndex = 0;
    sampleIndex < modeSamples.length;
    sampleIndex += 1
  ) {
    const timeSeconds = sampleIndex / sampleRate;
    const attack = Math.min(1, timeSeconds / 0.001);
    modeSamples[sampleIndex] =
      Math.sin(2 * Math.PI * frequencyHz * timeSeconds) *
      attack *
      Math.exp(-timeSeconds * decayRate);
  }
  return modeSamples;
}

function softenHighs(soundSamples: Float32Array) {
  const filter = new BiquadFilter("lowpass");
  soundSamples.forEach((sampleValue, sampleIndex) => {
    soundSamples[sampleIndex] = filter.process(sampleValue, softenAboveHz);
  });
}

/** One full key press and release. */
export function renderMechanicalKeySound(
  keySpec: MechanicalKeySpec,
): Float32Array {
  const keySamples = new Float32Array(
    secondsToSamples(keySpec.releaseDelaySeconds + 0.06),
  );
  const switchClick = renderResonantBurst({
    filterKind: "bandpass",
    centreHz: keySpec.clickFrequencyHz,
    resonance: 4,
    lengthSeconds: 0.012,
    decayRate: 600,
  });
  const keycapKnock = renderResonantBurst({
    filterKind: "bandpass",
    centreHz: keySpec.knockFrequencyHz,
    resonance: 2.2,
    lengthSeconds: 0.03,
    decayRate: 180,
  });
  const releaseClick = renderResonantBurst({
    filterKind: "bandpass",
    centreHz: keySpec.clickFrequencyHz * 0.85,
    resonance: 3,
    lengthSeconds: 0.015,
    decayRate: 400,
  });
  mixInto(keySamples, switchClick, 0, keyMixLevels.switchClick);
  mixInto(
    keySamples,
    keycapKnock,
    keySpec.bottomOutDelaySeconds,
    keyMixLevels.keycapKnock,
  );
  mixInto(
    keySamples,
    renderBodyMode(keySpec.bodyFrequencyHz, 0.06, 75),
    keySpec.bottomOutDelaySeconds,
    keyMixLevels.caseThock,
  );
  mixInto(
    keySamples,
    renderBodyMode(keySpec.bodyFrequencyHz * 2.3, 0.03, 160),
    keySpec.bottomOutDelaySeconds,
    keyMixLevels.caseOvertone,
  );
  mixInto(
    keySamples,
    releaseClick,
    keySpec.releaseDelaySeconds,
    keyMixLevels.releaseClick * keySpec.releaseGain,
  );
  mixInto(
    keySamples,
    renderBodyMode(keySpec.bodyFrequencyHz * 1.4, 0.03, 140),
    keySpec.releaseDelaySeconds,
    keyMixLevels.releaseBody * keySpec.releaseGain,
  );
  softenHighs(keySamples);
  return keySamples;
}
