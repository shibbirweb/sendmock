import {
  addMonoSound,
  addStereoSound,
  createSeededRandom,
  createStereoBuffer,
  secondsToSamples,
  type StereoBuffer,
} from "./audio-buffer";
import {
  renderClap,
  renderHat,
  renderImpact,
  renderKick,
  renderRiser,
} from "./drum-voices";
import type { EnergyLevel } from "./music-energy-levels";
import type { Chord } from "./music-sections";
import {
  renderBass,
  renderBell,
  renderLead,
  renderPad,
  renderPluck,
} from "./synth-voices";

export type MusicBuses = {
  drums: StereoBuffer;
  music: StereoBuffer;
  effects: StereoBuffer;
  reverbSend: StereoBuffer;
  delaySend: StereoBuffer;
  kickTimesSeconds: number[];
};

export type DrumHitKind = "closedHat" | "openHat" | "clap";

/** Places notes and hits onto the mix buses, with their effect sends. */
export class MusicArranger {
  readonly buses: MusicBuses;
  private readonly random = createSeededRandom(1042);
  private readonly kickSound: Float32Array;
  private readonly drumHitSounds: Record<DrumHitKind, Float32Array>;
  private readonly pluckCache = new Map<string, Float32Array>();

  constructor(totalSeconds: number) {
    const totalSamples = secondsToSamples(totalSeconds);
    this.buses = {
      drums: createStereoBuffer(totalSamples),
      music: createStereoBuffer(totalSamples),
      effects: createStereoBuffer(totalSamples),
      reverbSend: createStereoBuffer(totalSamples),
      delaySend: createStereoBuffer(totalSamples),
      kickTimesSeconds: [],
    };
    this.kickSound = renderKick(this.random);
    this.drumHitSounds = {
      closedHat: renderHat(this.random, false),
      openHat: renderHat(this.random, true),
      clap: renderClap(this.random),
    };
  }

  /** The seeded random source, so the same script writes the same track. */
  nextRandom(): number {
    return this.random();
  }

  addKick(timeSeconds: number, gain: number) {
    addMonoSound(this.buses.drums, this.kickSound, timeSeconds, gain);
    this.buses.kickTimesSeconds.push(timeSeconds);
  }

  addDrumHit(
    drumHitKind: DrumHitKind,
    timeSeconds: number,
    gain: number,
    pan = 0,
  ) {
    const drumHitSound = this.drumHitSounds[drumHitKind];
    addMonoSound(this.buses.drums, drumHitSound, timeSeconds, gain, pan);
    if (drumHitKind === "clap") {
      addMonoSound(
        this.buses.reverbSend,
        drumHitSound,
        timeSeconds,
        gain * 0.4,
      );
    }
  }

  addRiser(endSeconds: number, lengthSeconds: number, gain: number) {
    const riserSound = renderRiser(this.random, lengthSeconds);
    const startSeconds = endSeconds - lengthSeconds;
    addMonoSound(this.buses.effects, riserSound, startSeconds, gain);
    addMonoSound(this.buses.reverbSend, riserSound, startSeconds, gain * 0.5);
  }

  addImpact(timeSeconds: number, gain: number) {
    const impactSound = renderImpact(this.random);
    addMonoSound(this.buses.effects, impactSound, timeSeconds, gain);
    addMonoSound(this.buses.reverbSend, impactSound, timeSeconds, gain * 0.6);
    this.addDrumHit("openHat", timeSeconds, 0.2, 0.3);
  }

  addBell(midiNote: number, timeSeconds: number, gain: number, pan = 0) {
    const bellSound = renderBell(midiNote);
    addMonoSound(this.buses.music, bellSound, timeSeconds, gain, pan);
    addMonoSound(
      this.buses.reverbSend,
      bellSound,
      timeSeconds,
      gain * 0.8,
      pan,
    );
  }

  addPluckNote(
    midiNote: number,
    timeSeconds: number,
    brightness: number,
    gain: number,
    pan = 0,
  ) {
    const cacheKey = `${midiNote}-${brightness}`;
    const pluckSound =
      this.pluckCache.get(cacheKey) ?? renderPluck(midiNote, brightness);
    this.pluckCache.set(cacheKey, pluckSound);
    addMonoSound(this.buses.music, pluckSound, timeSeconds, gain, pan);
    addMonoSound(
      this.buses.delaySend,
      pluckSound,
      timeSeconds,
      gain * 0.6,
      pan,
    );
    addMonoSound(
      this.buses.reverbSend,
      pluckSound,
      timeSeconds,
      gain * 0.25,
      pan,
    );
  }

  addLeadNote(midiNote: number, startSeconds: number, lengthSeconds: number) {
    const leadSound = renderLead(midiNote, lengthSeconds);
    addMonoSound(this.buses.music, leadSound, startSeconds, 0.13, 0.1);
    addMonoSound(this.buses.delaySend, leadSound, startSeconds, 0.06, 0.1);
    addMonoSound(this.buses.reverbSend, leadSound, startSeconds, 0.08);
  }

  addPad(
    chord: Chord,
    startSeconds: number,
    lengthSeconds: number,
    level: EnergyLevel,
  ) {
    const padSound = renderPad(
      chord.padNotes,
      lengthSeconds,
      level.padCutoffHz,
    );
    addStereoSound(this.buses.music, padSound, startSeconds, level.padGain);
    addStereoSound(
      this.buses.reverbSend,
      padSound,
      startSeconds,
      level.padGain * 0.5,
    );
  }

  addSustainedBass(
    midiNote: number,
    startSeconds: number,
    lengthSeconds: number,
    gain: number,
  ) {
    const bassSound = renderBass(midiNote, lengthSeconds);
    addMonoSound(this.buses.music, bassSound, startSeconds, gain);
  }
}
