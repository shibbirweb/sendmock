import { http, HttpResponse } from "msw";

import type {
  AppEventType,
  PaymentSubscription,
  PaymentSubscriptionCancelRequest,
  PaymentSubscriptionCreateRequest,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { readGatewayName } from "@/mocks/payments/payment-gateway-record";
import {
  advanceSubscription,
  cancelSubscription,
  createSubscription,
  type PaymentSubscriptionRecord,
  type SubscriptionResult,
} from "@/mocks/payments/subscriptions/payment-subscriptions";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

function findSubscription(
  subscriptionId: unknown,
): PaymentSubscriptionRecord | undefined {
  return mockDatabase.paymentSubscriptions.find(
    (subscription) => subscription.id === subscriptionId,
  );
}

/** The subscription without the card number SendMock keeps for its renewals. */
function presentSubscription(
  subscriptionRecord: PaymentSubscriptionRecord,
): PaymentSubscription {
  const subscription: PaymentSubscription & { card_number?: string } = {
    ...subscriptionRecord,
    provider_name: readGatewayName(mockDatabase, subscriptionRecord.provider),
  };
  delete subscription.card_number;

  return subscription;
}

function publishSubscriptionEvents(
  subscription: PaymentSubscriptionRecord,
  firedEvents: AppEventType[],
) {
  for (const firedEvent of firedEvents) {
    publishMockEvent(firedEvent, { id: subscription.id });
  }
  const lastPaymentId = subscription.payment_ids.at(-1);
  if (lastPaymentId !== undefined) {
    publishMockEvent("payment.created", { id: lastPaymentId });
  }
}

function answerChange(
  subscription: PaymentSubscriptionRecord,
  subscriptionResult: SubscriptionResult,
) {
  if (!subscriptionResult.isApplied) {
    return createErrorResponse(
      subscriptionResult.statusCode,
      "subscription_canceled",
      subscriptionResult.message,
    );
  }
  publishSubscriptionEvents(subscription, subscriptionResult.firedEvents);
  return HttpResponse.json(presentSubscription(subscription));
}

/** Payments > Subscriptions (PY-07.4); registered before `/payments/:paymentId`. */
export const paymentSubscriptionHandlers = [
  http.get("*/api/v1/payments/subscriptions", async () => {
    await applyMockConditions();
    return HttpResponse.json(
      mockDatabase.paymentSubscriptions.map(presentSubscription),
    );
  }),

  http.post("*/api/v1/payments/subscriptions", async ({ request }) => {
    await applyMockConditions();
    const createRequest =
      (await request.json()) as PaymentSubscriptionCreateRequest;
    const isKnownGateway = mockDatabase.paymentGateways.some(
      (paymentGateway) => paymentGateway.key === createRequest.provider,
    );
    if (!isKnownGateway) {
      return createNotFoundResponse("Payment gateway");
    }
    if (
      createRequest.plan_name.trim() === "" ||
      createRequest.amount_minor <= 0
    ) {
      return createErrorResponse(
        400,
        "validation_failed",
        "A plan name and an amount above 0 are required",
      );
    }
    const created = createSubscription(mockDatabase, createRequest);
    if ("isApplied" in created) {
      return createErrorResponse(
        created.statusCode,
        "not_a_test_card",
        created.message,
      );
    }
    publishSubscriptionEvents(created.subscription, created.firedEvents);

    return HttpResponse.json(presentSubscription(created.subscription), {
      status: 201,
    });
  }),

  http.get(
    "*/api/v1/payments/subscriptions/:subscriptionId",
    async ({ params }) => {
      await applyMockConditions();
      const subscription = findSubscription(params.subscriptionId);

      return subscription === undefined
        ? createNotFoundResponse("Subscription")
        : HttpResponse.json(presentSubscription(subscription));
    },
  ),

  http.post(
    "*/api/v1/payments/subscriptions/:subscriptionId/advance",
    async ({ params }) => {
      await applyMockConditions();
      const subscription = findSubscription(params.subscriptionId);
      if (subscription === undefined) {
        return createNotFoundResponse("Subscription");
      }

      return answerChange(
        subscription,
        advanceSubscription(mockDatabase, subscription),
      );
    },
  ),

  http.post(
    "*/api/v1/payments/subscriptions/:subscriptionId/cancel",
    async ({ params, request }) => {
      await applyMockConditions();
      const subscription = findSubscription(params.subscriptionId);
      if (subscription === undefined) {
        return createNotFoundResponse("Subscription");
      }
      const cancelRequest =
        (await request.json()) as PaymentSubscriptionCancelRequest;

      return answerChange(
        subscription,
        cancelSubscription(subscription, cancelRequest.at_period_end ?? false),
      );
    },
  ),
];
