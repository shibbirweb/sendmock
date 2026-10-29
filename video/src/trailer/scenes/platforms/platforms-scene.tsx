import {
  Container,
  Laptop,
  type LucideIcon,
  Monitor,
  Terminal,
} from "lucide-react";
import { AbsoluteFill, interpolate } from "remotion";

import { monoFontFamily } from "../../../brand";
import { SceneHeadline } from "../../parts/scene-headline";
import { connectionNames, installCommands } from "../../trailer-facts";
import { getProgress, getRiseInStyle } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import type { UiCue } from "../../ui-cues";
import { useDesignFrame } from "../../trailer-time";

export const platformsSceneDurationFrames = 300;

type PlatformTile = {
  name: string;
  details: string;
  Icon: LucideIcon;
};

export const platformTiles: PlatformTile[] = [
  { name: "macOS", details: "Apple silicon · Intel", Icon: Laptop },
  { name: "Linux", details: "x64 · arm64 · .deb · .rpm", Icon: Terminal },
  { name: "Windows", details: "x64 · arm64", Icon: Monitor },
  { name: "Docker", details: "multi-arch image", Icon: Container },
];

const commandsStartFrame = 60;
const commandHoldFrames = 42;
const exitFrames = 18;
const exitStartFrame = platformsSceneDurationFrames - exitFrames;
const languagesStartFrame = 90;

/**
 * The install bar's place and size. It carries across the cut into the
 * closing card (a match cut), which starts it exactly here.
 */
export const installBarLayout = {
  leftPx: 140,
  topPx: 660,
  widthPx: 1640,
  paddingYPx: 22,
  paddingXPx: 30,
  fontSizePx: 24,
  borderRadiusPx: 16,
};

/** Sounds: the tiles pop in, each install command ticks in, then all but the bar sweeps away. */
export const platformsSceneCues: UiCue[] = [
  ...platformTiles.map((_platformTile, tileIndex): UiCue => ({
    frame: 14 + tileIndex * 7,
    cueKind: "appear",
  })),
  ...installCommands.map((_installCommand, commandIndex): UiCue => ({
    frame: commandsStartFrame + commandIndex * commandHoldFrames,
    cueKind: "fire",
  })),
  { frame: languagesStartFrame, cueKind: "appear" },
  { frame: exitStartFrame, cueKind: "whoosh" },
];

type PlatformsSceneProps = {
  chapterLabel?: string;
};

/** Scene 10: every operating system, Docker, and the ways an app connects. */
export function PlatformsScene({
  chapterLabel = "09 · Everywhere",
}: PlatformsSceneProps) {
  const frame = useDesignFrame();
  const commandFrame = frame - commandsStartFrame;
  const commandIndex =
    Math.max(0, Math.floor(commandFrame / commandHoldFrames)) %
    installCommands.length;
  const frameInCommand =
    commandFrame -
    Math.floor(commandFrame / commandHoldFrames) * commandHoldFrames;
  const isExiting = frame >= exitStartFrame;
  const exitProgress = getProgress(frame, exitStartFrame, exitFrames - 4);
  const exitStyle = {
    opacity: 1 - exitProgress,
    transform: `translateY(${-exitProgress * 30}px)`,
    filter: exitProgress > 0 ? `blur(${exitProgress * 10}px)` : undefined,
  };
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
      <AbsoluteFill style={exitStyle}>
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
      </AbsoluteFill>
      <div
        style={{
          ...getRiseInStyle(frame, commandsStartFrame - 6, 14, 14),
          position: "absolute",
          left: installBarLayout.leftPx,
          width: installBarLayout.widthPx,
          top: installBarLayout.topPx,
          padding: `${installBarLayout.paddingYPx}px ${installBarLayout.paddingXPx}px`,
          borderRadius: installBarLayout.borderRadiusPx,
          border: `1px solid ${trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceSunken,
          fontFamily: monoFontFamily,
          fontSize: installBarLayout.fontSizePx,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ color: trailerPalette.accent }}>$ </span>
        <span style={{ opacity: isExiting ? 1 : commandOpacity }}>
          {installCommands[isExiting ? 0 : commandIndex]}
        </span>
      </div>
      <div
        style={{
          ...exitStyle,
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
            ...getRiseInStyle(frame, languagesStartFrame, 12, 10),
            color: trailerPalette.textMuted,
            marginRight: 8,
          }}
        >
          No SDK needed
        </span>
        {connectionNames.map((connectionName, connectionIndex) => (
          <span
            key={connectionName}
            style={{
              ...getRiseInStyle(
                frame,
                languagesStartFrame + 4 + connectionIndex * 4,
                12,
                10,
              ),
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${trailerPalette.border}`,
              backgroundColor: trailerPalette.surface,
            }}
          >
            {connectionName}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}
