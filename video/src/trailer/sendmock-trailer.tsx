import { fade } from "@remotion/transitions/fade";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { ComponentType } from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";

import { fontFamily } from "../brand";

import { trailerPalette } from "./trailer-palette";
import { TrailerBackdrop } from "./parts/trailer-backdrop";
import { AiScene, aiSceneDurationFrames } from "./scenes/ai/ai-scene";
import {
  AnyApiScene,
  anyApiSceneDurationFrames,
} from "./scenes/any-api/any-api-scene";
import {
  BuildYourOwnScene,
  buildYourOwnSceneDurationFrames,
} from "./scenes/build-your-own/build-your-own-scene";
import {
  BuiltInScene,
  builtInSceneDurationFrames,
} from "./scenes/built-in/built-in-scene";
import {
  ClosingScene,
  closingSceneDurationFrames,
} from "./scenes/closing-scene";
import {
  EmailScene,
  emailSceneDurationFrames,
} from "./scenes/email/email-scene";
import {
  EventsScene,
  eventsSceneDurationFrames,
} from "./scenes/events/events-scene";
import {
  OpeningScene,
  openingSceneDurationFrames,
} from "./scenes/opening-scene";
import {
  PaymentScene,
  paymentSceneDurationFrames,
} from "./scenes/payment/payment-scene";
import {
  PlatformsScene,
  platformsSceneDurationFrames,
} from "./scenes/platforms/platforms-scene";
import { SmsScene, smsSceneDurationFrames } from "./scenes/sms/sms-scene";

export type TrailerScene = {
  sceneName: string;
  Scene: ComponentType;
  durationFrames: number;
};

/** The scenes in order (docs/plan/23-promotional-video.md, The scenes). */
export const trailerScenes: TrailerScene[] = [
  {
    sceneName: "opening",
    Scene: OpeningScene,
    durationFrames: openingSceneDurationFrames,
  },
  {
    sceneName: "email",
    Scene: EmailScene,
    durationFrames: emailSceneDurationFrames,
  },
  { sceneName: "sms", Scene: SmsScene, durationFrames: smsSceneDurationFrames },
  {
    sceneName: "payment",
    Scene: PaymentScene,
    durationFrames: paymentSceneDurationFrames,
  },
  {
    sceneName: "any-api",
    Scene: AnyApiScene,
    durationFrames: anyApiSceneDurationFrames,
  },
  {
    sceneName: "built-in",
    Scene: BuiltInScene,
    durationFrames: builtInSceneDurationFrames,
  },
  {
    sceneName: "events",
    Scene: EventsScene,
    durationFrames: eventsSceneDurationFrames,
  },
  {
    sceneName: "build-your-own",
    Scene: BuildYourOwnScene,
    durationFrames: buildYourOwnSceneDurationFrames,
  },
  { sceneName: "ai", Scene: AiScene, durationFrames: aiSceneDurationFrames },
  {
    sceneName: "platforms",
    Scene: PlatformsScene,
    durationFrames: platformsSceneDurationFrames,
  },
  {
    sceneName: "closing",
    Scene: ClosingScene,
    durationFrames: closingSceneDurationFrames,
  },
];

const crossfadeFrames = 14;

/** Total length: the scenes minus the overlap of each crossfade. */
export function getTrailerDurationFrames(scenes: TrailerScene[]): number {
  return (
    scenes.reduce(
      (total, trailerScene) => total + trailerScene.durationFrames,
      0,
    ) -
    crossfadeFrames * (scenes.length - 1)
  );
}

export const sendMockTrailerDurationFrames =
  getTrailerDurationFrames(trailerScenes);

/** The SendMock promotional trailer. */
export function SendMockTrailer() {
  return (
    <TrailerFilm
      scenes={trailerScenes}
      musicPath="music/sendmock-trailer.mp3"
    />
  );
}

type TrailerFilmProps = {
  scenes: TrailerScene[];
  /** The composed track in public/ (`bun run music`). */
  musicPath: string;
};

/** Plays the scenes in order with crossfades, over one drifting backdrop. */
export function TrailerFilm({ scenes, musicPath }: TrailerFilmProps) {
  return (
    <AbsoluteFill style={{ fontFamily, color: trailerPalette.text }}>
      <TrailerBackdrop />
      <Audio src={staticFile(musicPath)} />
      <TransitionSeries>
        {scenes.flatMap((trailerScene, sceneIndex) => {
          const sceneSequence = (
            <TransitionSeries.Sequence
              key={trailerScene.sceneName}
              durationInFrames={trailerScene.durationFrames}
            >
              <trailerScene.Scene />
            </TransitionSeries.Sequence>
          );
          if (sceneIndex === 0) {
            return [sceneSequence];
          }
          return [
            <TransitionSeries.Transition
              key={`${trailerScene.sceneName}-transition`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: crossfadeFrames })}
            />,
            sceneSequence,
          ];
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
