import { AbsoluteFill, Img, staticFile } from "remotion";

import { fontFamily, monoFontFamily } from "../brand";
import { AppWindow } from "../trailer/parts/app-window";
import { TrailerBackdrop } from "../trailer/parts/trailer-backdrop";
import { trailerPalette } from "../trailer/trailer-palette";
import { ChannelChips } from "./channel-chips";

export const socialPreviewWidth = 1280;
export const socialPreviewHeight = 640;

/** GitHub asks for a margin of about 40 px that sites may crop. */
const safeMarginPx = 72;

/**
 * The GitHub repository's social preview (docs/plan/23-promotional-video.md,
 * GitHub social preview): the name, what it does and the repository address
 * on the left, the real webhook deliveries page on the right.
 */
export function GithubSocialPreview() {
  return (
    <AbsoluteFill style={{ fontFamily, color: trailerPalette.text }}>
      <TrailerBackdrop />
      <AppWindow
        title="localhost:8025"
        style={{
          left: 720,
          top: 70,
          width: 720,
          height: 500,
          transform: "perspective(1600px) rotateY(-16deg) rotateX(4deg)",
          transformOrigin: "left center",
          boxShadow:
            "0 40px 100px rgba(0, 0, 0, 0.6), 0 0 80px rgba(124, 207, 189, 0.18)",
        }}
        bodyStyle={{ overflow: "hidden" }}
      >
        <Img
          src={staticFile("app-pages/webhook-deliveries.png")}
          style={{
            position: "absolute",
            width: 1100,
            left: -315,
            top: -40,
          }}
        />
      </AppWindow>
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, ${trailerPalette.canvas} 0%, ${trailerPalette.canvas} 48%, rgba(13, 17, 23, 0) 68%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: safeMarginPx,
          top: 64,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Img
          src={staticFile("brand/sendmock-logo.svg")}
          style={{
            width: 52,
            height: 52,
            filter: "drop-shadow(0 0 28px rgba(13, 148, 136, 0.5))",
          }}
        />
        <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>
          SendMock
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: safeMarginPx,
          top: 160,
          fontSize: 86,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: -3.5,
        }}
      >
        <div>Every webhook.</div>
        <div style={{ color: trailerPalette.accent }}>On localhost.</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: safeMarginPx,
          top: 364,
          fontSize: 28,
          color: trailerPalette.textMuted,
        }}
      >
        One local server to test email, SMS and payments.
      </div>
      <ChannelChips leftPx={safeMarginPx} topPx={428} fontSizePx={24} />
      <div
        style={{
          position: "absolute",
          left: safeMarginPx,
          top: 512,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: monoFontFamily,
            fontSize: 24,
            color: trailerPalette.accent,
          }}
        >
          github.com/shibbirweb/sendmock
        </span>
        <span style={{ fontSize: 22, color: trailerPalette.textFaint }}>
          Open source · macOS · Linux · Windows · Docker
        </span>
      </div>
    </AbsoluteFill>
  );
}
