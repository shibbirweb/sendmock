import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

import { AppWindow } from "../../parts/app-window";
import { SceneHeadline } from "../../parts/scene-headline";
import {
  getActiveStepIndex,
  getProgress,
  getRiseInStyle,
} from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import type { UiCue } from "../../ui-cues";
import { appTourPages } from "./app-tour-pages";

const firstPageFrame = 20;
const pageHoldFrames = 42;
const pageEnterFrames = 12;
const outroFrames = 40;
const pageStartFrames = appTourPages.map(
  (_appTourPage, pageIndex) => firstPageFrame + pageIndex * pageHoldFrames,
);

export const appTourSceneDurationFrames =
  firstPageFrame + appTourPages.length * pageHoldFrames + outroFrames;

/** Sounds: the window pops in, then each page swipes in. */
export const appTourSceneCues: UiCue[] = [
  { frame: 4, cueKind: "appear" },
  ...pageStartFrames.map((pageStartFrame): UiCue => ({
    frame: pageStartFrame,
    cueKind: "page",
  })),
];

const screenshotWidthPx = 1200;
const screenshotHeightPx = (screenshotWidthPx * 900) / 1440;
const windowTopPx = 210;
const titleBarHeightPx = 46;
const pageListRowHeightPx = 64;

/** Scene 9 of the tour version: real SendMock pages, one glance each. */
export function AppTourScene() {
  const frame = useCurrentFrame();
  const activePageIndex = Math.max(
    0,
    getActiveStepIndex(frame, pageStartFrames),
  );
  const activePage = appTourPages[activePageIndex];
  const windowCenterYPx =
    windowTopPx + (titleBarHeightPx + screenshotHeightPx) / 2;

  return (
    <AbsoluteFill>
      <SceneHeadline
        chapterLabel="09 · At a glance"
        headline="One app for all of it."
        topPx={50}
      />
      <AppWindow
        title={`localhost:8025${activePage?.route ?? "/"}`}
        style={{
          ...getRiseInStyle(frame, 4, 18, 30),
          left: 90,
          top: windowTopPx,
          width: screenshotWidthPx,
          height: titleBarHeightPx + screenshotHeightPx,
        }}
        bodyStyle={{ overflow: "hidden", backgroundColor: "#0a0a0a" }}
      >
        {appTourPages.map((appTourPage, pageIndex) => {
          const pageStartFrame = pageStartFrames[pageIndex] ?? 0;
          const isPastNextPage = pageIndex < activePageIndex - 1;
          if (frame < pageStartFrame || isPastNextPage) {
            return null;
          }
          // The next page slides in from the right, fully opaque, while this
          // one eases left and dims, so two screens never show through each other.
          const enterProgress =
            pageIndex === 0
              ? 1
              : getProgress(frame, pageStartFrame, pageEnterFrames);
          const nextPageStartFrame = pageStartFrames[pageIndex + 1];
          const exitProgress =
            nextPageStartFrame === undefined
              ? 0
              : getProgress(frame, nextPageStartFrame, pageEnterFrames);
          const slideXPx =
            (1 - enterProgress) * screenshotWidthPx -
            exitProgress * screenshotWidthPx * 0.25;
          const pushScale = interpolate(
            frame,
            [pageStartFrame, pageStartFrame + pageHoldFrames + pageEnterFrames],
            [1, 1.04],
            { extrapolateRight: "clamp" },
          );
          return (
            <Img
              key={appTourPage.pageName}
              src={staticFile(appTourPage.screenshotPath)}
              style={{
                position: "absolute",
                inset: 0,
                width: screenshotWidthPx,
                height: screenshotHeightPx,
                transform: `translateX(${slideXPx}px) scale(${pushScale})`,
                transformOrigin: appTourPage.pushOrigin,
                filter: `brightness(${1 - exitProgress * 0.5})`,
                boxShadow:
                  enterProgress < 1
                    ? "-30px 0 60px rgba(0, 0, 0, 0.6)"
                    : undefined,
              }}
            />
          );
        })}
      </AppWindow>
      <div
        style={{
          position: "absolute",
          left: 1350,
          right: 90,
          top:
            windowCenterYPx - (appTourPages.length * pageListRowHeightPx) / 2,
        }}
      >
        {appTourPages.map((appTourPage, pageIndex) => {
          const isActive = pageIndex === activePageIndex;
          const activeAmount = isActive
            ? getProgress(frame, pageStartFrames[pageIndex] ?? 0, 8)
            : 0;
          return (
            <div
              key={appTourPage.pageName}
              style={{
                ...getRiseInStyle(frame, 10 + pageIndex * 3, 12, 10),
                height: pageListRowHeightPx - 8,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 20px",
                borderRadius: 12,
                fontSize: 26,
                color: getPageNameColor(pageIndex, activePageIndex),
                backgroundColor: isActive
                  ? trailerPalette.surfaceRaised
                  : "transparent",
                boxShadow: isActive
                  ? `0 0 ${36 * activeAmount}px rgba(124, 207, 189, 0.18)`
                  : undefined,
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 26,
                  borderRadius: 2,
                  backgroundColor: isActive
                    ? trailerPalette.accent
                    : trailerPalette.border,
                }}
              />
              {appTourPage.pageName}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** The current page is bright, pages already shown are muted, the rest faint. */
function getPageNameColor(pageIndex: number, activePageIndex: number): string {
  if (pageIndex === activePageIndex) {
    return trailerPalette.text;
  }
  if (pageIndex < activePageIndex) {
    return trailerPalette.textMuted;
  }
  return trailerPalette.textFaint;
}
