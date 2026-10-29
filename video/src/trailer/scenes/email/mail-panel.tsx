import { EventChip } from "../../parts/event-chip";
import {
  getProgress,
  getRiseInStyle,
  getTypedText,
} from "../../trailer-motion";
import { areaColors, trailerPalette } from "../../trailer-palette";
import { useDesignFrame } from "../../trailer-time";

export const replyText = "Thursday works, thanks!";

type MailPanelProps = {
  activeStepIndex: number;
  stepStartFrames: number[];
  replyTypingStartFrame: number;
};

const timelineLabels = ["received", "delivered", "opened", "replied"];

/** SendMock's mail view: the caught order email, its events and the reply. */
export function MailPanel({
  activeStepIndex,
  stepStartFrames,
  replyTypingStartFrame,
}: MailPanelProps) {
  const frame = useDesignFrame();
  const replyStepStartFrame = stepStartFrames[2] ?? 0;
  const isReplySent = activeStepIndex >= 2;
  const isComposerOpen = frame >= replyTypingStartFrame - 10 && !isReplySent;

  return (
    <div
      style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: trailerPalette.accentSoft,
            color: trailerPalette.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          A
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 600 }}>
            Your order #1042 has shipped
          </div>
          <div
            style={{
              fontSize: 19,
              color: trailerPalette.textMuted,
              marginTop: 4,
            }}
          >
            Acme Shop to maya@example.com
          </div>
        </div>
        <ProviderBadge />
      </div>
      <div
        style={{
          fontSize: 21,
          lineHeight: 1.6,
          color: trailerPalette.textMuted,
          padding: "18px 20px",
          borderRadius: 12,
          backgroundColor: trailerPalette.surfaceSunken,
        }}
      >
        Hi Maya, your order ships on Thursday. Just reply if another day suits
        you better.
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {timelineLabels.map((timelineLabel, labelIndex) => {
          const litStartFrame =
            labelIndex === 0 ? 0 : (stepStartFrames[labelIndex - 1] ?? 0);
          const isLit = labelIndex === 0 || activeStepIndex >= labelIndex - 1;
          return (
            <EventChip
              key={timelineLabel}
              label={timelineLabel}
              color={areaColors.email}
              litAmount={isLit ? getProgress(frame, litStartFrame, 10) : 0}
            />
          );
        })}
      </div>
      {isComposerOpen ? (
        <div
          style={{
            ...getRiseInStyle(frame, replyTypingStartFrame - 10, 12),
            borderRadius: 12,
            border: `1px solid ${trailerPalette.border}`,
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: 17, color: trailerPalette.accent }}>
            Reply as recipient
          </div>
          <div style={{ fontSize: 22, marginTop: 10, minHeight: 32 }}>
            {getTypedText(replyText, frame, replyTypingStartFrame)}
            <span style={{ color: trailerPalette.accent }}>|</span>
          </div>
        </div>
      ) : null}
      {isReplySent ? (
        <div
          style={{
            ...getRiseInStyle(frame, replyStepStartFrame, 12),
            display: "flex",
            gap: 14,
            alignItems: "center",
            borderRadius: 12,
            padding: "16px 20px",
            backgroundColor: trailerPalette.accentSoft,
          }}
        >
          <span style={{ fontSize: 16, color: trailerPalette.accent }}>
            INBOUND
          </span>
          <span style={{ fontSize: 21 }}>Maya: {replyText}</span>
        </div>
      ) : null}
    </div>
  );
}

function ProviderBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${trailerPalette.border}`,
        fontSize: 16,
        color: trailerPalette.textMuted,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#1a82e2",
        }}
      />
      SendGrid
    </div>
  );
}
