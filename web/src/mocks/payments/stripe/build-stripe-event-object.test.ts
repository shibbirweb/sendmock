import { describe, expect, test } from "vitest";

import type { PaymentDetail } from "@/lib/api/types";
import {
  buildProviderEventObject,
  buildStripeEventObject,
} from "@/mocks/payments/stripe/build-stripe-event-object";

function buildPaidStripePayment(): PaymentDetail {
  return {
    id: "01JPAYMENT0000000000000000",
    provider: "stripe",
    provider_name: "Stripe",
    provider_reference: "cs_test_3PaidIntent",
    amount_minor: 2000,
    currency: "USD",
    status: "succeeded",
    customer_email: "buyer@example.com",
    customer_name: null,
    failure_code: null,
    refunded_minor: 0,
    created_at: "2026-11-05T10:00:00Z",
    provider_ids: {
      checkout_session: "cs_test_3PaidIntent",
      payment_intent: "pi_3PaidIntent",
    },
    customer_phone: null,
    method: {
      kind: "card",
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2034,
    },
    line_items: [],
    metadata: { order_id: "1001" },
    success_url: "https://shop.example/success",
    fail_url: null,
    cancel_url: "https://shop.example/cancel",
    checkout_url: null,
    redirect: null,
    captured_minor: 2000,
    capture_method: "automatic",
    method_key: "card",
    dispute: null,
    timeline: [],
    notifications: [],
  };
}

describe("Stripe event objects", () => {
  test("a checkout.session event carries the completed, paid Checkout Session", () => {
    expect(
      buildStripeEventObject(
        buildPaidStripePayment(),
        "checkout.session.completed",
      ),
    ).toMatchObject({
      id: "cs_test_3PaidIntent",
      object: "checkout.session",
      status: "complete",
      payment_status: "paid",
      payment_intent: "pi_3PaidIntent",
      metadata: { order_id: "1001" },
    });
  });

  test("a payment_intent event carries the PaymentIntent with its last error after a decline", () => {
    const declinedPayment: PaymentDetail = {
      ...buildPaidStripePayment(),
      status: "failed",
      failure_code: "insufficient_funds",
      captured_minor: 0,
    };

    expect(
      buildStripeEventObject(declinedPayment, "payment_intent.payment_failed"),
    ).toMatchObject({
      id: "pi_3PaidIntent",
      object: "payment_intent",
      status: "requires_payment_method",
      last_payment_error: {
        code: "card_declined",
        decline_code: "insufficient_funds",
        type: "card_error",
      },
    });
  });

  test("charge.refunded carries the Charge with the refunded amount and no refunds list", () => {
    const refundedPayment: PaymentDetail = {
      ...buildPaidStripePayment(),
      status: "partially_refunded",
      refunded_minor: 500,
    };
    const charge = buildStripeEventObject(refundedPayment, "charge.refunded");

    expect(charge).toMatchObject({
      id: "ch_3PaidIntent",
      object: "charge",
      amount_refunded: 500,
      refunded: false,
      payment_intent: "pi_3PaidIntent",
    });
    expect(charge).not.toHaveProperty("refunds");
  });

  test("a charge.dispute event carries the Dispute, due a week after it opened", () => {
    const disputedPayment: PaymentDetail = {
      ...buildPaidStripePayment(),
      status: "disputed",
      dispute: { status: "needs_response", reason: "fraudulent" },
      timeline: [
        {
          kind: "dispute_opened",
          description: "Disputed",
          created_at: "2026-11-05T12:00:00Z",
        },
      ],
    };

    expect(
      buildStripeEventObject(disputedPayment, "charge.dispute.created"),
    ).toMatchObject({
      id: "dp_3PaidIntent",
      object: "dispute",
      charge: "ch_3PaidIntent",
      status: "needs_response",
      created: 1793880000,
      evidence_details: { due_by: 1793880000 + 7 * 24 * 60 * 60 },
    });
  });

  test("other gateways and unknown event names have no object", () => {
    const paidPayment = buildPaidStripePayment();

    expect(
      buildProviderEventObject("paypal", paidPayment, "charge.refunded"),
    ).toBeNull();
    expect(buildStripeEventObject(paidPayment, "invoice.paid")).toBeNull();
  });
});
