import { monoFontFamily } from "../../../brand";
import { getProgress } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import { useDesignFrame } from "../../trailer-time";

type CheckoutPanelProps = {
  activeStepIndex: number;
  declinePressFrame: number;
  payPressFrame: number;
  refundPressFrame: number;
};

const orderStatuses = [
  { label: "Pending", color: trailerPalette.textMuted },
  { label: "Declined", color: trailerPalette.danger },
  { label: "Paid", color: trailerPalette.success },
  { label: "Refunded", color: trailerPalette.amber },
];

/** SendMock's test checkout for Stripe, with its one-press test outcomes. */
export function CheckoutPanel({
  activeStepIndex,
  declinePressFrame,
  payPressFrame,
  refundPressFrame,
}: CheckoutPanelProps) {
  const frame = useDesignFrame();
  const orderStatus = orderStatuses[activeStepIndex + 1] ?? orderStatuses[0];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 22, padding: 28 }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          padding: "5px 12px",
          borderRadius: 8,
          backgroundColor: "rgba(227, 179, 65, 0.14)",
          color: trailerPalette.amber,
          fontSize: 15,
          letterSpacing: 1.5,
        }}
      >
        TEST MODE · STRIPE
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, color: trailerPalette.textMuted }}>
            Acme Shop · Order #1042
          </div>
          <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -1 }}>
            $42.00
          </div>
        </div>
        <div
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 20,
            fontWeight: 600,
            color: orderStatus?.color,
            border: `1px solid ${orderStatus?.color}`,
            boxShadow:
              activeStepIndex >= 0
                ? `0 0 28px ${orderStatus?.color}44`
                : undefined,
          }}
        >
          {orderStatus?.label}
        </div>
      </div>
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 12,
          border: `1px solid ${trailerPalette.border}`,
          fontFamily: monoFontFamily,
          fontSize: 22,
          color: trailerPalette.textMuted,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>4242 4242 4242 4242</span>
        <span>12/34 · 123</span>
      </div>
      <div
        style={{
          borderRadius: 14,
          border: `1px dashed ${trailerPalette.border}`,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Test controls</div>
        <div
          style={{
            fontSize: 16,
            color: trailerPalette.textMuted,
            marginTop: 4,
          }}
        >
          Skip the form and pick the outcome.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          <ControlButton
            label="Pay successfully"
            isPrimary
            pressAmount={getPressAmount(frame, payPressFrame)}
          />
          <ControlButton
            label="Decline"
            pressAmount={getPressAmount(frame, declinePressFrame)}
          />
          <ControlButton label="Require 3-D Secure" pressAmount={0} />
          <ControlButton
            label="Refund"
            pressAmount={getPressAmount(frame, refundPressFrame)}
          />
        </div>
      </div>
    </div>
  );
}

/** Rises to 1 just before the press and settles back, like a pressed state. */
function getPressAmount(frame: number, pressFrame: number): number {
  const pressIn = getProgress(frame, pressFrame - 8, 6);
  const release = getProgress(frame, pressFrame + 4, 10);
  return pressIn * (1 - release * 0.6);
}

type ControlButtonProps = {
  label: string;
  isPrimary?: boolean;
  pressAmount: number;
};

function ControlButton({
  label,
  isPrimary = false,
  pressAmount,
}: ControlButtonProps) {
  return (
    <div
      style={{
        padding: "14px 0",
        textAlign: "center",
        borderRadius: 10,
        fontSize: 19,
        fontWeight: 500,
        transform: `scale(${1 - pressAmount * 0.04})`,
        color: isPrimary ? trailerPalette.canvas : trailerPalette.text,
        backgroundColor: isPrimary
          ? trailerPalette.accent
          : trailerPalette.surfaceRaised,
        border: `1px solid ${isPrimary ? trailerPalette.accent : trailerPalette.border}`,
        boxShadow:
          pressAmount > 0.01
            ? `0 0 ${40 * pressAmount}px rgba(124, 207, 189, 0.5)`
            : undefined,
      }}
    >
      {label}
    </div>
  );
}
