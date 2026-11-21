"use client";

import { type RefObject, useEffect } from "react";

import { ActivityGraph } from "@/lib/download-activity/activity-graph";
import {
  buildDownloadDays,
  type DownloadDay,
  mergeDownloadSources,
} from "@/lib/download-activity/download-days";
import type { DownloadSources } from "@/lib/download-activity/download-sources";
import { watchLiveDownloads } from "@/lib/download-activity/watch-live-downloads";

import {
  wordmarkPathData,
  wordmarkViewBoxHeight,
  wordmarkViewBoxWidth,
} from "./sendmock-wordmark-path";

/** Lays out the graph a little before the footer scrolls into view, never during page start-up. */
const prepareMargin = "600px 0px";

type DownloadActivityGraphOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  wordmarkRef: RefObject<HTMLElement | null>;
  buildSources: DownloadSources;
};

/** The shown days, as data on the canvas: what the squares mean, for tests and the curious. */
function describeDays(canvas: HTMLCanvasElement, downloadDays: DownloadDay[]) {
  canvas.dataset.downloadDays = JSON.stringify(downloadDays);
}

/**
 * Draws the build's download days once the footer nears the screen, then fades onto the live
 * numbers when the browser has them (`watchLiveDownloads`).
 */
export function useDownloadActivityGraph({
  canvasRef,
  wordmarkRef,
  buildSources,
}: DownloadActivityGraphOptions) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const wordmark = wordmarkRef.current;
    if (!canvas || !wordmark) {
      return;
    }
    let activityGraph: ActivityGraph | null = null;
    let stopWatching = () => {};

    const startGraph = () => {
      const buildDays = buildDownloadDays(buildSources, new Date());
      describeDays(canvas, buildDays);
      activityGraph = ActivityGraph.start({
        canvas,
        spotlight: wordmark,
        letterPathData: wordmarkPathData,
        viewBoxWidth: wordmarkViewBoxWidth,
        viewBoxHeight: wordmarkViewBoxHeight,
        dayLevels: buildDays.map((downloadDay) => downloadDay.level),
      });
      stopWatching = watchLiveDownloads(wordmark, (liveSources) => {
        const liveDays = buildDownloadDays(
          mergeDownloadSources(buildSources, liveSources),
          new Date(),
        );
        describeDays(canvas, liveDays);
        activityGraph?.showDayLevels(
          liveDays.map((downloadDay) => downloadDay.level),
        );
      });
    };

    const footerObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        footerObserver.disconnect();
        startGraph();
      },
      { rootMargin: prepareMargin },
    );
    footerObserver.observe(canvas);

    return () => {
      footerObserver.disconnect();
      stopWatching();
      activityGraph?.stop();
    };
  }, [canvasRef, wordmarkRef, buildSources]);
}
