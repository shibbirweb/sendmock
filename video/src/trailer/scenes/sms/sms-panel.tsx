import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";

import { getRiseInStyle, getTypedText } from "../../trailer-motion";
import { areaColors, trailerPalette } from "../../trailer-palette";

export const customerReplyText = "YES";
export const appAnswerText = "Thanks Maya, see you Thursday.";

type SmsPanelProps = {
  activeStepIndex: number;
  inboundStartFrame: number;
  replyTypingStartFrame: number;
  appAnswerFrame: number;
};

/** SendMock's SMS thread: the "Reply YES" text, its ticks, Maya's reply. */
export function SmsPanel({
  activeStepIndex,
  inboundStartFrame,
  replyTypingStartFrame,
  appAnswerFrame,
}: SmsPanelProps) {
  const frame = useCurrentFrame();
  const isDelivered = activeStepIndex >= 0;
  const isReplySent = activeStepIndex >= 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 28px",
          borderBottom: `1px solid ${trailerPalette.border}`,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>Maya</div>
          <div style={{ fontSize: 18, color: trailerPalette.textMuted }}>
            +1 202 555 0100 · from +1 500 555 0006
          </div>
        </div>
        <div style={{ fontSize: 16, color: trailerPalette.textMuted }}>
          <span style={{ color: "#f22f46" }}>●</span> Twilio
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          padding: 28,
        }}
      >
        <MessageBubble isOutbound>
          Acme: Your order #1042 ships Thursday. Reply YES to confirm.
        </MessageBubble>
        <div
          style={{
            alignSelf: "flex-end",
            fontSize: 17,
            marginTop: -8,
            color: isDelivered ? areaColors.sms : trailerPalette.textFaint,
          }}
        >
          {isDelivered ? "✓✓ delivered" : "✓ sent"}
        </div>
        {isReplySent ? (
          <MessageBubble style={getRiseInStyle(frame, inboundStartFrame, 12)}>
            {customerReplyText}
          </MessageBubble>
        ) : null}
        {frame >= appAnswerFrame ? (
          <MessageBubble
            isOutbound
            style={getRiseInStyle(frame, appAnswerFrame, 12)}
          >
            {appAnswerText}
          </MessageBubble>
        ) : null}
      </div>
      <div
        style={{
          margin: 24,
          padding: "16px 20px",
          borderRadius: 14,
          border: `1px solid ${
            frame >= replyTypingStartFrame && !isReplySent
              ? trailerPalette.accent
              : trailerPalette.border
          }`,
          fontSize: 21,
          color: trailerPalette.textMuted,
        }}
      >
        {frame >= replyTypingStartFrame && !isReplySent ? (
          <span style={{ color: trailerPalette.text }}>
            {getTypedText(customerReplyText, frame, replyTypingStartFrame, 0.2)}
            <span style={{ color: trailerPalette.accent }}>|</span>
          </span>
        ) : (
          "Reply as recipient"
        )}
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  isOutbound?: boolean;
  style?: CSSProperties;
  children: ReactNode;
};

function MessageBubble({
  isOutbound = false,
  style,
  children,
}: MessageBubbleProps) {
  return (
    <div
      style={{
        alignSelf: isOutbound ? "flex-end" : "flex-start",
        maxWidth: "78%",
        padding: "14px 20px",
        borderRadius: 20,
        fontSize: 22,
        lineHeight: 1.45,
        backgroundColor: isOutbound
          ? "rgba(121, 192, 255, 0.16)"
          : trailerPalette.surfaceRaised,
        border: `1px solid ${isOutbound ? "rgba(121, 192, 255, 0.35)" : trailerPalette.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
