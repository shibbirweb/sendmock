import type { CSSProperties } from "react";

import { monoFontFamily } from "../../brand";
import { trailerPalette } from "../trailer-palette";

export type WebhookRequest = {
  /** Whose wire format this is, for example "SendGrid Event Webhook". */
  formatLabel: string;
  method: string;
  target: string;
  headerLines: string[];
  bodyLines: string[];
};

type RequestCardProps = {
  request: WebhookRequest;
  style?: CSSProperties;
};

/** The request a webhook carries, in the provider's own format. */
export function RequestCard({ request, style }: RequestCardProps) {
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 14,
        border: `1px solid ${trailerPalette.border}`,
        backgroundColor: trailerPalette.surfaceSunken,
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
        padding: "18px 20px",
        fontFamily: monoFontFamily,
        fontSize: 16,
        lineHeight: 1.55,
        color: trailerPalette.textMuted,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 14,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: trailerPalette.accent,
          marginBottom: 10,
        }}
      >
        {request.formatLabel}
      </div>
      <div style={{ color: trailerPalette.text, whiteSpace: "nowrap" }}>
        <span style={{ color: trailerPalette.amber }}>{request.method}</span>{" "}
        {request.target}
      </div>
      {request.headerLines.map((headerLine) => (
        <div
          key={headerLine}
          style={{ whiteSpace: "nowrap", color: trailerPalette.textFaint }}
        >
          {headerLine}
        </div>
      ))}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${trailerPalette.borderSoft}`,
        }}
      >
        {request.bodyLines.map((bodyLine, lineIndex) => (
          <div key={lineIndex} style={{ whiteSpace: "pre" }}>
            {bodyLine}
          </div>
        ))}
      </div>
    </div>
  );
}
