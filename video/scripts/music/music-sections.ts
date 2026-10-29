import { videoFps } from "../../src/brand";
import type { TrailerScene } from "../../src/trailer/sendmock-trailer";

/** How full the music is under a scene (docs/plan/23, Music). */
export type MusicEnergy =
  "intro" | "groove" | "lift" | "breakdown" | "drop" | "outro";

export type MusicSection = {
  sceneName: string;
  energy: MusicEnergy;
  /** The exact moment of the cut, for one-off hits. */
  cutSeconds: number;
  /** The cut moved to the nearest beat, for the groove. */
  beatStartSeconds: number;
  endSeconds: number;
};

export const beatSeconds = 0.5;
const crossfadeFrames = 14;

const energyBySceneName: Record<string, MusicEnergy> = {
  opening: "intro",
  email: "groove",
  sms: "groove",
  payment: "groove",
  "any-api": "groove",
  "built-in": "lift",
  events: "lift",
  "build-your-own": "groove",
  ai: "breakdown",
  "app-tour": "drop",
  platforms: "drop",
  closing: "outro",
};

/** One section per scene, timed from the trailer's own scene list. */
export function buildMusicSections(scenes: TrailerScene[]): MusicSection[] {
  let sceneStartFrame = 0;
  return scenes.map((trailerScene) => {
    const cutFrame = sceneStartFrame;
    sceneStartFrame += trailerScene.durationFrames - crossfadeFrames;
    const cutSeconds = cutFrame / videoFps;
    return {
      sceneName: trailerScene.sceneName,
      energy: energyBySceneName[trailerScene.sceneName] ?? "groove",
      cutSeconds,
      beatStartSeconds: Math.round(cutSeconds / beatSeconds) * beatSeconds,
      endSeconds: (cutFrame + trailerScene.durationFrames) / videoFps,
    };
  });
}

export type Chord = {
  chordName: string;
  padNotes: number[];
  bassNote: number;
};

/** A minor: Am9, Fmaj7, Cadd9, G6, one chord per bar. */
export const chordLoop: Chord[] = [
  { chordName: "Am9", padNotes: [57, 60, 64, 67, 71], bassNote: 33 },
  { chordName: "Fmaj7", padNotes: [53, 57, 60, 64], bassNote: 29 },
  { chordName: "Cadd9", padNotes: [55, 60, 62, 64], bassNote: 36 },
  { chordName: "G6", padNotes: [55, 59, 62, 64], bassNote: 31 },
];

export const finalChord: Chord = {
  chordName: "Cmaj9",
  padNotes: [48, 55, 59, 62, 64],
  bassNote: 36,
};

/** Which chord tone each sixteenth of a bar plays in the arpeggio. */
export const arpeggioToneIndexes = [
  0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 4, 3, 2, 1, 2,
];

export type LeadNote = {
  midiNote: number;
  startBeat: number;
  lengthBeats: number;
};

/** A four-bar lead melody for the drop, one bar per chord of the loop. */
export const leadMelodyBars: LeadNote[][] = [
  [
    { midiNote: 76, startBeat: 0, lengthBeats: 1.5 },
    { midiNote: 74, startBeat: 1.5, lengthBeats: 0.5 },
    { midiNote: 72, startBeat: 2, lengthBeats: 1 },
    { midiNote: 71, startBeat: 3, lengthBeats: 1 },
  ],
  [
    { midiNote: 72, startBeat: 0, lengthBeats: 1.5 },
    { midiNote: 69, startBeat: 1.5, lengthBeats: 0.5 },
    { midiNote: 72, startBeat: 2, lengthBeats: 0.5 },
    { midiNote: 76, startBeat: 2.5, lengthBeats: 1.5 },
  ],
  [
    { midiNote: 79, startBeat: 0, lengthBeats: 2 },
    { midiNote: 76, startBeat: 2, lengthBeats: 2 },
  ],
  [
    { midiNote: 74, startBeat: 0, lengthBeats: 1 },
    { midiNote: 76, startBeat: 1, lengthBeats: 1 },
    { midiNote: 74, startBeat: 2, lengthBeats: 1 },
    { midiNote: 71, startBeat: 3, lengthBeats: 1 },
  ],
];

/** A minor pentatonic, high, for the event bells. */
export const bellNotes = [81, 84, 86, 88, 91, 93];
