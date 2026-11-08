import { beforeEach, describe, expect, test } from "vitest";

import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import {
  advanceSubscription,
  cancelSubscription,
  createSubscription,
  type PaymentSubscriptionRecord,
} from "@/mocks/payments/subscriptions/payment-subscriptions";

const startMs = Date.parse("2026-01-31T10:00:00Z");

function startSubscription(
  cardNumber: string,
  trialDays = 0,
): PaymentSubscriptionRecord {
  const created = createSubscription(
    mockDatabase,
    {
      provider: "stripe",
      customer_email: "sam@example.test",
      plan_name: "Pro",
      amount_minor: 1500,
      currency: "USD",
      interval: "month",
      trial_days: trialDays,
      card_number: cardNumber,
    },
    startMs,
  );
  if ("isApplied" in created) {
    throw new Error(created.message);
  }
  return created.subscription;
}

beforeEach(() => {
  replaceMockDatabase("empty");
});

describe("payment subscriptions", () => {
  test("PY-07.4 a subscription charges at once, renews when advanced and ends at the period end", () => {
    const subscription = startSubscription("4242424242424242");

    expect(subscription.status).toBe("active");
    expect(subscription.renewal_count).toBe(1);
    expect(subscription.current_period_end).toBe("2026-02-28T10:00:00.000Z");
    const renewed = advanceSubscription(mockDatabase, subscription, startMs);
    expect(renewed).toEqual({
      isApplied: true,
      firedEvents: ["subscription.renewed"],
    });
    expect(subscription.renewal_count).toBe(2);
    expect(subscription.payment_ids).toHaveLength(2);
    cancelSubscription(subscription, true, startMs);
    expect(advanceSubscription(mockDatabase, subscription, startMs)).toEqual({
      isApplied: true,
      firedEvents: ["subscription.canceled"],
    });
    expect(subscription.status).toBe("canceled");
    expect(
      advanceSubscription(mockDatabase, subscription, startMs).isApplied,
    ).toBe(false);
  });

  test("PY-07.4 a declining card leaves the subscription past due, and a trial charges nothing", () => {
    const declined = startSubscription("4000000000009995");
    const trialing = startSubscription("4242424242424242", 7);

    expect(declined.status).toBe("past_due");
    expect(
      mockDatabase.payments.find(
        (payment) => payment.id === declined.payment_ids[0],
      )?.failure_code,
    ).toBe("insufficient_funds");
    expect(trialing.status).toBe("trialing");
    expect(trialing.payment_ids).toEqual([]);
    expect(trialing.trial_end).toBe("2026-02-07T10:00:00.000Z");
  });

  test("PY-07.4 a real card number is refused", () => {
    const refused = createSubscription(mockDatabase, {
      provider: "stripe",
      customer_email: "sam@example.test",
      plan_name: "Pro",
      amount_minor: 1500,
      interval: "month",
      card_number: "4111111111111111",
    });

    expect(refused).toMatchObject({ isApplied: false, statusCode: 422 });
  });
});
