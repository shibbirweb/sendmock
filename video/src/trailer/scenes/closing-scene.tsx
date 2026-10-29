import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

import { fontFamily, monoFontFamily } from "../../brand";
import { installCommands } from "../trailer-facts";
import { getRiseInStyle } from "../trailer-motion";
import { trailerPalette } from "../trailer-palette";

export const closingSceneDurationFrames = 210;

/** Scene 11: the closing line, the logo, one install command and the link. */
export function ClosingScene() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        color: trailerPalette.text,
      }}
    >
      <div
        style={{
          ...getRiseInStyle(frame, 0, 18),
          fontSize: 84,
          fontWeight: 600,
          letterSpacing: -2.5,
        }}
      >
        Your app talks.{" "}
        <span style={{ color: trailerPalette.accent }}>
          SendMock talks back.
        </span>
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, 40, 18),
          display: "flex",
          alignItems: "center",
          gap: 22,
          marginTop: 70,
        }}
      >
        <Img
          src={staticFile("brand/sendmock-logo.svg")}
          style={{
            width: 80,
            height: 80,
            filter: "drop-shadow(0 0 40px rgba(13, 148, 136, 0.45))",
          }}
        />
        <span style={{ fontSize: 72, fontWeight: 600, letterSpacing: -2 }}>
          SendMock
        </span>
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, 56, 16),
          marginTop: 44,
          padding: "18px 30px",
          borderRadius: 14,
          border: `1px solid ${trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceSunken,
          fontFamily: monoFontFamily,
          fontSize: 30,
        }}
      >
        <span style={{ color: trailerPalette.accent }}>$ </span>
        {installCommands[0]}
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, 66, 16),
          marginTop: 40,
          fontSize: 38,
          fontWeight: 500,
          color: trailerPalette.accent,
        }}
      >
        shibbirweb.github.io/sendmock
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, 76, 16),
          marginTop: 22,
          fontSize: 26,
          color: trailerPalette.textMuted,
        }}
      >
        github.com/shibbirweb/sendmock · Open source · Runs on your machine
      </div>
    </AbsoluteFill>
  );
}
