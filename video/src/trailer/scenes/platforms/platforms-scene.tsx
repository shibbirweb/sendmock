import {
  Container,
  Laptop,
  type LucideIcon,
  Monitor,
  Terminal,
} from "lucide-react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { monoFontFamily } from "../../../brand";
import { SceneHeadline } from "../../parts/scene-headline";
import { installCommands, languageNames } from "../../trailer-facts";
import { getRiseInStyle } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";

export const platformsSceneDurationFrames = 300;

type PlatformTile = {
  name: string;
  details: string;
  Icon: LucideIcon;
};

const platformTiles: PlatformTile[] = [
  { name: "macOS", details: "Apple silicon · Intel", Icon: Laptop },
  { name: "Linux", details: "x64 · arm64 · .deb · .rpm", Icon: Terminal },
  { name: "Windows", details: "x64 · arm64", Icon: Monitor },
  { name: "Docker", details: "multi-arch image", Icon: Container },
];

const commandsStartFrame = 60;
const commandHoldFrames = 42;

type PlatformsSceneProps = {
  chapterLabel?: string;
};

/** Scene 10: every operating system, Docker, and any language. */
export function PlatformsScene({
  chapterLabel = "09 · Everywhere",
}: PlatformsSceneProps) {
  const frame = useCurrentFrame();
  const commandFrame = frame - commandsStartFrame;
  const commandIndex =
    Math.max(0, Math.floor(commandFrame / commandHoldFrames)) %
    installCommands.length;
  const frameInCommand =
    commandFrame -
    Math.floor(commandFrame / commandHoldFrames) * commandHoldFrames;
  const commandOpacity = interpolate(
    frameInCommand,
    [0, 6, commandHoldFrames - 6, commandHoldFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill>
      <SceneHeadline
        chapterLabel={chapterLabel}
        headline="Runs everywhere you build."
      />
      <div
        style={{
          position: "absolute",
          left: 140,
          right: 140,
          top: 270,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 22,
        }}
      >
        {platformTiles.map((platformTile, tileIndex) => (
          <div
            key={platformTile.name}
            style={{
              ...getRiseInStyle(frame, 14 + tileIndex * 7, 18, 26),
              padding: "48px 36px",
              borderRadius: 22,
              border: `1px solid ${trailerPalette.border}`,
              backgroundColor: trailerPalette.surface,
            }}
          >
            <platformTile.Icon
              size={64}
              strokeWidth={1.5}
              color={trailerPalette.accent}
            />
            <div style={{ fontSize: 46, fontWeight: 600, marginTop: 20 }}>
              {platformTile.name}
            </div>
            <div
              style={{
                fontSize: 24,
                color: trailerPalette.textMuted,
                marginTop: 8,
              }}
            >
              {platformTile.details}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, commandsStartFrame - 6, 14, 14),
          position: "absolute",
          left: 140,
          right: 140,
          top: 660,
          padding: "22px 30px",
          borderRadius: 16,
          border: `1px solid ${trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceSunken,
          fontFamily: monoFontFamily,
          fontSize: 24,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ color: trailerPalette.accent }}>$ </span>
        <span style={{ opacity: commandOpacity }}>
          {installCommands[commandIndex]}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 830,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          fontSize: 24,
        }}
      >
        <span
          style={{
            ...getRiseInStyle(frame, 90, 12, 10),
            color: trailerPalette.textMuted,
            marginRight: 8,
          }}
        >
          Any language
        </span>
        {languageNames.map((languageName, languageIndex) => (
          <span
            key={languageName}
            style={{
              ...getRiseInStyle(frame, 94 + languageIndex * 4, 12, 10),
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${trailerPalette.border}`,
              backgroundColor: trailerPalette.surface,
            }}
          >
            {languageName}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}
