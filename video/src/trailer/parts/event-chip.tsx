import type { CSSProperties } from "react";

import { monoFontFamily } from "../../brand";
import { trailerPalette } from "../trailer-palette";

type EventChipProps = {
  label: string;
  color: string;
  /** 0 is resting, 1 is fully lit with a soft bloom. */
  litAmount: number;
  fontSizePx?: number;
  style?: CSSProperties;
};

/** An event name with its area's colour dot; lights up when the event fires. */
export function EventChip({
  label,
  color,
  litAmount,
  fontSizePx = 18,
  style,
}: EventChipProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${litAmount > 0.05 ? color : trailerPalette.border}`,
        backgroundColor: trailerPalette.surfaceRaised,
        boxShadow:
          litAmount > 0.01
            ? `0 0 ${36 * litAmount}px ${color}55, inset 0 0 ${20 * litAmount}px ${color}22`
            : undefined,
        fontFamily: monoFontFamily,
        fontSize: fontSizePx,
        color: litAmount > 0.5 ? trailerPalette.text : trailerPalette.textMuted,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: color,
          opacity: 0.55 + litAmount * 0.45,
        }}
      />
      {label}
    </div>
  );
}
