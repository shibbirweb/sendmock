import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";

const clampBoth = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const easeOut = Easing.out(Easing.cubic);

/** 0 to 1 over `durationFrames` from `startFrame`, eased out, clamped. */
export function getProgress(
  frame: number,
  startFrame: number,
  durationFrames: number,
): number {
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    ...clampBoth,
    easing: easeOut,
  });
}

/** Rises in through a small blur, no overshoot (Look and feel > Motion). */
export function getRiseInStyle(
  frame: number,
  startFrame: number,
  durationFrames = 15,
  riseDistancePx = 18,
): CSSProperties {
  const progress = getProgress(frame, startFrame, durationFrames);
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * riseDistancePx}px)`,
    filter: progress < 1 ? `blur(${(1 - progress) * 8}px)` : undefined,
  };
}

/** Fades from 1 to 0 over `durationFrames` from `startFrame`. */
export function getFadeOutOpacity(
  frame: number,
  startFrame: number,
  durationFrames = 10,
): number {
  return 1 - getProgress(frame, startFrame, durationFrames);
}

/** The part of `text` typed so far, at 13 characters a second. */
export function getTypedText(
  text: string,
  frame: number,
  startFrame: number,
  charactersPerFrame = 13 / 30,
): string {
  const typedCount = Math.floor((frame - startFrame) * charactersPerFrame);
  if (typedCount <= 0) {
    return "";
  }
  return text.slice(0, typedCount);
}

/** Frames needed to type `text` at the same speed as `getTypedText`. */
export function getTypingDurationFrames(
  text: string,
  charactersPerFrame = 13 / 30,
): number {
  return Math.ceil(text.length / charactersPerFrame);
}

/** Index of the last step whose start frame has passed, or -1. */
export function getActiveStepIndex(
  frame: number,
  stepStartFrames: number[],
): number {
  let activeIndex = -1;
  stepStartFrames.forEach((startFrame, index) => {
    if (frame >= startFrame) {
      activeIndex = index;
    }
  });
  return activeIndex;
}
