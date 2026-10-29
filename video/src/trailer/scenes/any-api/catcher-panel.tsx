import { monoFontFamily } from "../../../brand";
import { getRiseInStyle } from "../../trailer-motion";
import { areaColors, trailerPalette } from "../../trailer-palette";
import { useDesignFrame } from "../../trailer-time";

export type CaughtCall = {
  catchFrame: number;
  host: string;
  path: string;
  answer: string;
  previewTitle: string;
  previewText: string;
};

type CatcherPanelProps = {
  caughtCalls: CaughtCall[];
};

/** SendMock's HTTP catcher: each call your app makes, caught and previewed. */
export function CatcherPanel({ caughtCalls }: CatcherPanelProps) {
  const frame = useDesignFrame();

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 28 }}
    >
      <div style={{ fontSize: 18, color: trailerPalette.textMuted }}>
        Caught requests
      </div>
      {caughtCalls.map((caughtCall) => {
        if (frame < caughtCall.catchFrame) {
          return null;
        }
        return (
          <div
            key={caughtCall.host}
            style={{
              ...getRiseInStyle(frame, caughtCall.catchFrame, 12),
              borderRadius: 14,
              border: `1px solid ${trailerPalette.border}`,
              backgroundColor: trailerPalette.surfaceRaised,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                fontFamily: monoFontFamily,
                fontSize: 18,
              }}
            >
              <span style={{ color: areaColors.http }}>POST</span>
              <span
                style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden" }}
              >
                {caughtCall.host}
                <span style={{ color: trailerPalette.textFaint }}>
                  {caughtCall.path}
                </span>
              </span>
              <span style={{ color: trailerPalette.success }}>
                {caughtCall.answer}
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                paddingLeft: 14,
                borderLeft: `3px solid ${areaColors.http}`,
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 600 }}>
                {caughtCall.previewTitle}
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: trailerPalette.textMuted,
                  marginTop: 2,
                }}
              >
                {caughtCall.previewText}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
