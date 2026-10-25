import { describe, expect, test } from "vitest";

import type { CheckoutCard, PaymentDetail } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import {
  completeCheckout,
  toCheckoutSession,
} from "@/mocks/payments/complete-checkout";

function setUp(customerName: string) {
  const mockDatabase = createMockDatabase("standard");
  const paymentDetail = mockDatabase.payments.find(
    (payment) => payment.customer_name === customerName,
  );
  if (paymentDetail === undefined) {
    throw new Error(`The fixtures need ${customerName}'s payment.`);
  }

  return { mockDatabase, paymentDetail: paymentDetail as PaymentDetail };
}

function card(cardNumber: string): CheckoutCard {
  return {
    number: cardNumber,
    exp_month: 12,
    exp_year: 2034,
    cvc: "123",
    holder_name: "Test",
  };
}

describe("completeCheckout", () => {
  test("PY-03.1 paying with a test card succeeds and keeps only brand, last 4 and expiry", () => {
    const { mockDatabase, paymentDetail } = setUp("Lena Vogel");

    expect(
      completeCheckout(mockDatabase, paymentDetail, {
        action: "pay",
        card: card("4242 4242 4242 4242"),
      }),
    ).toEqual({ isApplied: true });
    expect(toCheckoutSession(mockDatabase, paymentDetail)).toMatchObject({
      state: "completed",
      redirect: { outcome: "success" },
    });
    // PY-01.2: nothing beyond brand, last 4 and expiry is stored.
    expect(paymentDetail.method).toEqual({
      kind: "card",
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2034,
    });
    // The typed number is in neither the payment nor its notifications; only
    // the Card method's own test card list holds test numbers.
    expect(JSON.stringify(paymentDetail)).not.toContain("4242424242424242");
    expect(JSON.stringify(mockDatabase.webhookDeliveries)).not.toContain(
      "4242424242424242",
    );
  });

  test("PY-01.1 a real card number is refused and leaves no trace", () => {
    const { mockDatabase, paymentDetail } = setUp("Lena Vogel");
    const timelineBefore = paymentDetail.timeline.length;

    expect(
      completeCheckout(mockDatabase, paymentDetail, {
        action: "pay",
        card: card("4111 1111 1111 1111"),
      }),
    ).toEqual({
      isApplied: false,
      statusCode: 422,
      message: "Use a test card: real card numbers are never accepted",
    });
    expect(paymentDetail.method).toBeNull();
    expect(paymentDetail.timeline).toHaveLength(timelineBefore);
    expect(JSON.stringify(mockDatabase)).not.toContain("4111");
  });

  test("PY-03.1 the 3-D Secure card asks for a challenge; failing it declines", () => {
    const { mockDatabase, paymentDetail } = setUp("Lena Vogel");

    completeCheckout(mockDatabase, paymentDetail, {
      action: "pay",
      card: card("4000002500003155"),
    });
    expect(toCheckoutSession(mockDatabase, paymentDetail).state).toBe(
      "requires_three_ds",
    );

    completeCheckout(mockDatabase, paymentDetail, { action: "three_ds_fail" });
    expect(toCheckoutSession(mockDatabase, paymentDetail)).toMatchObject({
      state: "failed",
      failure_code: "authentication_failed",
    });
  });

  test("PY-03.1 cancel and delay give their outcomes", () => {
    const canceled = setUp("Omar Farouk");
    completeCheckout(canceled.mockDatabase, canceled.paymentDetail, {
      action: "cancel",
    });
    expect(
      toCheckoutSession(canceled.mockDatabase, canceled.paymentDetail),
    ).toMatchObject({
      state: "canceled",
      redirect: { outcome: "cancel" },
    });
    expect(
      canceled.paymentDetail.notifications.at(-1)?.provider_event_name,
    ).toBe("PAYMENT.AUTHORIZATION.VOIDED");

    const delayed = setUp("Nadia Islam");
    completeCheckout(delayed.mockDatabase, delayed.paymentDetail, {
      action: "delay",
    });
    expect(
      toCheckoutSession(delayed.mockDatabase, delayed.paymentDetail).state,
    ).toBe("pending");
  });

  test("PY-03.1 bKash pays with a test wallet; a wrong PIN is asked again", () => {
    const { mockDatabase, paymentDetail } = setUp("Ruma Begum");

    expect(
      completeCheckout(mockDatabase, paymentDetail, {
        action: "pay",
        wallet: { number: "01770000003", otp: "123456", pin: "12121" },
      }),
    ).toMatchObject({ isApplied: false, message: "Wrong PIN. Try again." });
    completeCheckout(mockDatabase, paymentDetail, {
      action: "pay",
      wallet: { number: "01770000001", otp: "123456", pin: "12121" },
    });
    expect(paymentDetail).toMatchObject({
      status: "succeeded",
      method: { kind: "wallet", masked_number: "01770****01" },
    });
  });

  test("PY-03.3 a finished checkout cannot be paid again", () => {
    const { mockDatabase, paymentDetail } = setUp("Ayesha Khan");

    expect(toCheckoutSession(mockDatabase, paymentDetail).state).toBe(
      "completed",
    );
    expect(
      completeCheckout(mockDatabase, paymentDetail, {
        action: "pay",
        card: card("4242424242424242"),
      }),
    ).toEqual({
      isApplied: false,
      statusCode: 409,
      message: "This checkout is closed and cannot be paid again",
    });
  });
});
