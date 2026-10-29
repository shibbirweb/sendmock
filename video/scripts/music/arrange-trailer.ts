import { videoFps } from "../../src/brand";
import { openingCueFrames } from "../../src/trailer/scenes/opening-scene";
import { createStereoBuffer, mixInto, type StereoBuffer } from "./audio-buffer";
import { arrangeGrooveBeat } from "./groove-beat";
import { MusicArranger } from "./music-arranger";
import { energyLevels } from "./music-energy-levels";
import {
  applyKickDucking,
  finishMaster,
  renderPingPongDelay,
  renderReverb,
} from "./mix-effects";
import {
  beatSeconds,
  chordLoop,
  finalChord,
  type MusicSection,
} from "./music-sections";

const openingWordNotes = [69, 72, 76, 79];

/** The opening: a hit per word, a riser under the promise, the logo lands. */
function arrangeOpening(arranger: MusicArranger, openingSection: MusicSection) {
  openingCueFrames.channelWordFrames.forEach((wordFrame, wordIndex) => {
    const wordSeconds = wordFrame / videoFps;
    arranger.addKick(wordSeconds, 0.45);
    arranger.addBell(openingWordNotes[wordIndex] ?? 69, wordSeconds, 0.16);
    arranger.addPluckNote(
      (openingWordNotes[wordIndex] ?? 69) - 12,
      wordSeconds,
      0.6,
      0.18,
    );
  });
  const promiseSeconds = openingCueFrames.localhostLineFrame / videoFps;
  const logoSeconds = openingCueFrames.logoFrame / videoFps;
  const firstChord = chordLoop[0];
  const thirdChord = chordLoop[2];
  if (firstChord === undefined || thirdChord === undefined) {
    return;
  }
  arranger.addPad(firstChord, promiseSeconds, logoSeconds - promiseSeconds, {
    ...energyLevels.intro,
    padGain: 0.16,
  });
  arranger.addRiser(logoSeconds, logoSeconds - promiseSeconds, 0.22);
  arranger.addImpact(logoSeconds, 0.5);
  arranger.addPad(
    thirdChord,
    logoSeconds,
    openingSection.endSeconds - logoSeconds,
    { ...energyLevels.intro, padCutoffHz: 2000, padGain: 0.24 },
  );
  arranger.addSustainedBass(
    thirdChord.bassNote,
    logoSeconds,
    openingSection.endSeconds - logoSeconds,
    0.3,
  );
}

/** The close: an impact, the final chord, a thinning arpeggio and bells. */
function arrangeOutro(
  arranger: MusicArranger,
  outroSection: MusicSection,
  totalSeconds: number,
) {
  const outroSeconds = outroSection.cutSeconds;
  const holdSeconds = totalSeconds - outroSeconds;
  arranger.addImpact(outroSeconds, 0.45);
  arranger.addPad(finalChord, outroSeconds, holdSeconds, energyLevels.outro);
  arranger.addSustainedBass(
    finalChord.bassNote,
    outroSeconds,
    Math.min(4, holdSeconds),
    0.28,
  );
  [76, 79, 84].forEach((bellNote, bellIndex) => {
    arranger.addBell(
      bellNote,
      outroSeconds + bellIndex * beatSeconds,
      0.15,
      bellIndex - 1,
    );
  });
  for (let eighth = 0; eighth < 12; eighth += 1) {
    const toneNote =
      (finalChord.padNotes[eighth % finalChord.padNotes.length] ?? 60) + 24;
    const fadingGain = 0.12 * (1 - eighth / 12);
    arranger.addPluckNote(
      toneNote,
      outroSeconds + 1 + (eighth * beatSeconds) / 2,
      0.4,
      fadingGain,
      eighth % 2 === 0 ? -0.4 : 0.4,
    );
  }
}

/** The riser or lift that leads into a section, ending exactly on its cut. */
function arrangeTransitionInto(
  arranger: MusicArranger,
  section: MusicSection,
  previousSection: MusicSection | undefined,
) {
  if (previousSection === undefined) {
    return;
  }
  if (section.energy === "drop" && previousSection.energy !== "drop") {
    arranger.addRiser(section.cutSeconds, 4, 0.3);
    arranger.addImpact(section.cutSeconds, 0.5);
  } else if (section.energy === "lift" && previousSection.energy === "groove") {
    arranger.addRiser(section.beatStartSeconds, 1.5, 0.22);
  }
}

/** Arranges the whole track for one composition and mixes it to stereo. */
export function arrangeTrailerMusic(
  sections: MusicSection[],
  totalSeconds: number,
): StereoBuffer {
  const arranger = new MusicArranger(totalSeconds);
  const grooveStartSeconds = sections[1]?.beatStartSeconds ?? 0;
  sections.forEach((section, sectionIndex) => {
    const previousSection = sections[sectionIndex - 1];
    const nextSection = sections[sectionIndex + 1];
    arrangeTransitionInto(arranger, section, previousSection);
    if (section.energy === "intro") {
      arrangeOpening(arranger, section);
      return;
    }
    if (section.energy === "outro") {
      arrangeOutro(arranger, section, totalSeconds);
      return;
    }
    const sectionEndSeconds =
      nextSection?.energy === "outro"
        ? nextSection.cutSeconds
        : (nextSection?.beatStartSeconds ?? totalSeconds);
    for (
      let beatTimeSeconds = section.beatStartSeconds;
      beatTimeSeconds < sectionEndSeconds - 0.01;
      beatTimeSeconds += beatSeconds
    ) {
      const beatNumber = Math.round(
        (beatTimeSeconds - grooveStartSeconds) / beatSeconds,
      );
      arrangeGrooveBeat(
        arranger,
        beatTimeSeconds,
        beatNumber,
        section.energy,
        section.sceneName === "events",
      );
    }
  });
  return mixBuses(arranger, totalSeconds);
}

function mixBuses(arranger: MusicArranger, totalSeconds: number): StereoBuffer {
  const { buses } = arranger;
  applyKickDucking(buses.music, buses.kickTimesSeconds, 0.35);
  const masterBuffer = createStereoBuffer(buses.music.left.length);
  mixInto(masterBuffer, buses.drums, 0.9);
  mixInto(masterBuffer, buses.music, 1);
  mixInto(masterBuffer, buses.effects, 1);
  mixInto(masterBuffer, renderReverb(buses.reverbSend), 1);
  mixInto(
    masterBuffer,
    renderPingPongDelay(buses.delaySend, beatSeconds * 0.75, 0.35),
    0.4,
  );
  finishMaster(masterBuffer, Math.min(3.5, totalSeconds / 10));
  return masterBuffer;
}
