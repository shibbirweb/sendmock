import type { MusicArranger } from "./music-arranger";
import { type EnergyLevel, energyLevels } from "./music-energy-levels";
import {
  arpeggioToneIndexes,
  beatSeconds,
  bellNotes,
  type Chord,
  chordLoop,
  leadMelodyBars,
  type MusicEnergy,
} from "./music-sections";

/** One beat of the groove, counted from the groove's first beat. */
export function arrangeGrooveBeat(
  arranger: MusicArranger,
  beatTimeSeconds: number,
  beatNumber: number,
  energy: MusicEnergy,
  isSparkling: boolean,
) {
  const level = energyLevels[energy];
  const beatInBar = beatNumber % 4;
  const barNumber = Math.floor(beatNumber / 4);
  const chord = chordLoop[barNumber % chordLoop.length];
  if (chord === undefined) {
    return;
  }
  if (beatInBar === 0) {
    arranger.addPad(chord, beatTimeSeconds, 4 * beatSeconds, level);
    if (energy === "drop") {
      addLeadBar(arranger, barNumber, beatTimeSeconds);
    }
  }
  addDrums(arranger, beatTimeSeconds, beatInBar, energy, level);
  addBass(arranger, chord, beatTimeSeconds, energy, level);
  addArpeggio(arranger, chord, beatTimeSeconds, beatInBar, energy, level);
  if (isSparkling) {
    addSparkles(arranger, beatTimeSeconds);
  }
}

/** Groove: kick on 1 and 3 with off-beat hats. Lift and drop: four on the floor, claps, more hats. */
function addDrums(
  arranger: MusicArranger,
  beatTimeSeconds: number,
  beatInBar: number,
  energy: MusicEnergy,
  level: EnergyLevel,
) {
  const offBeatSeconds = beatTimeSeconds + beatSeconds / 2;
  if (energy === "groove") {
    if (beatInBar % 2 === 0) {
      arranger.addKick(beatTimeSeconds, level.kickGain);
    }
    arranger.addDrumHit("closedHat", offBeatSeconds, 0.16, 0.25);
    return;
  }
  if (energy !== "lift" && energy !== "drop") {
    return;
  }
  arranger.addKick(beatTimeSeconds, level.kickGain);
  if (beatInBar % 2 === 1) {
    arranger.addDrumHit("clap", beatTimeSeconds, 0.28, -0.1);
  }
  arranger.addDrumHit("openHat", offBeatSeconds, 0.12, 0.3);
  [0.25, 0.75].forEach((sixteenthOffset) => {
    const hatSeconds = beatTimeSeconds + sixteenthOffset * beatSeconds;
    arranger.addDrumHit("closedHat", hatSeconds, 0.08, -0.3);
  });
}

/** Pumping eighth notes, or one long note per beat in the breakdown. */
function addBass(
  arranger: MusicArranger,
  chord: Chord,
  beatTimeSeconds: number,
  energy: MusicEnergy,
  level: EnergyLevel,
) {
  if (energy === "breakdown") {
    arranger.addSustainedBass(
      chord.bassNote,
      beatTimeSeconds,
      beatSeconds,
      level.bassGain,
    );
    return;
  }
  const noteLengthSeconds = beatSeconds * 0.42;
  arranger.addSustainedBass(
    chord.bassNote,
    beatTimeSeconds,
    noteLengthSeconds,
    level.bassGain,
  );
  arranger.addSustainedBass(
    chord.bassNote,
    beatTimeSeconds + beatSeconds / 2,
    noteLengthSeconds,
    level.bassGain * 0.8,
  );
}

/** The plucked arpeggio: sixteenths, or eighths in the breakdown. */
function addArpeggio(
  arranger: MusicArranger,
  chord: Chord,
  beatTimeSeconds: number,
  beatInBar: number,
  energy: MusicEnergy,
  level: EnergyLevel,
) {
  const sixteenthsInBeat = energy === "breakdown" ? [0, 2] : [0, 1, 2, 3];
  for (const sixteenth of sixteenthsInBeat) {
    const toneIndex = arpeggioToneIndexes[beatInBar * 4 + sixteenth] ?? 0;
    const midiNote =
      (chord.padNotes[toneIndex % chord.padNotes.length] ?? 60) + 12;
    const accent = sixteenth === 0 ? 1 : 0.75;
    const pan = sixteenth % 2 === 0 ? -0.35 : 0.35;
    const noteSeconds = beatTimeSeconds + (sixteenth * beatSeconds) / 4;
    arranger.addPluckNote(
      midiNote,
      noteSeconds,
      level.arpBrightness,
      level.arpGain * accent,
      pan,
    );
  }
}

function addLeadBar(
  arranger: MusicArranger,
  barNumber: number,
  barStartSeconds: number,
) {
  const leadBar = leadMelodyBars[barNumber % leadMelodyBars.length] ?? [];
  for (const leadNote of leadBar) {
    const noteStartSeconds = barStartSeconds + leadNote.startBeat * beatSeconds;
    arranger.addLeadNote(
      leadNote.midiNote,
      noteStartSeconds,
      leadNote.lengthBeats * beatSeconds,
    );
  }
}

/** Small bells on random sixteenths while the events fire. */
function addSparkles(arranger: MusicArranger, beatTimeSeconds: number) {
  for (let sixteenth = 0; sixteenth < 4; sixteenth += 1) {
    if (arranger.nextRandom() < 0.3) {
      const bellIndex = Math.floor(arranger.nextRandom() * bellNotes.length);
      const bellSeconds = beatTimeSeconds + (sixteenth * beatSeconds) / 4;
      const pan = arranger.nextRandom() * 1.4 - 0.7;
      arranger.addBell(bellNotes[bellIndex] ?? 84, bellSeconds, 0.07, pan);
    }
  }
}
