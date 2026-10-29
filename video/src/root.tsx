import { Composition } from "remotion";

import { videoFps, videoHeight, videoWidth } from "./brand";
import {
  sendMockTrailerTourDurationFrames,
  SendMockTrailerTourConnections,
} from "./trailer/sendmock-trailer-tour";
import { toVideoFrames } from "./trailer/trailer-time";

/** Registers the video's composition. */
export function RemotionRoot() {
  return (
    <Composition
      id="SendMockTrailerTourConnections"
      component={SendMockTrailerTourConnections}
      durationInFrames={toVideoFrames(sendMockTrailerTourDurationFrames)}
      fps={videoFps}
      width={videoWidth}
      height={videoHeight}
    />
  );
}
