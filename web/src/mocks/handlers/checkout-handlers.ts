import { http, HttpResponse } from "msw";

import type { CheckoutCompleteRequest } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import { toCheckoutSession } from "@/mocks/payments/checkout-session";
import { completeCheckout } from "@/mocks/payments/complete-checkout";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

function findSessionPayment(sessionId: unknown) {
  return mockDatabase.payments.find((payment) => payment.id === sessionId);
}

/**
 * The test checkout page's API (PY-03). Requests are never written to the
 * API request log, so a card number typed by mistake is kept nowhere (PY-01.1).
 */
export const checkoutHandlers = [
  http.get("*/api/v1/checkout-sessions/:sessionId", async ({ params }) => {
    await applyMockConditions();
    const paymentDetail = findSessionPayment(params.sessionId);

    return paymentDetail === undefined
      ? createNotFoundResponse("Checkout session")
      : HttpResponse.json(toCheckoutSession(mockDatabase, paymentDetail));
  }),

  http.post(
    "*/api/v1/checkout-sessions/:sessionId/complete",
    async ({ params, request }) => {
      await applyMockConditions();
      const paymentDetail = findSessionPayment(params.sessionId);
      if (paymentDetail === undefined) {
        return createNotFoundResponse("Checkout session");
      }

      const checkoutRequest = (await request.json()) as CheckoutCompleteRequest;
      const checkoutResult = completeCheckout(
        mockDatabase,
        paymentDetail,
        checkoutRequest,
      );
      if (!checkoutResult.isApplied) {
        return createErrorResponse(
          checkoutResult.statusCode,
          checkoutResult.statusCode === 409
            ? "checkout_closed"
            : "validation_failed",
          checkoutResult.message,
        );
      }
      publishMockEvent(
        paymentDetail.notifications.at(-1)?.event_type ?? "payment.created",
        { id: paymentDetail.id },
      );

      return HttpResponse.json(toCheckoutSession(mockDatabase, paymentDetail));
    },
  ),
];
