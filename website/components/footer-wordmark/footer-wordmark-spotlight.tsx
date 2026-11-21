"use client";

import { useRef } from "react";

import type { DownloadSources } from "@/lib/download-activity/download-sources";
import { cn } from "@/lib/utils";

import styles from "./footer-wordmark.module.css";
import {
  wordmarkViewBoxHeight,
  wordmarkViewBoxWidth,
} from "./sendmock-wordmark-path";
import { useDownloadActivityGraph } from "./use-download-activity-graph";
import { usePointerSpotlight } from "./use-pointer-spotlight";
import { WordmarkPlaceholder } from "./wordmark-placeholder";

/**
 * The word drawn only as squares on a canvas, the way a contribution graph draws its days: no
 * solid letter behind them, so no smooth edge shows past the stepped squares and the gaps show
 * the page. Until the canvas has drawn, a placeholder in the HTML shows the same squares. The box keeps the word's proportions at every width; the spotlight variables live
 * on it, and nothing here is sized for the light.
 */
export function FooterWordmarkSpotlight({
  buildSources,
}: {
  buildSources: DownloadSources;
}) {
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePointerSpotlight(wordmarkRef);
  useDownloadActivityGraph({ canvasRef, wordmarkRef, buildSources });

  return (
    <div
      ref={wordmarkRef}
      aria-hidden
      data-footer-wordmark=""
      className={cn(styles.spotlight, styles.levels, "relative w-full")}
      style={{
        aspectRatio: `${wordmarkViewBoxWidth} / ${wordmarkViewBoxHeight}`,
      }}
    >
      <div
        className={cn(styles.reveal, "pointer-events-none absolute inset-0")}
      >
        <canvas ref={canvasRef} className={styles.activityCanvas} />
        <WordmarkPlaceholder className={styles.placeholder} />
      </div>
    </div>
  );
}
