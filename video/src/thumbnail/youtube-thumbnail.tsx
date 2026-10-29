import { AbsoluteFill, Img, staticFile } from "remotion";

import { fontFamily } from "../brand";
import { AppWindow } from "../trailer/parts/app-window";
import { TrailerBackdrop } from "../trailer/parts/trailer-backdrop";
import { areaColors, trailerPalette } from "../trailer/trailer-palette";

export const thumbnailWidth = 1280;
export const thumbnailHeight = 720;

const channelChips = [
  { label: "Email", color: areaColors.email },
  { label: "SMS", color: areaColors.sms },
  { label: "Payments", color: areaColors.payment },
  { label: "Any API", color: areaColors.http },
];

/**
 * The YouTube thumbnail (docs/plan/23-promotional-video.md, YouTube upload):
 * a few big words on the left, the real webhook deliveries page on the right.
 */
export function YoutubeThumbnail() {
  return (
    <AbsoluteFill style={{ fontFamily, color: trailerPalette.text }}>
      <TrailerBackdrop />
      <AppWindow
        title="localhost:8025"
        style={{
          left: 700,
          top: 96,
          width: 760,
          height: 540,
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
            width: 1150,
            left: -330,
            top: -40,
          }}
        />
      </AppWindow>
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, ${trailerPalette.canvas} 0%, ${trailerPalette.canvas} 46%, rgba(13, 17, 23, 0) 66%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Img
          src={staticFile("brand/sendmock-logo.svg")}
          style={{
            width: 60,
            height: 60,
            filter: "drop-shadow(0 0 28px rgba(13, 148, 136, 0.5))",
          }}
        />
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>
          SendMock
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 200,
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: -4,
        }}
      >
        <div>Every webhook.</div>
        <div style={{ color: trailerPalette.accent }}>On localhost.</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 470,
          display: "flex",
          gap: 14,
        }}
      >
        {channelChips.map((channelChip) => (
          <div
            key={channelChip.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${trailerPalette.border}`,
              backgroundColor: trailerPalette.surface,
              fontSize: 28,
              fontWeight: 500,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: channelChip.color,
                boxShadow: `0 0 12px ${channelChip.color}`,
              }}
            />
            {channelChip.label}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 600,
          fontSize: 28,
          color: trailerPalette.textMuted,
        }}
      >
        Open source · No SDK needed · AI ready
      </div>
    </AbsoluteFill>
  );
}
