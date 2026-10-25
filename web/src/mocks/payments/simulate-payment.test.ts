import { describe, expect, test } from "vitest";

import type { PaymentDetail } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import { simulatePayment } from "@/mocks/payments/simulate-payment";

function findPayment(
  mockDatabase: ReturnType<typeof createMockDatabase>,
  customerName: string,
): PaymentDetail {
  const paymentDetail = mockDatabase.payments.find(
    (payment) => payment.customer_name === customerName,
  );
  if (paymentDetail === undefined) {
    throw new Error(`The fixtures need ${customerName}'s payment.`);
  }

  return paymentDetail;
}

describe("simulatePayment", () => {
  test("PY-09.3 Succeed pays a checkout, redirects to success and notifies", () => {
    const mockDatabase = createMockDatabase("standard");
    const stripeCheckout = findPayment(mockDatabase, "Lena Vogel");
    const deliveryCountBefore = mockDatabase.webhookDeliveries.length;

    expect(
      simulatePayment(mockDatabase, stripeCheckout, { action: "succeed" }),
    ).toEqual({
      isApplied: true,
    });
    expect(stripeCheckout).toMatchObject({
      status: "succeeded",
      captured_minor: 1500,
      checkout_url: null,
      redirect: { outcome: "success", method: "GET" },
      method: { kind: "card", last4: "4242" },
    });
    expect(
      stripeCheckout.notifications.map(
        (notification) => notification.provider_event_name,
      ),
    ).toEqual(["checkout.session.completed", "payment_intent.succeeded"]);
    expect(mockDatabase.webhookDeliveries).toHaveLength(
      deliveryCountBefore + 2,
    );
    expect(
      mockDatabase.webhookDeliveries[0]?.request?.headers["stripe-signature"],
    ).toMatch(/^t=\d+,v1=/);
  });

  test("PY-09.3 SSLCommerz sends only its IPN, as a form with the documented fields", () => {
    const mockDatabase = createMockDatabase("standard");
    const sslcommerzCheckout = findPayment(mockDatabase, "Nadia Islam");

    simulatePayment(mockDatabase, sslcommerzCheckout, {
      action: "decline",
      decline_reason: "insufficient_funds",
    });

    expect(sslcommerzCheckout).toMatchObject({
      status: "failed",
      failure_code: "insufficient_funds",
      redirect: { outcome: "fail", method: "POST" },
    });
    expect(
      sslcommerzCheckout.notifications.map(
        (notification) => notification.provider_event_name,
      ),
    ).toEqual(["FAILED"]);
    const ipnBody = new URLSearchParams(
      mockDatabase.webhookDeliveries[0]?.request?.body ?? "",
    );
    expect(ipnBody.get("status")).toBe("FAILED");
    expect(ipnBody.get("tran_id")).toBe(sslcommerzCheckout.provider_reference);
  });

  test("PY-07.2 partial then full refunds, and a refund above what is left is refused", () => {
    const mockDatabase = createMockDatabase("standard");
    const paidPayment = findPayment(mockDatabase, "Ayesha Khan");

    simulatePayment(mockDatabase, paidPayment, {
      action: "refund",
      refund_amount_minor: 1000,
    });
    expect(paidPayment).toMatchObject({
      status: "partially_refunded",
      refunded_minor: 1000,
    });

    expect(
      simulatePayment(mockDatabase, paidPayment, {
        action: "refund",
        refund_amount_minor: 3901,
      }),
    ).toEqual({
      isApplied: false,
      statusCode: 422,
      message: "That is more than is left to refund",
    });

    simulatePayment(mockDatabase, paidPayment, { action: "refund" });
    expect(paidPayment).toMatchObject({
      status: "refunded",
      refunded_minor: 4900,
    });
  });

  test("PY-07.1 an authorized payment is captured or voided", () => {
    const mockDatabase = createMockDatabase("standard");
    const authorizedPayment = findPayment(mockDatabase, "Acme Ops");

    simulatePayment(mockDatabase, authorizedPayment, { action: "capture" });

    expect(authorizedPayment).toMatchObject({
      status: "succeeded",
      captured_minor: 25000,
    });
    expect(authorizedPayment.timeline.at(-2)?.kind).toBe("captured");
  });

  test("PY-07.3 a dispute opens and a lost one returns the money", () => {
    const mockDatabase = createMockDatabase("standard");
    const disputedPayment = findPayment(mockDatabase, "J. Doe");

    simulatePayment(mockDatabase, disputedPayment, {
      action: "resolve_dispute",
      dispute_outcome: "lost",
    });

    expect(disputedPayment).toMatchObject({
      status: "refunded",
      refunded_minor: 5900,
      dispute: { status: "lost" },
    });
  });

  test("PY-09.3 an action the status does not allow is refused", () => {
    const mockDatabase = createMockDatabase("standard");
    const refundedPayment = findPayment(mockDatabase, "Yuki Sato");

    expect(
      simulatePayment(mockDatabase, refundedPayment, { action: "succeed" }),
    ).toMatchObject({
      isApplied: false,
      statusCode: 409,
    });
  });
});
