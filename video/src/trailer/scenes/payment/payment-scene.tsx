import type { TerminalLine } from "../../parts/app-terminal";
import {
  WebhookFlowScene,
  type WebhookFlowStep,
} from "../../parts/webhook-flow-scene";
import { CheckoutPanel } from "./checkout-panel";

export const paymentSceneDurationFrames = 300;

const payPressFrame = 80;
const refundPressFrame = 190;
const stripeSignatureHeader = "Stripe-Signature: t=1793001600,v1=5257a8…";

const paymentSteps: WebhookFlowStep[] = [
  {
    startFrame: payPressFrame,
    request: {
      formatLabel: "Stripe · webhook event",
      method: "POST",
      target: "/stripe/webhook",
      headerLines: [stripeSignatureHeader],
      bodyLines: [
        "{",
        '  "type": "checkout.session.completed",',
        '  "data": { "object": {',
        '    "id": "cs_test_a1b2c3",',
        '    "amount_total": 4200,',
        '    "payment_status": "paid"',
        "  } }",
        "}",
      ],
    },
    logLine: "POST /stripe/webhook  paid",
  },
  {
    startFrame: refundPressFrame,
    request: {
      formatLabel: "Stripe · webhook event",
      method: "POST",
      target: "/stripe/webhook",
      headerLines: [stripeSignatureHeader],
      bodyLines: [
        "{",
        '  "type": "charge.refunded",',
        '  "data": { "object": {',
        '    "id": "ch_test_9z8y7x",',
        '    "amount_refunded": 4200',
        "  } }",
        "}",
      ],
    },
    logLine: "POST /stripe/webhook  refunded",
  },
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
