import { easeToward } from "@/lib/download-activity/ease-toward";

/** How far, in pixels, the light reaches past the letters; the word sits at the page's foot. */
export const reachAbovePx = 72;
export const reachBesidePx = 56;
export const reachBelowPx = 28;
/** The graph's brightness with the pointer over the letters. */
export const maximumSpotlightOpacity = 0.9;
const opacityEaseMs = 380;
const positionSettlePx = 0.5;
const opacitySettle = 0.002;

/** The circle's centre, in the wordmark's own box, and how lit it is. */
export type SpotlightState = { x: number; y: number; opacity: number };

/** 0 over the letters, 1 at the edge of reach, more beyond it: one radial falloff. */
function measureOutsideReach(
  wordmarkBox: DOMRect,
  pointerX: number,
  pointerY: number,
): number {
  const outsideX =
    Math.max(wordmarkBox.left - pointerX, 0, pointerX - wordmarkBox.right) /
    reachBesidePx;
  const outsideY =
    pointerY < wordmarkBox.top
      ? (wordmarkBox.top - pointerY) / reachAbovePx
      : Math.max(pointerY - wordmarkBox.bottom, 0) / reachBelowPx;
  return Math.hypot(outsideX, outsideY);
}

/**
 * Where the spotlight is heading: full brightness over the letters, fading across the reach.
 * Out of reach, the circle stays where the pointer left it and only fades.
 */
export function findSpotlightTarget(
  wordmarkBox: DOMRect,
  pointerX: number,
  pointerY: number,
  shown: SpotlightState,
): SpotlightState {
  const opacity =
    Math.max(0, 1 - measureOutsideReach(wordmarkBox, pointerX, pointerY)) *
    maximumSpotlightOpacity;
  const isInReach = opacity > 0;
  return {
    x: isInReach ? pointerX - wordmarkBox.left : shown.x,
    y: isInReach ? pointerY - wordmarkBox.top : shown.y,
    opacity,
  };
}

/**
 * Moves `shown` one frame toward `target` and returns whether it has settled. While dark,
 * the circle jumps, so it never visibly slides in from where it was.
 */
export function stepSpotlight(
  shown: SpotlightState,
  target: SpotlightState,
  elapsedMs: number,
  circleEaseMs: number,
): boolean {
  const easeMs = shown.opacity < opacitySettle ? 0 : circleEaseMs;
  shown.x = easeToward(shown.x, target.x, elapsedMs, easeMs);
  shown.y = easeToward(shown.y, target.y, elapsedMs, easeMs);
  shown.opacity = easeToward(
    shown.opacity,
    target.opacity,
    elapsedMs,
    opacityEaseMs,
  );
  const isSettled =
    Math.abs(shown.x - target.x) < positionSettlePx &&
    Math.abs(shown.y - target.y) < positionSettlePx &&
    Math.abs(shown.opacity - target.opacity) < opacitySettle;
  if (isSettled) {
    Object.assign(shown, target);
  }
  return isSettled;
}
