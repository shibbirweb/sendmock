import type { TerminalLine } from "../../parts/app-terminal";
import {
  buildWebhookFlowCues,
  WebhookFlowScene,
  type WebhookFlowStep,
} from "../../parts/webhook-flow-scene";
import type { UiCue } from "../../ui-cues";
import { type CaughtCall, CatcherPanel } from "./catcher-panel";

export const anyApiSceneDurationFrames = 270;

const travelArrivalFrames = 26;

const anyApiSteps: WebhookFlowStep[] = [
  {
    startFrame: 50,
    request: {
      formatLabel: "Your app · Slack incoming webhook",
      method: "POST",
      target: "hooks.slack.com/services/T0…",
      headerLines: ["Content-Type: application/json"],
      bodyLines: ['{ "text": "Order #1042 shipped" }'],
    },
    logLine: "-> POST hooks.slack.com",
  },
  {
    startFrame: 120,
    request: {
      formatLabel: "Your app · Discord webhook",
      method: "POST",
      target: "discord.com/api/webhooks/…",
      headerLines: ["Content-Type: application/json"],
      bodyLines: [
        "{",
        '  "embeds": [{',
        '    "title": "New order #1043",',
        '    "description": "2 items · $18.50"',
        "  }]",
        "}",
      ],
    },
    logLine: "-> POST discord.com/api/webhooks",
  },
  {
    startFrame: 190,
    request: {
      formatLabel: "Your app · any HTTP API",
      method: "POST",
      target: "api.acme-crm.test/v1/contacts",
      headerLines: ["Authorization: Bearer ••••3f9a"],
      bodyLines: ['{ "email": "maya@example.com" }'],
    },
    logLine: "-> POST api.acme-crm.test",
  },
];

const caughtCalls: CaughtCall[] = [
  {
    catchFrame: 50 + travelArrivalFrames,
    host: "hooks.slack.com",
    path: "/services/T0…",
    answer: "200 ok",
    previewTitle: "Slack message",
    previewText: "Order #1042 shipped",
  },
  {
    catchFrame: 120 + travelArrivalFrames,
    host: "discord.com",
    path: "/api/webhooks/…",
    answer: "204",
    previewTitle: "New order #1043",
    previewText: "2 items · $18.50",
  },
  {
    catchFrame: 190 + travelArrivalFrames,
    host: "api.acme-crm.test",
    path: "/v1/contacts",
    answer: "201",
    previewTitle: "JSON body",
    previewText: '{ "email": "maya@example.com" }',
  },
];

/** Sounds: each call is caught with a blip, then SendMock's answer returns as a success. */
export const anyApiSceneCues: UiCue[] = [
  ...buildWebhookFlowCues(anyApiSteps, () => "arrive"),
  ...caughtCalls.map((caughtCall): UiCue => ({
    frame: caughtCall.catchFrame + 8,
    cueKind: "success",
  })),
];

const appOwnLines: TerminalLine[] = [
  { text: "npm run dev", appearFrame: 14, tone: "command" },
  { text: "ready on http://localhost:8000", appearFrame: 22, tone: "plain" },
  ...caughtCalls.map((caughtCall) => ({
    text: `   <- ${caughtCall.answer}`,
    appearFrame: caughtCall.catchFrame + 8,
    tone: "plain" as const,
  })),
];

/** Scene 5: any other API call your app makes, caught and answered. */
export function AnyApiScene() {
  return (
    <WebhookFlowScene
      chapterLabel="04 · Any API"
      headline="Any other API call, caught."
      productTitle="SendMock · HTTP catcher"
      renderProductPanel={() => <CatcherPanel caughtCalls={caughtCalls} />}
      appTitle="acme-shop"
      appOwnLines={appOwnLines}
      steps={anyApiSteps}
      direction="fromApp"
    />
  );
}
