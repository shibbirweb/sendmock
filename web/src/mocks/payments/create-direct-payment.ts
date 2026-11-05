import type {
  PaymentCreateRequest,
  PaymentDetail,
  PaymentSimulateRequest,
  TestCardValue,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  type NewPaymentDatabase,
  storeNewPayment,
} from "@/mocks/payments/create-test-checkout";
import { simulatePayment } from "@/mocks/payments/simulate-payment";
import { findTestCard } from "@/mocks/payments/subscriptions/charge-subscription";

export type DirectPaymentResult =
  | { isApplied: true; payment: PaymentDetail }
  | { isApplied: false; statusCode: number; message: string };

/** What the card does; a 3-D Secure card fails, as there is no page to approve it on. */
function readCardSteps(testCard: TestCardValue): PaymentSimulateRequest[] {
  const cardSteps: Record<TestCardValue["outcome"], PaymentSimulateRequest[]> =
    {
      succeed: [{ action: "succeed" }],
      decline: [
        {
          action: "decline",
          decline_reason: testCard.decline_reason ?? "generic_decline",
        },
      ],
      three_ds: [
        { action: "decline", decline_reason: "authentication_failed" },
      ],
      succeed_then_dispute: [{ action: "succeed" }, { action: "dispute" }],
    };

  return cardSteps[testCard.outcome];
}

function refuseRequest(statusCode: number, message: string) {
  return { isApplied: false as const, statusCode, message };
}

/** The request's problem, or none; the currency comes back in capitals. */
function checkCreateRequest(
  mockDatabase: Pick<MockDatabase, "paymentGateways">,
  createRequest: PaymentCreateRequest,
  currency: string,
) {
  if (
    !Number.isInteger(createRequest.amount_minor) ||
    createRequest.amount_minor <= 0
  ) {
    return refuseRequest(400, "amount_minor must be a whole number above 0");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return refuseRequest(400, "currency must be three letters, such as USD");
  }
  if (
    !mockDatabase.paymentGateways.some(
      (gateway) => gateway.key === createRequest.provider,
    )
  ) {
    return refuseRequest(404, "Gateway not found");
  }

  return null;
}

/** A payment the app's server pays with a test card, without a checkout page (PY-02.1). */
export function createDirectPayment(
  mockDatabase: NewPaymentDatabase & Pick<MockDatabase, "paymentMethods">,
  createRequest: PaymentCreateRequest,
  nowMs: number = Date.now(),
): DirectPaymentResult {
  const currency = (
    createRequest.currency ?? mockDatabase.settings.payment_default_currency
  ).toUpperCase();
  const requestProblem = checkCreateRequest(
    mockDatabase,
    createRequest,
    currency,
  );
  if (requestProblem !== null) {
    return requestProblem;
  }
  const testCard = findTestCard(mockDatabase, createRequest.card_number);
  if (testCard === undefined) {
    return refuseRequest(422, "Use a test card: real card numbers are refused");
  }
  const payment = storeNewPayment(
    mockDatabase,
    { ...createRequest, currency },
    nowMs,
  );
  payment.checkout_url = null;
  payment.success_url = null;
  payment.fail_url = null;
  payment.cancel_url = null;
  payment.timeline[0] = {
    kind: "created",
    description: "Payment created through the API",
    created_at: payment.created_at,
  };
  readCardSteps(testCard).forEach((cardStep, stepIndex) => {
    simulatePayment(mockDatabase, payment, cardStep, nowMs + stepIndex + 1);
  });

  return { isApplied: true, payment };
}
