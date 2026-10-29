import type { MusicEnergy } from "./music-sections";

/** How bright and loud each layer plays at one energy. */
export type EnergyLevel = {
  arpBrightness: number;
  arpGain: number;
  padCutoffHz: number;
  padGain: number;
  bassGain: number;
  kickGain: number;
};

export const energyLevels: Record<MusicEnergy, EnergyLevel> = {
  intro: {
    arpBrightness: 0.3,
    arpGain: 0.12,
    padCutoffHz: 900,
    padGain: 0.2,
    bassGain: 0.3,
    kickGain: 0.5,
  },
  groove: {
    arpBrightness: 0.45,
    arpGain: 0.16,
    padCutoffHz: 1300,
    padGain: 0.2,
    bassGain: 0.32,
    kickGain: 0.55,
  },
  lift: {
    arpBrightness: 0.75,
    arpGain: 0.18,
    padCutoffHz: 2000,
    padGain: 0.23,
    bassGain: 0.36,
    kickGain: 0.7,
  },
  breakdown: {
    arpBrightness: 0.22,
    arpGain: 0.11,
    padCutoffHz: 850,
    padGain: 0.22,
    bassGain: 0.22,
    kickGain: 0,
  },
  drop: {
    arpBrightness: 0.95,
    arpGain: 0.2,
    padCutoffHz: 2600,
    padGain: 0.25,
    bassGain: 0.4,
    kickGain: 0.8,
  },
  outro: {
    arpBrightness: 0.4,
    arpGain: 0.12,
    padCutoffHz: 1800,
    padGain: 0.3,
    bassGain: 0.3,
    kickGain: 0,
  },
};
