import { describe, expect, test } from "vitest";

import type { PaymentDetail } from "@/lib/api/types";
import { buildPayPalEventObject } from "@/mocks/payments/paypal/build-paypal-event-object";
import { buildProviderEventObject } from "@/mocks/payments/stripe/build-stripe-event-object";

function buildPaidPayPalPayment(): PaymentDetail {
  return {
    id: "01jpayment0000000000000042",
    provider: "paypal",
    provider_name: "PayPal",
    provider_reference: "5O190127TN",
    amount_minor: 2500,
    currency: "USD",
    status: "succeeded",
    customer_email: "buyer@example.com",
    customer_name: null,
    failure_code: null,
    refunded_minor: 0,
    created_at: "2026-11-05T10:00:00Z",
    provider_ids: { order: "5O190127TN" },
    customer_phone: null,
    method: {
      kind: "wallet",
      wallet_name: "PayPal",
      masked_number: "sb-buyer",
    },
    line_items: [],
    metadata: {},
    success_url: "https://shop.example/paypal/return",
    fail_url: null,
    cancel_url: "https://shop.example/paypal/cancel",
    checkout_url: null,
    redirect: null,
    captured_minor: 2500,
    capture_method: "manual",
    method_key: "paypal_account",
    dispute: null,
    timeline: [],
    notifications: [],
  };
}

describe("PayPal event objects", () => {
  test("PY-05.2 a CHECKOUT.ORDER event carries the order", () => {
    expect(
      buildPayPalEventObject(
        { ...buildPaidPayPalPayment(), status: "authorized" },
        "CHECKOUT.ORDER.APPROVED",
      ),
    ).toMatchObject({
      id: "5O190127TN",
      intent: "CAPTURE",
      status: "APPROVED",
      purchase_units: [{ amount: { currency_code: "USD", value: "25.00" } }],
    });
  });

  test("PY-05.2 a PAYMENT.CAPTURE event carries the capture and its order", () => {
    expect(
      buildPayPalEventObject(
        buildPaidPayPalPayment(),
        "PAYMENT.CAPTURE.COMPLETED",
      ),
    ).toMatchObject({
      id: "C0000000000000042",
      status: "COMPLETED",
      supplementary_data: { related_ids: { order_id: "5O190127TN" } },
    });
    expect(
      buildPayPalEventObject(
        { ...buildPaidPayPalPayment(), status: "failed" },
        "PAYMENT.CAPTURE.DENIED",
      ),
    ).toMatchObject({ status: "DECLINED" });
  });

  test("PY-05.2 a refund event carries the refund, a dispute event the dispute", () => {
    const refundedPayment: PaymentDetail = {
      ...buildPaidPayPalPayment(),
      status: "partially_refunded",
      refunded_minor: 1000,
    };
    expect(
      buildPayPalEventObject(refundedPayment, "PAYMENT.CAPTURE.REFUNDED"),
    ).toMatchObject({
      id: "R0000000000000042",
      amount: { value: "10.00" },
      status: "COMPLETED",
    });

    const disputedPayment: PaymentDetail = {
      ...buildPaidPayPalPayment(),
      status: "disputed",
      dispute: { status: "needs_response", reason: "fraudulent" },
    };
    const openDispute = buildPayPalEventObject(
      disputedPayment,
      "CUSTOMER.DISPUTE.CREATED",
    );
    expect(openDispute).toMatchObject({
      dispute_id: "PP-D-C0000000000000042",
      reason: "UNAUTHORISED",
      status: "OPEN",
    });
    expect(openDispute).not.toHaveProperty("dispute_outcome");
  });

  test("a name PayPal does not send has no object, and only PayPal's gateway builds them", () => {
    expect(
      buildPayPalEventObject(
        buildPaidPayPalPayment(),
        "PAYMENT.SALE.COMPLETED",
      ),
    ).toBeNull();
    expect(
      buildProviderEventObject(
        "paypal",
        buildPaidPayPalPayment(),
        "PAYMENT.CAPTURE.COMPLETED",
      ),
    ).not.toBeNull();
    expect(
      buildProviderEventObject(
        "bkash",
        buildPaidPayPalPayment(),
        "PAYMENT.CAPTURE.COMPLETED",
      ),
    ).toBeNull();
  });
});
