import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { getProgress } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";

type BentoTileProps = {
  title: string;
  /** Counted up from 0 as the tile appears; omitted for text tiles. */
  count?: number;
  startFrame: number;
  gridArea: string;
  titleFontSizePx?: number;
  children: ReactNode;
  style?: CSSProperties;
};

/**
 * One bento tile: rises and settles in, counts up, then a soft sheen of light
 * passes over it once (research: per-tile motion, staggered in reading order).
 */
export function BentoTile({
  title,
  count,
  startFrame,
  gridArea,
  titleFontSizePx = 28,
  children,
  style,
}: BentoTileProps) {
  const frame = useCurrentFrame();
  const appearProgress = getProgress(frame, startFrame, 18);
  const countedValue =
    count === undefined
      ? undefined
      : Math.round(getProgress(frame, startFrame + 4, 24) * count);
  const sheenPositionPercent = interpolate(
    frame,
    [startFrame + 50, startFrame + 95],
    [-40, 140],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        gridArea,
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        border: `1px solid ${trailerPalette.border}`,
        backgroundColor: trailerPalette.surface,
        padding: "26px 30px",
        opacity: appearProgress,
        transform: `translateY(${(1 - appearProgress) * 30}px) scale(${0.96 + appearProgress * 0.04})`,
        filter:
          appearProgress < 1
            ? `blur(${(1 - appearProgress) * 8}px)`
            : undefined,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        {countedValue === undefined ? null : (
          <span
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: -2,
              color: trailerPalette.accent,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {countedValue}
          </span>
        )}
        <span
          style={{
            fontSize: titleFontSizePx,
            fontWeight: 600,
            color: trailerPalette.text,
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ marginTop: 18 }}>{children}</div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(105deg, transparent ${sheenPositionPercent - 18}%, rgba(124, 207, 189, 0.10) ${sheenPositionPercent}%, transparent ${sheenPositionPercent + 18}%)`,
        }}
      />
    </div>
  );
}
