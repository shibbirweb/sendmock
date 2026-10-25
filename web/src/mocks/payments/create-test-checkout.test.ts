import { describe, expect, test } from "vitest";

import type { PaymentOutcomeProfile } from "@/lib/api/types";
import { createMockDatabase } from "@/mocks/db/mock-database";
import { toCheckoutSession } from "@/mocks/payments/checkout-session";
import { createTestCheckout } from "@/mocks/payments/create-test-checkout";

function createWithProfile(
  outcomeProfile: PaymentOutcomeProfile,
  randomValue = 0.5,
) {
  const mockDatabase = createMockDatabase("standard");
  mockDatabase.settings.payment_outcome_profile = outcomeProfile;
  mockDatabase.settings.payment_random_success_rate_percent = 30;
  const paymentDetail = createTestCheckout(
    mockDatabase,
    { provider: "stripe", amount_minor: 2500 },
    Date.now(),
    randomValue,
  );

  return { mockDatabase, paymentDetail };
}

describe("createTestCheckout", () => {
  test("PY-09.4 an interactive checkout waits for its page, in the default currency", () => {
    const { mockDatabase, paymentDetail } = createWithProfile("interactive");

    expect(paymentDetail).toMatchObject({
      status: "requires_payment",
      currency: "USD",
    });
    expect(toCheckoutSession(mockDatabase, paymentDetail)).toMatchObject({
      state: "open",
      merchant_name: "Acme Shop",
      provider_name: "Stripe",
    });
  });

  test("PY-09.4 the outcome profile settles new checkouts at once", () => {
    expect(createWithProfile("auto_success").paymentDetail.status).toBe(
      "succeeded",
    );
    expect(createWithProfile("auto_decline").paymentDetail).toMatchObject({
      status: "failed",
      failure_code: "generic_decline",
    });
    expect(createWithProfile("random", 0.1).paymentDetail.status).toBe(
      "succeeded",
    );
    expect(createWithProfile("random", 0.9).paymentDetail.status).toBe(
      "failed",
    );
  });

  test("PY-09.4 the merchant name and default currency come from Settings > Payments", () => {
    const mockDatabase = createMockDatabase("standard");
    mockDatabase.settings.payment_merchant_name = "Dhaka Books";
    mockDatabase.settings.payment_default_currency = "BDT";
    const paymentDetail = createTestCheckout(mockDatabase, {
      provider: "sslcommerz",
      amount_minor: 120000,
    });

    expect(paymentDetail.currency).toBe("BDT");
    expect(toCheckoutSession(mockDatabase, paymentDetail).merchant_name).toBe(
      "Dhaka Books",
    );
  });
});
