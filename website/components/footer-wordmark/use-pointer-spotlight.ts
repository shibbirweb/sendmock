"use client";

import { type RefObject, useEffect } from "react";

import {
  findSpotlightTarget,
  type SpotlightState,
  stepSpotlight,
} from "./spotlight-motion";

const positionEaseMs = 120;
const longestFrameMs = 100;

function writeSpotlight(wordmark: HTMLElement, shown: SpotlightState) {
  wordmark.style.setProperty("--pointer-x", `${shown.x}px`);
  wordmark.style.setProperty("--pointer-y", `${shown.y}px`);
  wordmark.style.setProperty("--spotlight-opacity", `${shown.opacity}`);
}

/**
 * Lights the wordmark as the pointer comes near it, not only over it. One window
 * `pointermove` listener, read once per frame, writes `--pointer-x`, `--pointer-y` (in the
 * wordmark's own box) and `--spotlight-opacity` to `wordmarkRef`; both layers inherit them.
 * The values ease toward the pointer and the frame loop stops once they settle; when the
 * pointer leaves, the light fades out where it was. Reduced motion moves the circle without
 * easing. Touch screens attach no listener.
 */
export function usePointerSpotlight(
  wordmarkRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const wordmark = wordmarkRef.current;
    if (
      !wordmark ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }
    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const circleEaseMs = shouldReduceMotion ? 0 : positionEaseMs;
    const shown: SpotlightState = { x: 0, y: 0, opacity: 0 };
    const pointer = { x: 0, y: 0 };
    let frameId = 0;
    let lastFrameMs = 0;

    const paintFrame = (nowMs: number) => {
      const elapsedMs = lastFrameMs
        ? Math.min(nowMs - lastFrameMs, longestFrameMs)
        : 16;
      lastFrameMs = nowMs;
      const target = findSpotlightTarget(
        wordmark.getBoundingClientRect(),
        pointer.x,
        pointer.y,
        shown,
      );
      const isSettled = stepSpotlight(shown, target, elapsedMs, circleEaseMs);
      writeSpotlight(wordmark, shown);
      frameId = isSettled ? 0 : requestAnimationFrame(paintFrame);
      lastFrameMs = isSettled ? 0 : lastFrameMs;
    };

    const followPointer = (pointerEvent: PointerEvent) => {
      pointer.x = pointerEvent.clientX;
      pointer.y = pointerEvent.clientY;
      if (!frameId) {
        frameId = requestAnimationFrame(paintFrame);
      }
    };

    window.addEventListener("pointermove", followPointer);
    return () => {
      window.removeEventListener("pointermove", followPointer);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [wordmarkRef]);
}
