import type { TerminalLine } from "../../parts/app-terminal";
import {
  WebhookFlowScene,
  type WebhookFlowStep,
} from "../../parts/webhook-flow-scene";
import { SmsPanel } from "./sms-panel";

export const smsSceneDurationFrames = 330;

const replyTypingStartFrame = 120;
const inboundStartFrame = 150;
const appAnswerFrame = 220;
const twilioSignatureHeader = "X-Twilio-Signature";

const smsSteps: WebhookFlowStep[] = [
  {
    startFrame: 60,
    request: {
      formatLabel: "Twilio · status callback",
      method: "POST",
      target: "/sms/status",
      headerLines: [`${twilioSignatureHeader}: 0Kq3n9…=`],
      bodyLines: [
        "MessageSid=SM5f1c0a9e2b7d",
        "MessageStatus=delivered",
        "To=%2B12025550100",
        "ErrorCode=",
      ],
    },
    logLine: "POST /sms/status  delivered",
  },
  {
    startFrame: inboundStartFrame,
    request: {
      formatLabel: "Twilio · inbound SMS",
      method: "POST",
      target: "/sms/inbound",
      headerLines: [`${twilioSignatureHeader}: 3f9XkVb…=`],
      bodyLines: [
        "MessageSid=SM8c2e41d7a0f3",
        "From=%2B12025550100",
        "To=%2B15005550006",
        "Body=YES",
        "NumMedia=0",
      ],
    },
    logLine: "POST /sms/inbound  Body=YES",
  },
];

const appOwnLines: TerminalLine[] = [
  { text: "npm run dev", appearFrame: 14, tone: "command" },
  { text: "ready on http://localhost:8000", appearFrame: 22, tone: "plain" },
  {
    text: "  <- TwiML <Message>Thanks Maya…",
    appearFrame: appAnswerFrame - 6,
    tone: "plain",
  },
];

/** Scene 3: texts, delivery receipts and replies, the way Twilio sends them. */
export function SmsScene() {
  return (
    <WebhookFlowScene
      chapterLabel="02 · SMS"
      headline="Texts, receipts and replies, like Twilio."
      productTitle="SendMock · SMS"
      renderProductPanel={(activeStepIndex) => (
        <SmsPanel
          activeStepIndex={activeStepIndex}
          inboundStartFrame={inboundStartFrame}
          replyTypingStartFrame={replyTypingStartFrame}
          appAnswerFrame={appAnswerFrame}
        />
      )}
      appTitle="acme-shop"
      appOwnLines={appOwnLines}
      steps={smsSteps}
      direction="toApp"
    />
  );
}
