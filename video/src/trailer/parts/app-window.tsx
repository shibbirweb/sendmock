import type { CSSProperties, ReactNode } from "react";

import { fontFamily, monoFontFamily } from "../../brand";
import { trailerPalette } from "../trailer-palette";

type AppWindowProps = {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
};

const windowDotColors = ["#ff5f57", "#febc2e", "#28c840"];

/** A floating window with a title bar, for SendMock, your app and the agent. */
export function AppWindow({
  title,
  children,
  style,
  bodyStyle,
}: AppWindowProps) {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        borderRadius: 18,
        border: `1px solid ${trailerPalette.border}`,
        backgroundColor: trailerPalette.surface,
        boxShadow:
          "0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.02)",
        overflow: "hidden",
        fontFamily,
        color: trailerPalette.text,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          height: 46,
          padding: "0 18px",
          borderBottom: `1px solid ${trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceRaised,
          flexShrink: 0,
        }}
      >
        {windowDotColors.map((dotColor) => (
          <div
            key={dotColor}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: dotColor,
              opacity: 0.85,
            }}
          />
        ))}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            marginRight: 54,
            fontFamily: monoFontFamily,
            fontSize: 17,
            color: trailerPalette.textMuted,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, ...bodyStyle }}>
        {children}
      </div>
    </div>
  );
}
