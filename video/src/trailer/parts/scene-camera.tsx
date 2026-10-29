import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** How far the camera pushes in and drifts over a scene. */
export const cameraPushScale = 1.03;
export const cameraDriftPx = 6;

type SceneCameraProps = {
  durationFrames: number;
  children: ReactNode;
};

/** A slow camera push and drift over the whole scene, so no frame is still. */
export function SceneCamera({ durationFrames, children }: SceneCameraProps) {
  const frame = useCurrentFrame();
  const pushScale = interpolate(
    frame,
    [0, durationFrames],
    [1, cameraPushScale],
  );
  const driftXPx = interpolate(
    frame,
    [0, durationFrames],
    [cameraDriftPx, -cameraDriftPx],
  );

  return (
    <AbsoluteFill
      style={{ transform: `translateX(${driftXPx}px) scale(${pushScale})` }}
    >
      {children}
    </AbsoluteFill>
  );
}
