import { describe, expect, it } from "vitest";

import { readPaymentProviderEventName } from "@/lib/payments/payment-provider-event-names";

describe("readPaymentProviderEventName", () => {
  it("names an event as each provider does", () => {
    expect(readPaymentProviderEventName("payment.succeeded", "stripe")).toBe(
      "payment_intent.succeeded",
    );
    expect(readPaymentProviderEventName("payment.succeeded", "paypal")).toBe(
      "PAYMENT.CAPTURE.COMPLETED",
    );
    expect(
      readPaymentProviderEventName("payment.succeeded", "paypal_ipn"),
    ).toBe("Completed");
    expect(readPaymentProviderEventName("payment.failed", "sslcommerz")).toBe(
      "FAILED",
    );
    expect(readPaymentProviderEventName("payment.canceled", "bkash")).toBe(
      "cancel",
    );
    expect(readPaymentProviderEventName("payment.succeeded", "razorpay")).toBe(
      "payment.captured",
    );
    expect(readPaymentProviderEventName("payment.refunded", "paddle")).toBe(
      "adjustment.created",
    );
  });

  it("keeps the native name when the provider has none or is unknown", () => {
    expect(readPaymentProviderEventName("payment.created", "razorpay")).toBe(
      "payment.created",
    );
    expect(readPaymentProviderEventName("payment.succeeded", "nagad")).toBe(
      "payment.succeeded",
    );
  });
});
