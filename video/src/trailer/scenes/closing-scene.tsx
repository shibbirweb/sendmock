import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";

import { monoFontFamily, videoHeight, videoWidth } from "../../brand";
import { cameraDriftPx, cameraPushScale } from "../parts/scene-camera";
import { getRiseInStyle } from "../trailer-motion";
import { trailerPalette } from "../trailer-palette";
import type { UiCue } from "../ui-cues";
import { ClosingPlatformsBar } from "./closing-platforms-bar";
import { installBarLayout } from "./platforms/platforms-scene";
import { useDesignFrame } from "../trailer-time";

export const closingSceneDurationFrames = 210;

const morphFrames = 26;
const taglineFrame = 12;
const logoFrame = 34;
const websiteFrame = 54;
const factsFrame = 64;

/** Sounds: the bar swipes into place, the closing line lands, then the logo and link. */
export const closingSceneCues: UiCue[] = [
  { frame: 0, cueKind: "page" },
  { frame: taglineFrame, cueKind: "reveal" },
  { frame: logoFrame, cueKind: "appear" },
  { frame: websiteFrame, cueKind: "appear" },
];

/**
 * Where the platforms scene left the install bar, in this scene's frame:
 * its last camera push and drift are undone so the cut is seamless.
 */
const barStartLayout = {
  leftPx:
    videoWidth / 2 +
    (installBarLayout.leftPx - videoWidth / 2) * cameraPushScale -
    2 * cameraDriftPx,
  topPx:
    videoHeight / 2 +
    (installBarLayout.topPx - videoHeight / 2) * cameraPushScale,
  widthPx: installBarLayout.widthPx * cameraPushScale,
  paddingYPx: installBarLayout.paddingYPx * cameraPushScale,
  paddingXPx: installBarLayout.paddingXPx * cameraPushScale,
  fontSizePx: installBarLayout.fontSizePx * cameraPushScale,
  borderRadiusPx: installBarLayout.borderRadiusPx,
};

/** Wide enough to name every platform on one line. */
const barEndLayout = {
  leftPx: videoWidth / 2 - 450,
  topPx: 560,
  widthPx: 900,
  paddingYPx: 18,
  paddingXPx: 30,
  fontSizePx: 30,
  borderRadiusPx: 14,
};

/**
 * Scene 11: the install bar carries over, turns into every platform SendMock
 * runs on, and the closing card builds around it.
 */
export function ClosingScene() {
  const frame = useDesignFrame();
  const morphProgress = interpolate(frame, [0, morphFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const getBarValue = (layoutKey: keyof typeof barEndLayout) =>
    barStartLayout[layoutKey] +
    (barEndLayout[layoutKey] - barStartLayout[layoutKey]) * morphProgress;

  return (
    <AbsoluteFill style={{ color: trailerPalette.text }}>
      <div
        style={{
          ...getRiseInStyle(frame, taglineFrame, 18),
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
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
          ...getRiseInStyle(frame, logoFrame, 18),
          position: "absolute",
          top: 430,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 22,
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
          position: "absolute",
          left: getBarValue("leftPx"),
          top: getBarValue("topPx"),
          width: getBarValue("widthPx"),
          padding: `${getBarValue("paddingYPx")}px ${getBarValue("paddingXPx")}px`,
          borderRadius: getBarValue("borderRadiusPx"),
          border: `1px solid ${trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceSunken,
          boxShadow: `0 0 ${50 * morphProgress}px rgba(124, 207, 189, 0.12)`,
          fontFamily: monoFontFamily,
          fontSize: getBarValue("fontSizePx"),
          whiteSpace: "nowrap",
        }}
      >
        <ClosingPlatformsBar morphProgress={morphProgress} />
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, websiteFrame, 16),
          position: "absolute",
          top: 680,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 38,
          fontWeight: 500,
          color: trailerPalette.accent,
        }}
      >
        shibbirweb.github.io/sendmock
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, factsFrame, 16),
          position: "absolute",
          top: 745,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 26,
          color: trailerPalette.textMuted,
        }}
      >
        github.com/shibbirweb/sendmock · Open source · Runs on your machine
      </div>
    </AbsoluteFill>
  );
}
