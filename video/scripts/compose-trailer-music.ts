import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { videoFps } from "../src/brand";
import {
  getTrailerDurationFrames,
  type TrailerScene,
  trailerScenes,
} from "../src/trailer/sendmock-trailer";
import { tourScenes } from "../src/trailer/sendmock-trailer-tour";
import { arrangeTrailerMusic } from "./music/arrange-trailer";
import { buildMusicSections } from "./music/music-sections";
import { writeStereoWav } from "./music/wav-writer";

/**
 * Composes original music for each trailer from its own scene list
 * (docs/plan/23-promotional-video.md, Music). No samples or recordings are
 * used, so the track needs no licence. Run again after scene lengths change.
 */
type MusicTarget = {
  fileName: string;
  scenes: TrailerScene[];
};

const musicTargets: MusicTarget[] = [
  { fileName: "sendmock-trailer", scenes: trailerScenes },
  { fileName: "sendmock-trailer-tour", scenes: tourScenes },
];

const outputDirectory = path.resolve("public/music");

async function encodeMp3(wavPath: string, mp3Path: string) {
  const encoder = Bun.spawn(
    [
      "bunx",
      "remotion",
      "ffmpeg",
      "-y",
      "-loglevel",
      "error",
      "-i",
      wavPath,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      mp3Path,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await encoder.exited;
  if (exitCode !== 0) {
    throw new Error(`ffmpeg failed with exit code ${exitCode} for ${wavPath}`);
  }
}

await mkdir(outputDirectory, { recursive: true });
for (const musicTarget of musicTargets) {
  const totalSeconds = getTrailerDurationFrames(musicTarget.scenes) / videoFps;
  const sections = buildMusicSections(musicTarget.scenes);
  const masterBuffer = arrangeTrailerMusic(sections, totalSeconds);
  const wavPath = path.join(outputDirectory, `${musicTarget.fileName}.wav`);
  const mp3Path = path.join(outputDirectory, `${musicTarget.fileName}.mp3`);
  await writeStereoWav(wavPath, masterBuffer);
  await encodeMp3(wavPath, mp3Path);
  await rm(wavPath);
  console.log(
    `composed ${musicTarget.fileName}.mp3 (${totalSeconds.toFixed(1)} s)`,
  );
}
