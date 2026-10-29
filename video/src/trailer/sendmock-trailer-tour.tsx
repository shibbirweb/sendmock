import {
  AppTourScene,
  appTourSceneCues,
  appTourSceneDurationFrames,
} from "./scenes/app-tour/app-tour-scene";
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
