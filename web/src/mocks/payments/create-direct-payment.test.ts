import { beforeEach, describe, expect, test } from "vitest";

import type { PaymentCreateRequest } from "@/lib/api/types";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { createDirectPayment } from "@/mocks/payments/create-direct-payment";

const createdAtMs = Date.parse("2026-11-06T10:00:00Z");

function payWithCard(
  cardNumber: string,
  requestChanges: Partial<PaymentCreateRequest> = {},
) {
  return createDirectPayment(
    mockDatabase,
    {
      provider: "stripe",
      amount_minor: 1999,
      currency: "USD",
      card_number: cardNumber,
      ...requestChanges,
    },
    createdAtMs,
  );
}

function readPayment(createResult: ReturnType<typeof payWithCard>) {
  if (!createResult.isApplied) {
    throw new Error(createResult.message);
  }

  return createResult.payment;
}

beforeEach(() => {
  replaceMockDatabase("empty");
});

describe("a payment paid with a test card through the API", () => {
  test("PY-02.1 takes the test card's outcome and has no checkout page", () => {
    const paidPayment = readPayment(payWithCard("4242424242424242"));
    const declinedPayment = readPayment(payWithCard("4000000000009995"));

    expect(paidPayment.status).toBe("succeeded");
    expect(paidPayment.checkout_url).toBeNull();
    expect(declinedPayment.status).toBe("failed");
    expect(declinedPayment.failure_code).toBe("insufficient_funds");
    expect(mockDatabase.payments).toHaveLength(2);
  });

  test("a 3-D Secure card fails, as there is no page to approve it on", () => {
    const payment = readPayment(payWithCard("4000002500003155"));

    expect(payment.status).toBe("failed");
    expect(payment.failure_code).toBe("authentication_failed");
  });

  test("manual capture leaves the payment authorized", () => {
    const payment = readPayment(
      payWithCard("4242424242424242", { capture_method: "manual" }),
    );

    expect(payment.status).toBe("authorized");
  });

  test("PY-01.2 a real card number is refused and nothing is stored", () => {
    const createResult = payWithCard("4111111111111111");

    expect(createResult).toMatchObject({ isApplied: false, statusCode: 422 });
    expect(mockDatabase.payments).toHaveLength(0);
  });

  test("PY-02.3 keeps minor units and stores the currency in capitals", () => {
    const yenPayment = readPayment(
      payWithCard("4242424242424242", { amount_minor: 1500, currency: "jpy" }),
    );
    const takaPayment = readPayment(
      payWithCard("4242424242424242", {
        amount_minor: 150000,
        currency: "BDT",
      }),
    );

    expect([yenPayment.amount_minor, yenPayment.currency]).toEqual([
      1500,
      "JPY",
    ]);
    expect([takaPayment.amount_minor, takaPayment.currency]).toEqual([
      150000,
      "BDT",
    ]);
    expect(payWithCard("4242424242424242", { currency: "US" })).toMatchObject({
      isApplied: false,
      statusCode: 400,
    });
  });
});
