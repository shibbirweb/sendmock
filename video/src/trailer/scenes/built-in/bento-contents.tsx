import { interpolate, useCurrentFrame } from "remotion";

import { monoFontFamily } from "../../../brand";
import type { BrandedName } from "../../trailer-facts";
import { getRiseInStyle } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";

type BrandedNameListProps = {
  brandedNames: BrandedName[];
  startFrame: number;
  columnCount: number;
};

const spotlightIntervalFrames = 16;

/** Provider names with their brand dot; a soft spotlight walks the list. */
export function BrandedNameList({
  brandedNames,
  startFrame,
  columnCount,
}: BrandedNameListProps) {
  const frame = useCurrentFrame();
  const spotlightIndex =
    Math.floor((frame - startFrame - 40) / spotlightIntervalFrames) %
    brandedNames.length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: "18px 18px",
      }}
    >
      {brandedNames.map((brandedName, nameIndex) => {
        const isSpotlit =
          frame > startFrame + 40 && nameIndex === spotlightIndex;
        return (
          <div
            key={brandedName.name}
            style={{
              ...getRiseInStyle(frame, startFrame + 8 + nameIndex * 3, 12, 10),
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 12,
              fontSize: 27,
              backgroundColor: isSpotlit
                ? trailerPalette.surfaceRaised
                : "transparent",
              color: isSpotlit ? trailerPalette.text : trailerPalette.textMuted,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: brandedName.accent,
                boxShadow: isSpotlit
                  ? `0 0 16px ${brandedName.accent}`
                  : undefined,
              }}
            />
            {brandedName.name}
          </div>
        );
      })}
    </div>
  );
}

type ScrollingNameListProps = {
  names: string[];
  startFrame: number;
  heightPx: number;
};

const rowHeightPx = 44;

/** Template names scrolling upward slowly behind soft top and bottom fades. */
export function ScrollingNameList({
  names,
  startFrame,
  heightPx,
}: ScrollingNameListProps) {
  const frame = useCurrentFrame();
  const scrollOffsetPx = interpolate(
    frame,
    [startFrame, startFrame + 280],
    [0, rowHeightPx * 9],
  );
  const repeatedNames = [...names, ...names];

  return (
    <div
      style={{
        position: "relative",
        height: heightPx,
        overflow: "hidden",
        maskImage:
          "linear-gradient(transparent, black 18%, black 82%, transparent)",
      }}
    >
      <div style={{ transform: `translateY(${-scrollOffsetPx}px)` }}>
        {repeatedNames.map((templateName, nameIndex) => (
          <div
            key={`${templateName}-${nameIndex}`}
            style={{
              height: rowHeightPx,
              display: "flex",
              alignItems: "center",
              fontFamily: monoFontFamily,
              fontSize: 21,
              color: trailerPalette.textMuted,
            }}
          >
            <span style={{ color: trailerPalette.accent, marginRight: 14 }}>
              ›
            </span>
            {templateName}
          </div>
        ))}
      </div>
    </div>
  );
}

type CodeLinesProps = {
  lines: string[];
  startFrame: number;
};

/** A few short monospace lines, rising in one after another. */
export function CodeLines({ lines, startFrame }: CodeLinesProps) {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lines.map((codeLine, lineIndex) => (
        <div
          key={codeLine}
          style={{
            ...getRiseInStyle(frame, startFrame + 10 + lineIndex * 6, 12, 8),
            fontFamily: monoFontFamily,
            fontSize: 18,
            color: trailerPalette.textMuted,
            whiteSpace: "nowrap",
          }}
        >
          {codeLine}
        </div>
      ))}
    </div>
  );
}
