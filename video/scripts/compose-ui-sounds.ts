import { mkdir } from "node:fs/promises";
import path from "node:path";

import { videoFps } from "../src/brand";
import { transitionDurationFrames } from "../src/trailer/parts/scene-transitions";
import { normaliseSound } from "./sounds/audio-buffer";
import {
  renderAppearSound,
  renderArriveSound,
  renderClickSound,
  renderErrorSound,
  fireNotes,
  renderFireSound,
  renderPageSound,
  renderRevealSound,
  renderSendSound,
  renderSuccessSound,
  keystrokeSpecs,
  renderKeystrokeSound,
  renderWhooshSound,
} from "./sounds/ui-sound-voices";
import { writeMonoWav } from "./sounds/wav-writer";

/**
 * Writes the trailer's UI sound effects into public/sounds
 * (docs/plan/23-promotional-video.md, Sound effects). Every sound is
 * synthesized here, with no samples or recordings, so none needs a licence.
 */
const whooshLengthSeconds = transitionDurationFrames.zoomThrough / videoFps;

const uiSounds: Record<string, () => Float32Array> = {
  click: renderClickSound,
  appear: renderAppearSound,
  send: renderSendSound,
  arrive: renderArriveSound,
  success: renderSuccessSound,
  error: renderErrorSound,
  page: renderPageSound,
  whoosh: () => renderWhooshSound(whooshLengthSeconds),
  reveal: renderRevealSound,
  ...Object.fromEntries(
    keystrokeSpecs.map((keystrokeSpec, keyIndex) => [
      `key-${keyIndex + 1}`,
      () => renderKeystrokeSound(keystrokeSpec),
    ]),
  ),
  ...Object.fromEntries(
    fireNotes.map((midiNote, noteIndex) => [
      `fire-${noteIndex + 1}`,
      () => renderFireSound(midiNote),
    ]),
  ),
};

const outputDirectory = path.resolve("public/sounds");
await mkdir(outputDirectory, { recursive: true });
for (const [soundName, renderSound] of Object.entries(uiSounds)) {
  const soundSamples = renderSound();
  normaliseSound(soundSamples, 0.8);
  await writeMonoWav(
    path.join(outputDirectory, `${soundName}.wav`),
    soundSamples,
  );
  console.log(`wrote ${soundName}.wav`);
}
