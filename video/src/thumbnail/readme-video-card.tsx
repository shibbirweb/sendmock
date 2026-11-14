import { Play } from "lucide-react";
import { AbsoluteFill } from "remotion";

import { brandGradient, fontFamily } from "../brand";
import { trailerPalette } from "../trailer/trailer-palette";
import {
  thumbnailHeight,
  thumbnailWidth,
  YoutubeThumbnail,
} from "./youtube-thumbnail";

export const readmeVideoCardWidth = thumbnailWidth;
export const readmeVideoCardHeight = thumbnailHeight;

const trailerDurationLabel = "2:01";

/**
 * The README's link to the trailer: GitHub cannot play YouTube inline, so the
 * thumbnail carries the landing page's play button and a duration badge to
 * read as a video, not a screenshot.
 */
export function ReadmeVideoCard() {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <YoutubeThumbnail />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(0deg, rgba(13, 17, 23, 0.7) 0%, rgba(13, 17, 23, 0.35) 50%, rgba(13, 17, 23, 0.2) 100%)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: "50%",
            background: brandGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 90px rgba(16, 185, 129, 0.45)",
          }}
        >
          <Play
            size={72}
            color="#ffffff"
            fill="#ffffff"
            strokeWidth={1.5}
            style={{ marginLeft: 10 }}
          />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 28,
          bottom: 28,
          padding: "6px 14px",
          borderRadius: 10,
          background: "rgba(0, 0, 0, 0.78)",
          color: trailerPalette.text,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: 0.5,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {trailerDurationLabel}
      </div>
    </AbsoluteFill>
  );
}
