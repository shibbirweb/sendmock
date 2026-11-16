import { http, HttpResponse } from "msw";

import type {
  PaymentCreateRequest,
  PaymentDetail,
  PaymentSimulateRequest,
  PaymentSummary,
} from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { createDirectPayment } from "@/mocks/payments/create-direct-payment";
import { isPaymentEventType } from "@/mocks/payments/payment-event-types";
import { readGatewayName } from "@/mocks/payments/payment-gateway-record";
import { recordPaymentNotification } from "@/mocks/payments/record-payment-notification";
import { simulatePayment } from "@/mocks/payments/simulate-payment";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { publishTrafficCleared } from "@/mocks/realtime/publish-traffic-cleared";
import { runWithWebhookChoice } from "@/mocks/realtime/webhook-choice-scope";
import { refuseUnavailableEndpoint } from "@/mocks/webhooks/webhook-choice";

function findPayment(paymentId: unknown): PaymentDetail | undefined {
  return mockDatabase.payments.find((payment) => payment.id === paymentId);
}

/** A stored payment with its gateway's current name. */
function presentPayment(paymentDetail: PaymentDetail): PaymentDetail {
  return {
    ...paymentDetail,
    provider_name: readGatewayName(mockDatabase, paymentDetail.provider),
  };
}

function toPaymentSummary(paymentDetail: PaymentDetail): PaymentSummary {
  return {
    id: paymentDetail.id,
    provider: paymentDetail.provider,
    provider_name: readGatewayName(mockDatabase, paymentDetail.provider),
    provider_reference: paymentDetail.provider_reference,
    amount_minor: paymentDetail.amount_minor,
    currency: paymentDetail.currency,
    status: paymentDetail.status,
    customer_email: paymentDetail.customer_email,
    customer_name: paymentDetail.customer_name,
    failure_code: paymentDetail.failure_code,
    refunded_minor: paymentDetail.refunded_minor,
    created_at: paymentDetail.created_at,
  };
}

const refusalCodes: Record<number, string> = {
  400: "validation_failed",
  404: "not_found",
  422: "not_a_test_card",
};

/** Tells live screens a payment and the delivery log changed. */
/** The list's status (comma-separated), provider and currency filters. */
function matchesPaymentFilters(
  paymentDetail: PaymentDetail,
  searchParameters: URLSearchParams,
): boolean {
  const statusFilter = searchParameters.get("status")?.split(",");
  const providerFilter = searchParameters.get("provider");
  const currencyFilter = searchParameters.get("currency");

  return (
    (statusFilter === undefined ||
      statusFilter.includes(paymentDetail.status)) &&
    (providerFilter === null || paymentDetail.provider === providerFilter) &&
    (currencyFilter === null || paymentDetail.currency === currencyFilter)
  );
}

function publishPaymentChange(paymentDetail: PaymentDetail) {
  const lastNotification = paymentDetail.notifications.at(-1);
  publishMockEvent(lastNotification?.event_type ?? "payment.created", {
    id: paymentDetail.id,
  });
  publishMockEvent("webhook.delivered", {
    id: lastNotification?.delivery_id ?? null,
  });
}

export const paymentHandlers = [
  http.get("*/api/v1/payments", async ({ request }) => {
    await applyMockConditions();
    const requestUrl = new URL(request.url);
    const matchingPayments = mockDatabase.payments.filter((payment) =>
      matchesPaymentFilters(payment, requestUrl.searchParams),
    );

    return HttpResponse.json(
      paginateItems(matchingPayments.map(toPaymentSummary), requestUrl),
    );
  }),

  http.delete("*/api/v1/payments", async ({ request }) => {
    await applyMockConditions();
    const searchParameters = new URL(request.url).searchParams;
    const keptPayments = mockDatabase.payments.filter(
      (payment) => !matchesPaymentFilters(payment, searchParameters),
    );
    const deletedCount = mockDatabase.payments.length - keptPayments.length;
    mockDatabase.payments = keptPayments;
    publishTrafficCleared(["payment"], null, deletedCount);

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/api/v1/payments", async ({ request }) => {
    await applyMockConditions();
    const createRequest = (await request.json()) as PaymentCreateRequest;
    const createResult = createDirectPayment(mockDatabase, createRequest);
    if (!createResult.isApplied) {
      return createErrorResponse(
        createResult.statusCode,
        refusalCodes[createResult.statusCode] ?? "validation_failed",
        createResult.message,
      );
    }
    publishPaymentChange(createResult.payment);

    return HttpResponse.json(presentPayment(createResult.payment), {
      status: 201,
    });
  }),

  http.get("*/api/v1/payments/:paymentId", async ({ params }) => {
    await applyMockConditions();
    const paymentDetail = findPayment(params.paymentId);

    return paymentDetail === undefined
      ? createNotFoundResponse("Payment")
      : HttpResponse.json(presentPayment(paymentDetail));
  }),

  http.delete("*/api/v1/payments/:paymentId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.payments = mockDatabase.payments.filter(
      (payment) => payment.id !== params.paymentId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    "*/api/v1/payments/:paymentId/simulate",
    async ({ params, request }) => {
      await applyMockConditions();
      const paymentDetail = findPayment(params.paymentId);
      if (paymentDetail === undefined) {
        return createNotFoundResponse("Payment");
      }

      const simulateRequest = (await request.json()) as PaymentSimulateRequest;
      const choiceRefusal = refuseUnavailableEndpoint(simulateRequest);
      if (choiceRefusal) {
        return choiceRefusal;
      }
      const simulationResult = simulatePayment(
        mockDatabase,
        paymentDetail,
        simulateRequest,
      );
      if (!simulationResult.isApplied) {
        return createErrorResponse(
          simulationResult.statusCode,
          simulationResult.statusCode === 409
            ? "action_not_allowed"
            : "validation_failed",
          simulationResult.message,
        );
      }
      runWithWebhookChoice(simulateRequest, () => {
        publishPaymentChange(paymentDetail);
      });

      return HttpResponse.json(presentPayment(paymentDetail));
    },
  ),

  http.post("*/api/v1/payments/:paymentId/notify", async ({ params }) => {
    await applyMockConditions();
    const paymentDetail = findPayment(params.paymentId);
    if (paymentDetail === undefined) {
      return createNotFoundResponse("Payment");
    }
    const lastEventType = paymentDetail.notifications.at(-1)?.event_type;
    if (lastEventType === undefined || !isPaymentEventType(lastEventType)) {
      return createErrorResponse(
        409,
        "nothing_to_resend",
        "No notification was sent for this payment yet",
      );
    }

    recordPaymentNotification(mockDatabase, paymentDetail, lastEventType);
    publishPaymentChange(paymentDetail);

    return HttpResponse.json(presentPayment(paymentDetail));
  }),
];
