import { useId } from "react";

import {
  activityCellCorner,
  activityCellFill,
  activityCellPitch,
  measureActivityGrid,
} from "@/lib/download-activity/activity-field";

import {
  wordmarkPathData,
  wordmarkViewBoxHeight,
  wordmarkViewBoxWidth,
} from "./sendmock-wordmark-path";

const squareSize = activityCellPitch * activityCellFill;
const squareInset = (activityCellPitch - squareSize) / 2;
const grid = measureActivityGrid(wordmarkViewBoxWidth, wordmarkViewBoxHeight);

/**
 * The letters filled with a pattern of empty-day squares on the canvas's grid, rendered into
 * the HTML so the first paint shows the word before the page's script draws the graph.
 */
export function WordmarkPlaceholder({ className }: { className: string }) {
  const patternId = `wordmark-squares-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${wordmarkViewBoxWidth} ${wordmarkViewBoxHeight}`}
      focusable="false"
      className={className}
    >
      <defs>
        <pattern
          id={patternId}
          x={grid.offsetX}
          y={grid.offsetY}
          width={activityCellPitch}
          height={activityCellPitch}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={squareInset}
            y={squareInset}
            width={squareSize}
            height={squareSize}
            rx={squareSize * activityCellCorner}
            style={{ fill: "var(--download-level-0)" }}
          />
        </pattern>
      </defs>
      <path d={wordmarkPathData} fill={`url(#${patternId})`} />
    </svg>
  );
}
