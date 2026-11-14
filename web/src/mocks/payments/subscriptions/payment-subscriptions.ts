import type {
  AppEventType,
  PaymentSubscription,
  PaymentSubscriptionCreateRequest,
  SubscriptionTimelineKind,
} from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { readGatewayName } from "@/mocks/payments/payment-gateway-record";
import {
  chargeSubscription,
  findTestCard,
  type SubscriptionDatabase,
} from "@/mocks/payments/subscriptions/charge-subscription";
import {
  addDays,
  addInterval,
} from "@/mocks/payments/subscriptions/subscription-clock";

const defaultCardNumber = "4242424242424242";

/** What SendMock keeps: the subscription and the card number its renewals are charged to. */
export type PaymentSubscriptionRecord = PaymentSubscription & {
  card_number: string;
};

/** What a subscription change did: the events it fires, or why it was refused. */
export type SubscriptionResult =
  | { isApplied: true; firedEvents: AppEventType[] }
  | { isApplied: false; statusCode: 404 | 409 | 422; message: string };

function addTimeline(
  subscription: PaymentSubscriptionRecord,
  kind: SubscriptionTimelineKind,
  description: string,
  createdAt: string,
) {
  subscription.timeline.push({ kind, description, created_at: createdAt });
}

/** Charges the period that starts now; a declined card leaves it past due. */
function chargePeriod(
  mockDatabase: SubscriptionDatabase,
  subscription: PaymentSubscriptionRecord,
  nowMs: number,
): AppEventType {
  const testCard = findTestCard(mockDatabase, subscription.card_number) ?? {
    number: defaultCardNumber,
    outcome: "succeed" as const,
    decline_reason: null,
  };
  const renewalPayment = chargeSubscription(
    mockDatabase,
    subscription,
    testCard,
    nowMs,
  );
  const createdAt = new Date(nowMs).toISOString();
  if (renewalPayment.status === "failed") {
    subscription.status = "past_due";
    addTimeline(
      subscription,
      "payment_failed",
      `Payment failed: ${(renewalPayment.failure_code ?? "declined").replaceAll("_", " ")}`,
      createdAt,
    );
    return "subscription.payment_failed";
  }
  subscription.status = "active";
  subscription.renewal_count += 1;
  addTimeline(subscription, "renewed", "Paid for the period", createdAt);
  return "subscription.renewed";
}

/** Starts a subscription: a trial waits, otherwise the first period is charged at once. */
export function createSubscription(
  mockDatabase: SubscriptionDatabase,
  createRequest: PaymentSubscriptionCreateRequest,
  nowMs: number = Date.now(),
):
  | { subscription: PaymentSubscriptionRecord; firedEvents: AppEventType[] }
  | Extract<SubscriptionResult, { isApplied: false }> {
  const cardNumber = createRequest.card_number ?? defaultCardNumber;
  if (findTestCard(mockDatabase, cardNumber) === undefined) {
    return { isApplied: false, statusCode: 422, message: "Use a test card" };
  }
  const createdAt = new Date(nowMs).toISOString();
  const trialDays = createRequest.trial_days ?? 0;
  const trialEnd = trialDays > 0 ? addDays(createdAt, trialDays) : null;
  const subscription: PaymentSubscriptionRecord = {
    id: createMockUlid(nowMs),
    provider: createRequest.provider,
    provider_name: readGatewayName(mockDatabase, createRequest.provider),
    customer_email: createRequest.customer_email,
    plan_name: createRequest.plan_name,
    amount_minor: createRequest.amount_minor,
    currency:
      createRequest.currency ?? mockDatabase.settings.payment_default_currency,
    interval: createRequest.interval,
    status: trialEnd === null ? "active" : "trialing",
    card_number: cardNumber,
    card_last4: cardNumber.slice(-4),
    trial_end: trialEnd,
    current_period_start: createdAt,
    current_period_end:
      trialEnd ?? addInterval(createdAt, createRequest.interval),
    cancel_at_period_end: false,
    canceled_at: null,
    renewal_count: 0,
    payment_ids: [],
    created_at: createdAt,
    timeline: [],
  };
  addTimeline(
    subscription,
    "created",
    trialEnd === null ? "Subscription started" : `Trial of ${trialDays} days`,
    createdAt,
  );
  mockDatabase.paymentSubscriptions.unshift(subscription);
  const firedEvents: AppEventType[] = ["subscription.created"];
  if (trialEnd === null) {
    firedEvents.push(chargePeriod(mockDatabase, subscription, nowMs + 1));
  }

  return { subscription, firedEvents };
}

/** The subscription's clock moves to its next renewal (PY-07.4). */
export function advanceSubscription(
  mockDatabase: SubscriptionDatabase,
  subscription: PaymentSubscriptionRecord,
  nowMs: number = Date.now(),
): SubscriptionResult {
  if (subscription.status === "canceled") {
    return {
      isApplied: false,
      statusCode: 409,
      message: "The subscription is canceled",
    };
  }
  const periodStart = subscription.current_period_end;
  if (subscription.cancel_at_period_end) {
    subscription.status = "canceled";
    subscription.canceled_at = periodStart;
    addTimeline(
      subscription,
      "canceled",
      "Ended at the period end",
      periodStart,
    );
    return { isApplied: true, firedEvents: ["subscription.canceled"] };
  }
  subscription.current_period_start = periodStart;
  subscription.current_period_end = addInterval(
    periodStart,
    subscription.interval,
  );
  subscription.trial_end = null;
  const firedEvent = chargePeriod(mockDatabase, subscription, nowMs);
  return { isApplied: true, firedEvents: [firedEvent] };
}

export function cancelSubscription(
  subscription: PaymentSubscriptionRecord,
  isAtPeriodEnd: boolean,
  nowMs: number = Date.now(),
): SubscriptionResult {
  if (subscription.status === "canceled") {
    return {
      isApplied: false,
      statusCode: 409,
      message: "The subscription is canceled",
    };
  }
  const createdAt = new Date(nowMs).toISOString();
  if (isAtPeriodEnd) {
    subscription.cancel_at_period_end = true;
    addTimeline(
      subscription,
      "cancel_scheduled",
      "Ends at the period end",
      createdAt,
    );
    return { isApplied: true, firedEvents: [] };
  }
  subscription.status = "canceled";
  subscription.canceled_at = createdAt;
  addTimeline(subscription, "canceled", "Canceled", createdAt);
  return { isApplied: true, firedEvents: ["subscription.canceled"] };
}
