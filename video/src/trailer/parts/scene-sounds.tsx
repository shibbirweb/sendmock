import { Audio, Sequence, staticFile } from "remotion";

import { getKeystrokeFrames, type UiCue, type UiCueKind } from "../ui-cues";
import { toVideoFrames } from "../trailer-time";

/** How loud each sound plays: soft overall, outcomes a little forward. */
const cueVolumes: Record<UiCueKind, number> = {
  click: 0.45,
  appear: 0.22,
  send: 0.3,
  arrive: 0.3,
  success: 0.4,
  error: 0.4,
  typing: 0.28,
  fire: 0.1,
  page: 0.32,
  reveal: 0.5,
  whoosh: 0.3,
};

/**
 * Repeated sounds take turns on a few variants in a loose pattern, so a run
 * of them sounds natural instead of one sample repeating: five calm notes for
 * events, four key sounds for typing.
 */
const fireVariantPattern = [1, 3, 2, 4, 3, 5, 2, 4];
const keyVariantPattern = [1, 3, 2, 4, 2, 1, 4, 3];

type SoundEvent = {
  frame: number;
  fileName: string;
  volume: number;
  /** How long the sound stays mounted; a little longer than the sound itself. */
  durationFrames: number;
};

const keySoundFrames = 4;
const otherSoundFrames = 75;

/** Turns a scene's cues into the sounds to play; typing becomes one key per character. */
function getSoundEvents(cues: UiCue[]): SoundEvent[] {
  let fireCount = 0;
  let keyCount = 0;
  return cues.flatMap((uiCue): SoundEvent[] => {
    const volume = cueVolumes[uiCue.cueKind];
    if (uiCue.cueKind === "typing") {
      return getKeystrokeFrames(uiCue).map((keystrokeFrame) => {
        const variant = keyVariantPattern[keyCount % keyVariantPattern.length];
        keyCount += 1;
        return {
          frame: uiCue.frame + keystrokeFrame,
          fileName: `key-${variant ?? 1}`,
          volume: volume * (keyCount % 3 === 0 ? 0.8 : 1),
          durationFrames: keySoundFrames,
        };
      });
    }
    if (uiCue.cueKind === "fire") {
      const variant = fireVariantPattern[fireCount % fireVariantPattern.length];
      fireCount += 1;
      return [
        {
          frame: uiCue.frame,
          fileName: `fire-${variant ?? 1}`,
          volume,
          durationFrames: otherSoundFrames,
        },
      ];
    }
    return [
      {
        frame: uiCue.frame,
        fileName: uiCue.cueKind,
        volume,
        durationFrames: otherSoundFrames,
      },
    ];
  });
}

type SceneSoundsProps = {
  cues: UiCue[];
};

/** Plays a scene's UI sounds (public/sounds, `bun run sounds`) on its cues. */
export function SceneSounds({ cues }: SceneSoundsProps) {
  return (
    <>
      {getSoundEvents(cues).map((soundEvent, soundIndex) => (
        <Sequence
          key={`${soundEvent.fileName}-${soundEvent.frame}-${soundIndex}`}
          from={toVideoFrames(soundEvent.frame)}
          durationInFrames={toVideoFrames(soundEvent.durationFrames)}
          layout="none"
        >
          <Audio
            src={staticFile(`sounds/${soundEvent.fileName}.wav`)}
            volume={soundEvent.volume}
          />
        </Sequence>
      ))}
    </>
  );
}
