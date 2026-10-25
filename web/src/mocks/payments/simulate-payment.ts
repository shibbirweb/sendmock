import type {
  PaymentDetail,
  PaymentMethod,
  PaymentSimulateAction,
  PaymentSimulateRequest,
  PaymentTimelineKind,
} from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";
import {
  listSimulateActions,
  readRefundableMinor,
  validateRefundAmount,
} from "@/lib/payments/payment-actions";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { buildPaymentRedirect } from "@/mocks/payments/build-payment-redirect";
import {
  hasProviderEvent,
  type PaymentEventType,
} from "@/mocks/payments/provider-notifications";
import { recordPaymentNotification } from "@/mocks/payments/record-payment-notification";

export type SimulationResult =
  | { isApplied: true }
  | { isApplied: false; statusCode: 409 | 422; message: string };

export type PaymentDatabase = Pick<
  MockDatabase,
  "webhookEndpoints" | "webhookDeliveries"
>;

export function addTimeline(
  paymentDetail: PaymentDetail,
  kind: PaymentTimelineKind,
  description: string,
  createdAt: string,
) {
  paymentDetail.timeline.push({ kind, description, created_at: createdAt });
}

export function finishCheckout(
  paymentDetail: PaymentDetail,
  redirectOutcome: "success" | "fail" | "cancel",
  createdAt: string,
) {
  const paymentRedirect = buildPaymentRedirect(
    paymentDetail,
    redirectOutcome,
    createdAt,
  );
  paymentDetail.checkout_url = null;
  if (paymentRedirect !== null) {
    paymentDetail.redirect = paymentRedirect;
    addTimeline(
      paymentDetail,
      "redirected",
      `Redirected to the ${redirectOutcome} URL`,
      createdAt,
    );
  }
}

function money(paymentDetail: PaymentDetail, amountMinor: number): string {
  return formatMinorAmount(amountMinor, paymentDetail.currency, "en-US");
}

type SimulationStep = (
  paymentDetail: PaymentDetail,
  simulateRequest: PaymentSimulateRequest,
  createdAt: string,
) => PaymentEventType[];

/** The test method a checkout pays with when none was chosen yet. */
function readDefaultTestMethod(paymentDetail: PaymentDetail): PaymentMethod {
  return paymentDetail.provider === "bkash"
    ? { kind: "wallet", wallet_name: "bKash", masked_number: "01770****21" }
    : {
        kind: "card",
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2034,
      };
}

const succeedStep: SimulationStep = (
  paymentDetail,
  simulateRequest,
  createdAt,
) => {
  const hadCheckout = paymentDetail.checkout_url !== null;
  if (paymentDetail.method === null) {
    paymentDetail.method = readDefaultTestMethod(paymentDetail);
    paymentDetail.method_key =
      paymentDetail.provider === "bkash" ? "bkash" : "card";
  }
  const isCapture = simulateRequest.action === "capture";
  paymentDetail.status = "succeeded";
  paymentDetail.captured_minor = paymentDetail.amount_minor;
  addTimeline(
    paymentDetail,
    isCapture ? "captured" : "succeeded",
    `${isCapture ? "Captured" : "Paid"} ${money(paymentDetail, paymentDetail.amount_minor)}`,
    createdAt,
  );
  finishCheckout(paymentDetail, "success", createdAt);

  return hadCheckout
    ? ["checkout.completed", "payment.succeeded"]
    : ["payment.succeeded"];
};

const refundStep: SimulationStep = (
  paymentDetail,
  simulateRequest,
  createdAt,
) => {
  const refundMinor =
    simulateRequest.refund_amount_minor ?? readRefundableMinor(paymentDetail);
  paymentDetail.refunded_minor += refundMinor;
  const isFull = paymentDetail.refunded_minor >= paymentDetail.captured_minor;
  paymentDetail.status = isFull ? "refunded" : "partially_refunded";
  addTimeline(
    paymentDetail,
    "refunded",
    `Refunded ${money(paymentDetail, refundMinor)}`,
    createdAt,
  );

  return [isFull ? "payment.refunded" : "payment.partially_refunded"];
};

const resolveDisputeStep: SimulationStep = (
  paymentDetail,
  simulateRequest,
  createdAt,
) => {
  const isWon = simulateRequest.dispute_outcome !== "lost";
  paymentDetail.dispute = {
    status: isWon ? "won" : "lost",
    reason: paymentDetail.dispute?.reason ?? "fraudulent",
  };
  if (isWon) {
    paymentDetail.status =
      paymentDetail.refunded_minor > 0 ? "partially_refunded" : "succeeded";
  } else {
    // A lost dispute returns the money to the customer.
    paymentDetail.refunded_minor = paymentDetail.captured_minor;
    paymentDetail.status = "refunded";
  }
  addTimeline(
    paymentDetail,
    "dispute_closed",
    `Dispute ${isWon ? "won" : "lost"}`,
    createdAt,
  );

  return ["payment.dispute_closed"];
};

/** One step per action; each changes the payment and names the events it fires. */
const simulationSteps: Record<PaymentSimulateAction, SimulationStep> = {
  succeed: succeedStep,
  capture: succeedStep,
  decline: (paymentDetail, simulateRequest, createdAt) => {
    const declineReason = simulateRequest.decline_reason ?? "generic_decline";
    paymentDetail.status = "failed";
    paymentDetail.failure_code = declineReason;
    addTimeline(
      paymentDetail,
      "failed",
      `Declined: ${declineReason.replaceAll("_", " ")}`,
      createdAt,
    );
    finishCheckout(paymentDetail, "fail", createdAt);
    return ["payment.failed"];
  },
  expire: (paymentDetail, _simulateRequest, createdAt) => {
    paymentDetail.status = "canceled";
    paymentDetail.failure_code = "expired";
    paymentDetail.checkout_url = null;
    addTimeline(
      paymentDetail,
      "expired",
      "The checkout session expired",
      createdAt,
    );
    return ["checkout.expired"];
  },
  void: (paymentDetail, _simulateRequest, createdAt) => {
    paymentDetail.status = "canceled";
    addTimeline(paymentDetail, "canceled", "Authorization voided", createdAt);
    return ["payment.canceled"];
  },
  refund: refundStep,
  dispute: (paymentDetail, _simulateRequest, createdAt) => {
    paymentDetail.status = "disputed";
    paymentDetail.dispute = { status: "needs_response", reason: "fraudulent" };
    addTimeline(
      paymentDetail,
      "dispute_opened",
      "Dispute opened: fraudulent",
      createdAt,
    );
    return ["payment.dispute_opened"];
  },
  resolve_dispute: resolveDisputeStep,
};

/**
 * Runs a Simulate action as the gateway would (PY-09.3): only what the
 * status allows, refunds capped at what is left, and each change sent as a
 * notification to the provider's notification endpoint.
 */
export function simulatePayment(
  mockDatabase: PaymentDatabase,
  paymentDetail: PaymentDetail,
  simulateRequest: PaymentSimulateRequest,
  nowMs: number = Date.now(),
): SimulationResult {
  if (!listSimulateActions(paymentDetail).includes(simulateRequest.action)) {
    return {
      isApplied: false,
      statusCode: 409,
      message: `A ${paymentDetail.status.replaceAll("_", " ")} payment cannot do ${simulateRequest.action.replaceAll("_", " ")}`,
    };
  }
  if (simulateRequest.action === "refund") {
    const refundError = validateRefundAmount(
      simulateRequest.refund_amount_minor ?? readRefundableMinor(paymentDetail),
      paymentDetail,
    );
    if (refundError !== null) {
      return { isApplied: false, statusCode: 422, message: refundError };
    }
  }

  const createdAt = new Date(nowMs).toISOString();
  const firedEvents = simulationSteps[simulateRequest.action](
    paymentDetail,
    simulateRequest,
    createdAt,
  );
  firePaymentEvents(mockDatabase, paymentDetail, firedEvents, nowMs);

  return { isApplied: true };
}

/** Sends each event the provider has as a notification, a millisecond apart. */
export function firePaymentEvents(
  mockDatabase: PaymentDatabase,
  paymentDetail: PaymentDetail,
  firedEvents: PaymentEventType[],
  nowMs: number,
) {
  firedEvents
    .filter((eventType) => hasProviderEvent(paymentDetail.provider, eventType))
    .forEach((eventType, eventIndex) => {
      recordPaymentNotification(
        mockDatabase,
        paymentDetail,
        eventType,
        nowMs + eventIndex,
      );
    });
}
