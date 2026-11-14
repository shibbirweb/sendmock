import { useCurrentFrame } from "remotion";

import { designFps, videoFps } from "../brand";

const videoFramesPerDesignFrame = videoFps / designFps;

/**
 * The time in design frames (30 to a second), fractional between them, so
 * every animation moves on each rendered frame whatever the video's fps.
 */
export function useDesignFrame(): number {
  return useCurrentFrame() / videoFramesPerDesignFrame;
}

/** A design frame count as the video frames Remotion counts. */
export function toVideoFrames(designFrames: number): number {
  return Math.round(designFrames * videoFramesPerDesignFrame);
}
