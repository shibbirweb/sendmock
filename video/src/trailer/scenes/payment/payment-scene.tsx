import type { TerminalLine } from "../../parts/app-terminal";
import {
  buildWebhookFlowCues,
  WebhookFlowScene,
  type WebhookFlowStep,
} from "../../parts/webhook-flow-scene";
import type { UiCue } from "../../ui-cues";
import { CheckoutPanel } from "./checkout-panel";

export const paymentSceneDurationFrames = 300;

const declinePressFrame = 60;
const payPressFrame = 140;
const refundPressFrame = 220;
const stripeSignatureHeader = "Stripe-Signature: t=1793001600,v1=5257a8…";

function buildStripeEventRequest(bodyLines: string[]) {
  return {
    formatLabel: "Stripe · webhook event",
    method: "POST",
    target: "/stripe/webhook",
    headerLines: [stripeSignatureHeader],
    bodyLines,
  };
}

const paymentSteps: WebhookFlowStep[] = [
  {
    startFrame: declinePressFrame,
    request: buildStripeEventRequest([
      "{",
      '  "type": "payment_intent.payment_failed",',
      '  "data": { "object": {',
      '    "last_payment_error": {',
      '      "code": "card_declined"',
      "  } } }",
      "}",
    ]),
    logLine: "POST /stripe/webhook  declined",
  },
  {
    startFrame: payPressFrame,
    request: buildStripeEventRequest([
      "{",
      '  "type": "checkout.session.completed",',
      '  "data": { "object": {',
      '    "amount_total": 4200,',
      '    "payment_status": "paid"',
      "  } }",
      "}",
    ]),
    logLine: "POST /stripe/webhook  paid",
  },
  {
    startFrame: refundPressFrame,
    request: buildStripeEventRequest([
      "{",
      '  "type": "charge.refunded",',
      '  "data": { "object": {',
      '    "id": "ch_test_9z8y7x",',
      '    "amount_refunded": 4200',
      "  } }",
      "}",
    ]),
    logLine: "POST /stripe/webhook  refunded",
  },
];

/**
 * Sounds: a click for each test control; the order's new status answers at
 * once (an error tone for the decline, a chime for paid and refunded), and
 * each Stripe event lands in your app with a soft blip.
 */
export const paymentSceneCues: UiCue[] = [
  ...buildWebhookFlowCues(paymentSteps, () => "arrive"),
  ...paymentSteps.flatMap((step, stepIndex): UiCue[] => [
    { frame: step.startFrame - 6, cueKind: "click" },
    { frame: step.startFrame, cueKind: stepIndex === 0 ? "error" : "success" },
  ]),
];

const appOwnLines: TerminalLine[] = [
  { text: "npm run dev", appearFrame: 14, tone: "command" },
  { text: "ready on http://localhost:8000", appearFrame: 22, tone: "plain" },
];

/** Scene 4: test checkouts that pay, decline and refund, with Stripe's events. */
export function PaymentScene() {
  return (
    <WebhookFlowScene
      chapterLabel="03 · Payments"
      headline="Checkouts that pay, decline and refund."
      productTitle="SendMock · Checkout"
      renderProductPanel={(activeStepIndex) => (
        <CheckoutPanel
          activeStepIndex={activeStepIndex}
          declinePressFrame={declinePressFrame}
          payPressFrame={payPressFrame}
          refundPressFrame={refundPressFrame}
        />
      )}
      appTitle="acme-shop"
      appOwnLines={appOwnLines}
      steps={paymentSteps}
      direction="toApp"
    />
  );
}
