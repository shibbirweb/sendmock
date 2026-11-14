import type { TerminalLine } from "../../parts/app-terminal";
import {
  buildWebhookFlowCues,
  WebhookFlowScene,
  type WebhookFlowStep,
} from "../../parts/webhook-flow-scene";
import { getTypingDurationFrames } from "../../trailer-motion";
import { createTypingCue, type UiCue } from "../../ui-cues";
import { MailPanel, replyText } from "./mail-panel";

export const emailSceneDurationFrames = 330;

const replyTypingStartFrame = 180;
const replyStepStartFrame =
  replyTypingStartFrame + getTypingDurationFrames(replyText) + 10;

const sendGridSignatureHeader = "X-Twilio-Email-Event-Webhook-Signature";

function buildSendGridEventBody(eventName: string): string[] {
  return [
    "[{",
    `  "event": "${eventName}",`,
    '  "email": "maya@example.com",',
    '  "sg_message_id": "14c5d75ce93.dfd.64b",',
    '  "timestamp": 1793001600',
    "}]",
  ];
}

const emailSteps: WebhookFlowStep[] = [
  {
    startFrame: 60,
    request: {
      formatLabel: "SendGrid · Event Webhook",
      method: "POST",
      target: "/webhooks/sendgrid",
      headerLines: [`${sendGridSignatureHeader}: MEUC…`],
      bodyLines: buildSendGridEventBody("delivered"),
    },
    logLine: "POST /webhooks/sendgrid  delivered",
  },
  {
    startFrame: 125,
    request: {
      formatLabel: "SendGrid · Event Webhook",
      method: "POST",
      target: "/webhooks/sendgrid",
      headerLines: [`${sendGridSignatureHeader}: MEQC…`],
      bodyLines: buildSendGridEventBody("open"),
    },
    logLine: "POST /webhooks/sendgrid  open",
  },
  {
    startFrame: replyStepStartFrame,
    request: {
      formatLabel: "SendGrid · Inbound Parse",
      method: "POST",
      target: "/mail/inbound",
      headerLines: ["Content-Type: multipart/form-data"],
      bodyLines: [
        "from=Maya <maya@example.com>",
        "to=orders@acme.test",
        "subject=Re: Your order #1042 has shipped",
        `text=${replyText}`,
      ],
    },
    logLine: "POST /mail/inbound  reply from Maya",
  },
];

/** Sounds: each event lights its chip as it is sent; Maya's reply is typed. */
export const emailSceneCues: UiCue[] = [
  ...buildWebhookFlowCues(emailSteps),
  ...emailSteps.map((step): UiCue => ({
    frame: step.startFrame,
    cueKind: "fire",
  })),
  createTypingCue(replyTypingStartFrame, replyText, 13 / 30),
];

const appOwnLines: TerminalLine[] = [
  { text: "npm run dev", appearFrame: 14, tone: "command" },
  { text: "ready on http://localhost:8000", appearFrame: 22, tone: "plain" },
];

/** Scene 2: every email event, posted back to your app in SendGrid's format. */
export function EmailScene() {
  return (
    <WebhookFlowScene
      chapterLabel="01 · Email"
      headline="Every email event, back to your app."
      productTitle="SendMock · Mail"
      renderProductPanel={(activeStepIndex) => (
        <MailPanel
          activeStepIndex={activeStepIndex}
          stepStartFrames={emailSteps.map((step) => step.startFrame)}
          replyTypingStartFrame={replyTypingStartFrame}
        />
      )}
      appTitle="acme-shop"
      appOwnLines={appOwnLines}
      steps={emailSteps}
      direction="toApp"
    />
  );
}
