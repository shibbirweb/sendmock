import { Composition, Still } from "remotion";

import { videoFps, videoHeight, videoWidth } from "./brand";
import {
  SendMockTrailerMechanicalTyping,
  sendMockTrailerTourDurationFrames,
} from "./trailer/sendmock-trailer-tour";
import {
  thumbnailHeight,
  thumbnailWidth,
  YoutubeThumbnail,
} from "./thumbnail/youtube-thumbnail";
import { toVideoFrames } from "./trailer/trailer-time";

/** Registers the video's compositions. */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="SendMockTrailerMechanicalTyping"
        component={SendMockTrailerMechanicalTyping}
        durationInFrames={toVideoFrames(sendMockTrailerTourDurationFrames)}
        fps={videoFps}
        width={videoWidth}
        height={videoHeight}
      />
      <Still
        id="SendMockYoutubeThumbnail"
        component={YoutubeThumbnail}
        width={thumbnailWidth}
        height={thumbnailHeight}
      />
    </>
  );
}
