import { useCurrentFrame } from "remotion";

import { monoFontFamily } from "../../../brand";
import { getRiseInStyle, getTypedText } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import { BuilderPanel, ChoicePills, TypedField } from "./builder-parts";

type BuilderPanelTiming = {
  appearFrame: number;
  workStartFrame: number;
};

const templateBody = `{
  "text": "{{ data.subject }}",
  "to": "{{ data.to[0].address }}"
}`;

const templatePreview = `{
  "text": "Order #1042 shipped",
  "to": "maya@example.com"
}`;

/** A webhook template typed by hand, with its live preview. */
export function TemplateBuilder({
  appearFrame,
  workStartFrame,
}: BuilderPanelTiming) {
  const frame = useCurrentFrame();
  const typedBody = getTypedText(templateBody, frame, workStartFrame, 1.2);
  const previewFrame =
    workStartFrame + Math.ceil(templateBody.length / 1.2) + 4;
  const codeBoxStyle = {
    flex: 1,
    margin: 0,
    padding: "12px 14px",
    borderRadius: 10,
    backgroundColor: trailerPalette.surfaceSunken,
    fontFamily: monoFontFamily,
    fontSize: 16,
    lineHeight: 1.6,
    whiteSpace: "pre" as const,
    overflow: "hidden",
  };

  return (
    <BuilderPanel
      title="Webhooks › Templates › New template"
      appearFrame={appearFrame}
    >
      <TypedField
        label="Name"
        value="Ops alert"
        typingStartFrame={workStartFrame - 14}
      />
      <div style={{ display: "flex", gap: 14 }}>
        <pre style={{ ...codeBoxStyle, color: trailerPalette.text }}>
          {typedBody}
        </pre>
        <pre
          style={{
            ...codeBoxStyle,
            ...getRiseInStyle(frame, previewFrame, 12, 8),
            color: trailerPalette.accent,
          }}
        >
          {templatePreview}
        </pre>
      </div>
    </BuilderPanel>
  );
}

/** A new email provider started from blank. */
export function EmailProviderBuilder({
  appearFrame,
  workStartFrame,
}: BuilderPanelTiming) {
  return (
    <BuilderPanel
      title="Mail › Providers › Add provider"
      appearFrame={appearFrame}
    >
      <ChoicePills
        label="Start from"
        choices={["Blank", "SendGrid", "Mailgun"]}
        chosenChoice="Blank"
        chooseFrame={workStartFrame}
      />
      <TypedField
        label="Name"
        value="Acme Mail"
        typingStartFrame={workStartFrame + 12}
      />
      <TypedField
        label="Send path"
        value="POST /v1/messages"
        typingStartFrame={workStartFrame + 30}
        isMonospace
      />
      <TypedField
        label="Response"
        value={'202 { "id": "{{ email.id }}" }'}
        typingStartFrame={workStartFrame + 56}
        isMonospace
      />
    </BuilderPanel>
  );
}

/** A new SMS provider started from a built-in, with its own status names. */
export function SmsProviderBuilder({
  appearFrame,
  workStartFrame,
}: BuilderPanelTiming) {
  return (
    <BuilderPanel
      title="SMS › Providers › Add provider"
      appearFrame={appearFrame}
    >
      <ChoicePills
        label="Start from"
        choices={["Blank", "Twilio", "Vonage"]}
        chosenChoice="Twilio"
        chooseFrame={workStartFrame}
      />
      <TypedField
        label="Name"
        value="Infobip"
        typingStartFrame={workStartFrame + 12}
      />
      <TypedField
        label="Delivered"
        value="DELIVERED_TO_HANDSET"
        typingStartFrame={workStartFrame + 28}
        isMonospace
      />
      <TypedField
        label="Failed"
        value="UNDELIVERABLE_NOT_DELIVERED"
        typingStartFrame={workStartFrame + 58}
        isMonospace
      />
    </BuilderPanel>
  );
}

const upayFlowSteps = ["Wallet number", "OTP", "PIN", "Paid"];

/** A new payment gateway whose checkout flow gets its steps one by one. */
export function PaymentGatewayBuilder({
  appearFrame,
  workStartFrame,
}: BuilderPanelTiming) {
  const frame = useCurrentFrame();

  return (
    <BuilderPanel
      title="Payments › Gateways › Add gateway"
      appearFrame={appearFrame}
    >
      <TypedField label="Name" value="Upay" typingStartFrame={workStartFrame} />
      <div
        style={{ fontSize: 18, color: trailerPalette.textMuted, marginTop: 6 }}
      >
        Checkout flow
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {upayFlowSteps.map((flowStep, stepIndex) => {
          const stepFrame = workStartFrame + 20 + stepIndex * 18;
          const isLastStep = stepIndex === upayFlowSteps.length - 1;
          return (
            <div
              key={flowStep}
              style={{
                ...getRiseInStyle(frame, stepFrame, 12, 12),
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: "12px 18px",
                  borderRadius: 12,
                  fontSize: 19,
                  border: `1px solid ${isLastStep ? trailerPalette.success : trailerPalette.border}`,
                  backgroundColor: isLastStep
                    ? trailerPalette.successSoft
                    : trailerPalette.surfaceRaised,
                }}
              >
                <span
                  style={{ color: trailerPalette.textFaint, marginRight: 8 }}
                >
                  {stepIndex + 1}
                </span>
                {flowStep}
              </div>
              {isLastStep ? null : (
                <span style={{ color: trailerPalette.accent, fontSize: 22 }}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </BuilderPanel>
  );
}
