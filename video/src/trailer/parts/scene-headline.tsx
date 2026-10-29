import { useCurrentFrame } from "remotion";

import { fontFamily, monoFontFamily } from "../../brand";
import { getProgress, getRiseInStyle } from "../trailer-motion";
import { trailerPalette } from "../trailer-palette";

type SceneHeadlineProps = {
  chapterLabel: string;
  headline: string;
  supportingLine?: string;
  topPx?: number;
};

const wordStaggerFrames = 3;
const wordRiseFrames = 14;

/** The chapter label and one headline whose words rise out of a mask in turn. */
export function SceneHeadline({
  chapterLabel,
  headline,
  supportingLine,
  topPx = 72,
}: SceneHeadlineProps) {
  const frame = useCurrentFrame();
  const headlineWords = headline.split(" ");
  const supportingLineFrame = 6 + headlineWords.length * wordStaggerFrames;
  const labelProgress = getProgress(frame, 0, 14);

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
          fontFamily: monoFontFamily,
          fontSize: 22,
          letterSpacing: 3 + (1 - labelProgress) * 10,
          textTransform: "uppercase",
          color: trailerPalette.accent,
          opacity: labelProgress,
        }}
      >
        {chapterLabel}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: -1.5,
          color: trailerPalette.text,
        }}
      >
        {headlineWords.map((headlineWord, wordIndex) => {
          const wordProgress = getProgress(
            frame,
            4 + wordIndex * wordStaggerFrames,
            wordRiseFrames,
          );
          return (
            <span
              key={`${headlineWord}-${wordIndex}`}
              style={{
                display: "inline-block",
                overflow: "hidden",
                verticalAlign: "bottom",
                paddingBottom: 6,
                marginRight:
                  wordIndex < headlineWords.length - 1 ? "0.26em" : 0,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - wordProgress) * 105}%)`,
                }}
              >
                {headlineWord}
              </span>
            </span>
          );
        })}
      </div>
      {supportingLine === undefined ? null : (
        <div
          style={{
            ...getRiseInStyle(frame, supportingLineFrame, 16),
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
