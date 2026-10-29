import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";

import { videoHeight, videoWidth } from "../../brand";

/**
 * Scene transitions (docs/plan/23-promotional-video.md, Transitions and
 * motion). None of them crossfades: the outgoing scene leaves as the incoming
 * one arrives, so two layouts never sit on top of each other.
 */
export type SceneTransitionKind = "pushLeft" | "pushUp" | "zoomThrough" | "cut";

export const transitionDurationFrames: Record<SceneTransitionKind, number> = {
  pushLeft: 20,
  pushUp: 20,
  zoomThrough: 22,
  cut: 0,
};

type NoTransitionProps = Record<string, never>;
type PresentationProps =
  TransitionPresentationComponentProps<NoTransitionProps>;

/** Blur is strongest in the middle of a push, where the move is fastest. */
function getMotionBlurPx(progress: number): number {
  return Math.sin(progress * Math.PI) * 10;
}

function PushPresentation({
  children,
  presentationDirection,
  presentationProgress,
  axis,
}: PresentationProps & { axis: "x" | "y" }) {
  const distancePx = axis === "x" ? videoWidth : videoHeight;
  const offsetPx =
    presentationDirection === "entering"
      ? (1 - presentationProgress) * distancePx
      : -presentationProgress * distancePx;
  const style: CSSProperties = {
    transform:
      axis === "x" ? `translateX(${offsetPx}px)` : `translateY(${offsetPx}px)`,
    filter: `blur(${getMotionBlurPx(presentationProgress)}px)`,
  };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
}

function PushLeftPresentation(props: PresentationProps) {
  return <PushPresentation {...props} axis="x" />;
}

function PushUpPresentation(props: PresentationProps) {
  return <PushPresentation {...props} axis="y" />;
}

/** The outgoing scene flies at the camera and dissolves; the next one settles in. */
function ZoomThroughPresentation({
  children,
  presentationDirection,
  presentationProgress,
}: PresentationProps) {
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  if (presentationDirection === "exiting") {
    const exitProgress = interpolate(presentationProgress, [0, 0.5], [0, 1], {
      ...clamp,
      easing: Easing.in(Easing.cubic),
    });
    return (
      <AbsoluteFill
        style={{
          opacity: 1 - exitProgress,
          transform: `scale(${1 + exitProgress * 0.6})`,
          filter: `blur(${exitProgress * 18}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }
  const enterProgress = interpolate(presentationProgress, [0.5, 1], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const bloomOpacity = interpolate(
    presentationProgress,
    [0.3, 0.5, 0.8],
    [0, 0.55, 0],
    clamp,
  );
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: enterProgress,
          transform: `scale(${0.88 + enterProgress * 0.12})`,
          filter: `blur(${(1 - enterProgress) * 16}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: bloomOpacity,
          background:
            "radial-gradient(55% 55% at 50% 50%, rgba(124, 207, 189, 0.35), rgba(13, 148, 136, 0.08) 60%, transparent 80%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}

const presentationComponents = {
  pushLeft: PushLeftPresentation,
  pushUp: PushUpPresentation,
  zoomThrough: ZoomThroughPresentation,
};

export function getScenePresentation(
  transitionKind: Exclude<SceneTransitionKind, "cut">,
): TransitionPresentation<NoTransitionProps> {
  return { component: presentationComponents[transitionKind], props: {} };
}

/** The speed ramp every transition uses: slow out, fast through the middle, slow in. */
export const transitionEasing = Easing.inOut(Easing.cubic);
