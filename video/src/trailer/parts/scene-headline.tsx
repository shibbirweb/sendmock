import { useCurrentFrame } from "remotion";

import { fontFamily, monoFontFamily } from "../../brand";
import { getRiseInStyle } from "../trailer-motion";
import { trailerPalette } from "../trailer-palette";

type SceneHeadlineProps = {
  chapterLabel: string;
  headline: string;
  supportingLine?: string;
  topPx?: number;
};

/** The chapter label and one headline at the top of a scene. */
export function SceneHeadline({
  chapterLabel,
  headline,
  supportingLine,
  topPx = 72,
}: SceneHeadlineProps) {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        top: topPx,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily,
      }}
    >
      <div
        style={{
          ...getRiseInStyle(frame, 0, 12, 10),
          fontFamily: monoFontFamily,
          fontSize: 22,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: trailerPalette.accent,
        }}
      >
        {chapterLabel}
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, 4, 16),
          marginTop: 14,
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: -1.5,
          color: trailerPalette.text,
        }}
      >
        {headline}
      </div>
      {supportingLine === undefined ? null : (
        <div
          style={{
            ...getRiseInStyle(frame, 10, 16),
            marginTop: 12,
            fontSize: 28,
            color: trailerPalette.textMuted,
          }}
        >
          {supportingLine}
        </div>
      )}
    </div>
  );
}
