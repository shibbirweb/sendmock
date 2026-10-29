import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { monoFontFamily } from "../../brand";
import { getRiseInStyle } from "../trailer-motion";
import { trailerPalette } from "../trailer-palette";
import { AppWindow } from "./app-window";

export type TerminalLine = {
  text: string;
  appearFrame: number;
  /** "status" lines show a green 200 at the start. */
  tone: "command" | "plain" | "status";
};

type AppTerminalProps = {
  title: string;
  lines: TerminalLine[];
  style?: CSSProperties;
};

/** Your app's terminal: each line that receives a webhook glows as it lands. */
export function AppTerminal({ title, lines, style }: AppTerminalProps) {
  const frame = useCurrentFrame();

  return (
    <AppWindow
      title={title}
      style={{ backgroundColor: trailerPalette.surfaceSunken, ...style }}
      bodyStyle={{
        padding: "20px 22px",
        fontFamily: monoFontFamily,
        fontSize: 18,
        lineHeight: 1.8,
      }}
    >
      {lines.map((terminalLine) => {
        if (frame < terminalLine.appearFrame) {
          return null;
        }
        const glowOpacity = interpolate(
          frame,
          [terminalLine.appearFrame, terminalLine.appearFrame + 40],
          [1, 0],
          { extrapolateRight: "clamp" },
        );
        const isStatus = terminalLine.tone === "status";
        return (
          <div
            key={terminalLine.text}
            style={{
              ...getRiseInStyle(frame, terminalLine.appearFrame, 8, 6),
              whiteSpace: "nowrap",
              borderRadius: 6,
              margin: "0 -8px",
              padding: "0 8px",
              backgroundColor: isStatus
                ? `rgba(124, 207, 189, ${0.16 * glowOpacity})`
                : undefined,
              color:
                terminalLine.tone === "command"
                  ? trailerPalette.text
                  : trailerPalette.textMuted,
            }}
          >
            {terminalLine.tone === "command" ? (
              <span style={{ color: trailerPalette.accent }}>$ </span>
            ) : null}
            {isStatus ? (
              <span style={{ color: trailerPalette.success }}>200 </span>
            ) : null}
            {terminalLine.text}
          </div>
        );
      })}
    </AppWindow>
  );
}
