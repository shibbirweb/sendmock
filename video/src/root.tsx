import { Composition } from "remotion";

import { videoFps, videoHeight, videoWidth } from "./brand";
import {
  SendMockTrailer,
  sendMockTrailerDurationFrames,
} from "./trailer/sendmock-trailer";
import {
  SendMockTrailerTour,
  sendMockTrailerTourDurationFrames,
  SendMockTrailerTourPlatforms,
} from "./trailer/sendmock-trailer-tour";
import { toVideoFrames } from "./trailer/trailer-time";

/** Registers the video's compositions. */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="SendMockTrailer"
        component={SendMockTrailer}
        durationInFrames={toVideoFrames(sendMockTrailerDurationFrames)}
        fps={videoFps}
        width={videoWidth}
        height={videoHeight}
      />
      <Composition
        id="SendMockTrailerTour"
        component={SendMockTrailerTour}
        durationInFrames={toVideoFrames(sendMockTrailerTourDurationFrames)}
        fps={videoFps}
        width={videoWidth}
        height={videoHeight}
      />
      <Composition
        id="SendMockTrailerTourPlatforms"
        component={SendMockTrailerTourPlatforms}
        durationInFrames={toVideoFrames(sendMockTrailerTourDurationFrames)}
        fps={videoFps}
        width={videoWidth}
        height={videoHeight}
      />
    </>
  );
}
