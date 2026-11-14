import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { ComponentType } from "react";
import { AbsoluteFill } from "remotion";

import { fontFamily } from "../brand";

import { trailerPalette } from "./trailer-palette";
import type { UiCue } from "./ui-cues";
import { SceneCamera } from "./parts/scene-camera";
import { SceneSounds } from "./parts/scene-sounds";
import {
  getScenePresentation,
  type SceneTransitionKind,
  transitionDurationFrames,
  transitionEasing,
} from "./parts/scene-transitions";
import { TrailerBackdrop } from "./parts/trailer-backdrop";
import {
  AiScene,
  aiSceneCues,
  aiSceneDurationFrames,
} from "./scenes/ai/ai-scene";
import {
  AnyApiScene,
  anyApiSceneCues,
  anyApiSceneDurationFrames,
} from "./scenes/any-api/any-api-scene";
import {
  BuildYourOwnScene,
  buildYourOwnSceneCues,
  buildYourOwnSceneDurationFrames,
} from "./scenes/build-your-own/build-your-own-scene";
import {
  BuiltInScene,
  builtInSceneCues,
  builtInSceneDurationFrames,
} from "./scenes/built-in/built-in-scene";
import {
  ClosingScene,
  closingSceneCues,
  closingSceneDurationFrames,
} from "./scenes/closing-scene";
import {
  EmailScene,
  emailSceneCues,
  emailSceneDurationFrames,
} from "./scenes/email/email-scene";
import {
  EventsScene,
  eventsSceneCues,
  eventsSceneDurationFrames,
} from "./scenes/events/events-scene";
import {
  OpeningScene,
  openingSceneCues,
  openingSceneDurationFrames,
} from "./scenes/opening-scene";
import {
  PaymentScene,
  paymentSceneCues,
  paymentSceneDurationFrames,
} from "./scenes/payment/payment-scene";
import {
  PlatformsScene,
  platformsSceneCues,
  platformsSceneDurationFrames,
} from "./scenes/platforms/platforms-scene";
import {
  SmsScene,
  smsSceneCues,
  smsSceneDurationFrames,
} from "./scenes/sms/sms-scene";
import { toVideoFrames } from "./trailer-time";

export type TrailerScene = {
  sceneName: string;
  Scene: ComponentType;
  durationFrames: number;
  /** How this scene takes over from the one before it. */
  transitionIn: SceneTransitionKind;
  /** Moments the music answers, in scene frames. */
  cues: UiCue[];
};

/** The scenes in order (docs/plan/23-promotional-video.md, The scenes). */
export const trailerScenes: TrailerScene[] = [
  {
    sceneName: "opening",
    Scene: OpeningScene,
    durationFrames: openingSceneDurationFrames,
    transitionIn: "cut",
    cues: openingSceneCues,
  },
  {
    sceneName: "email",
    Scene: EmailScene,
    durationFrames: emailSceneDurationFrames,
    transitionIn: "zoomThrough",
    cues: emailSceneCues,
  },
  {
    sceneName: "sms",
    Scene: SmsScene,
    durationFrames: smsSceneDurationFrames,
    transitionIn: "pushLeft",
    cues: smsSceneCues,
  },
  {
    sceneName: "payment",
    Scene: PaymentScene,
    durationFrames: paymentSceneDurationFrames,
    transitionIn: "pushLeft",
    cues: paymentSceneCues,
  },
  {
    sceneName: "any-api",
    Scene: AnyApiScene,
    durationFrames: anyApiSceneDurationFrames,
    transitionIn: "pushLeft",
    cues: anyApiSceneCues,
  },
  {
    sceneName: "built-in",
    Scene: BuiltInScene,
    durationFrames: builtInSceneDurationFrames,
    transitionIn: "zoomThrough",
    cues: builtInSceneCues,
  },
  {
    sceneName: "events",
    Scene: EventsScene,
    durationFrames: eventsSceneDurationFrames,
    transitionIn: "pushUp",
    cues: eventsSceneCues,
  },
  {
    sceneName: "build-your-own",
    Scene: BuildYourOwnScene,
    durationFrames: buildYourOwnSceneDurationFrames,
    transitionIn: "pushUp",
    cues: buildYourOwnSceneCues,
  },
  {
    sceneName: "ai",
    Scene: AiScene,
    durationFrames: aiSceneDurationFrames,
    transitionIn: "zoomThrough",
    cues: aiSceneCues,
  },
  {
    sceneName: "platforms",
    Scene: PlatformsScene,
    durationFrames: platformsSceneDurationFrames,
    transitionIn: "zoomThrough",
    cues: platformsSceneCues,
  },
  {
    sceneName: "closing",
    Scene: ClosingScene,
    durationFrames: closingSceneDurationFrames,
    transitionIn: "cut",
    cues: closingSceneCues,
  },
];

/** The frame each scene starts on: transitions overlap the scene before. */
export function getSceneStartFrames(scenes: TrailerScene[]): number[] {
  let nextStartFrame = 0;
  return scenes.map((trailerScene, sceneIndex) => {
    const overlapFrames =
      sceneIndex === 0
        ? 0
        : transitionDurationFrames[trailerScene.transitionIn];
    const sceneStartFrame = nextStartFrame - overlapFrames;
    nextStartFrame = sceneStartFrame + trailerScene.durationFrames;
    return sceneStartFrame;
  });
}

/** Total length: the scenes minus the overlap of each transition. */
export function getTrailerDurationFrames(scenes: TrailerScene[]): number {
  const startFrames = getSceneStartFrames(scenes);
  const lastIndex = scenes.length - 1;
  return (
    (startFrames[lastIndex] ?? 0) + (scenes[lastIndex]?.durationFrames ?? 0)
  );
}

type TrailerFilmProps = {
  scenes: TrailerScene[];
};

/** A scene's own cues, plus a whoosh while it takes over from the last scene. */
function getSceneCues(trailerScene: TrailerScene, sceneIndex: number): UiCue[] {
  if (sceneIndex === 0 || trailerScene.transitionIn === "cut") {
    return trailerScene.cues;
  }
  return [{ frame: 0, cueKind: "whoosh" }, ...trailerScene.cues];
}

/** Plays the scenes in order through their transitions, with their sounds. */
export function TrailerFilm({ scenes }: TrailerFilmProps) {
  return (
    <AbsoluteFill style={{ fontFamily, color: trailerPalette.text }}>
      <TrailerBackdrop />
      <TransitionSeries>
        {scenes.flatMap((trailerScene, sceneIndex) => {
          const sceneSequence = (
            <TransitionSeries.Sequence
              key={trailerScene.sceneName}
              durationInFrames={toVideoFrames(trailerScene.durationFrames)}
            >
              <SceneCamera durationFrames={trailerScene.durationFrames}>
                <trailerScene.Scene />
              </SceneCamera>
              <SceneSounds cues={getSceneCues(trailerScene, sceneIndex)} />
            </TransitionSeries.Sequence>
          );
          if (sceneIndex === 0 || trailerScene.transitionIn === "cut") {
            return [sceneSequence];
          }
          return [
            <TransitionSeries.Transition
              key={`${trailerScene.sceneName}-transition`}
              presentation={getScenePresentation(trailerScene.transitionIn)}
              timing={linearTiming({
                durationInFrames: toVideoFrames(
                  transitionDurationFrames[trailerScene.transitionIn],
                ),
                easing: transitionEasing,
              })}
            />,
            sceneSequence,
          ];
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
