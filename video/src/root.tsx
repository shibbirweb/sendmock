import { Composition } from "remotion";

import { videoFps, videoHeight, videoWidth } from "./brand";
import {
  SendMockTrailer,
  sendMockTrailerDurationFrames,
} from "./trailer/sendmock-trailer";
import {
  SendMockTrailerTour,
  sendMockTrailerTourDurationFrames,
} from "./trailer/sendmock-trailer-tour";

/** Registers the video's compositions. */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="SendMockTrailer"
        component={SendMockTrailer}
        durationInFrames={sendMockTrailerDurationFrames}
        fps={videoFps}
        width={videoWidth}
        height={videoHeight}
      />
      <Composition
        id="SendMockTrailerTour"
        component={SendMockTrailerTour}
        durationInFrames={sendMockTrailerTourDurationFrames}
        fps={videoFps}
        width={videoWidth}
        height={videoHeight}
      />
    </>
  );
}
