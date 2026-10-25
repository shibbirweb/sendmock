import { http, HttpResponse } from "msw";

import type {
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
import { isPaymentEventType } from "@/mocks/payments/payment-event-types";
import { readGatewayName } from "@/mocks/payments/payment-gateway-record";
import { recordPaymentNotification } from "@/mocks/payments/record-payment-notification";
import { simulatePayment } from "@/mocks/payments/simulate-payment";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

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

/** Tells live screens a payment and the delivery log changed. */
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
    const statusFilter = requestUrl.searchParams.get("status")?.split(",");
    const providerFilter = requestUrl.searchParams.get("provider");
    const currencyFilter = requestUrl.searchParams.get("currency");
    const matchingPayments = mockDatabase.payments.filter(
      (payment) =>
        (statusFilter === undefined || statusFilter.includes(payment.status)) &&
        (providerFilter === null || payment.provider === providerFilter) &&
        (currencyFilter === null || payment.currency === currencyFilter),
    );

    return HttpResponse.json(
      paginateItems(matchingPayments.map(toPaymentSummary), requestUrl),
    );
  }),

  http.get("*/api/v1/payments/:paymentId", async ({ params }) => {
    await applyMockConditions();
    const paymentDetail = findPayment(params.paymentId);

    return paymentDetail === undefined
      ? createNotFoundResponse("Payment")
      : HttpResponse.json(presentPayment(paymentDetail));
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
      publishPaymentChange(paymentDetail);

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
