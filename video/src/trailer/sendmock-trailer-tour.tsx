import {
  AppTourScene,
  appTourSceneCues,
  appTourSceneDurationFrames,
} from "./scenes/app-tour/app-tour-scene";
import { ClosingScene } from "./scenes/closing-scene";
import { PlatformsScene } from "./scenes/platforms/platforms-scene";
import {
  getTrailerDurationFrames,
  TrailerFilm,
  type TrailerScene,
  trailerScenes,
} from "./sendmock-trailer";

function PlatformsSceneAfterTour() {
  return <PlatformsScene chapterLabel="10 · Everywhere" />;
}

/**
 * The trailer with an app tour after the AI prompts
 * (docs/plan/23-promotional-video.md, Version with an app tour).
 */
export const tourScenes: TrailerScene[] = trailerScenes.flatMap(
  (trailerScene): TrailerScene[] => {
    if (trailerScene.sceneName === "ai") {
      return [
        trailerScene,
        {
          sceneName: "app-tour",
          Scene: AppTourScene,
          durationFrames: appTourSceneDurationFrames,
          transitionIn: "zoomThrough",
          cues: appTourSceneCues,
        },
      ];
    }
    if (trailerScene.sceneName === "platforms") {
      return [
        {
          ...trailerScene,
          Scene: PlatformsSceneAfterTour,
          transitionIn: "pushUp",
        },
      ];
    }
    return [trailerScene];
  },
);

export const sendMockTrailerTourDurationFrames =
  getTrailerDurationFrames(tourScenes);

/** The SendMock trailer with a glance at the app's real pages. */
export function SendMockTrailerTour() {
  return <TrailerFilm scenes={tourScenes} />;
}

function ClosingSceneWithPlatforms() {
  return <ClosingScene barContent="platforms" />;
}

/**
 * The tour cut with a closing bar that names every platform instead of one
 * install command (docs/plan/23-promotional-video.md, Version with every
 * platform at the close).
 */
export const tourScenesWithPlatforms: TrailerScene[] = tourScenes.map(
  (trailerScene): TrailerScene =>
    trailerScene.sceneName === "closing"
      ? { ...trailerScene, Scene: ClosingSceneWithPlatforms }
      : trailerScene,
);

/** A copy of the tour cut whose closing card shows every platform. */
export function SendMockTrailerTourPlatforms() {
  return <TrailerFilm scenes={tourScenesWithPlatforms} />;
}
