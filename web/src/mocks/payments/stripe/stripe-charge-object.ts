import type { PaymentDetail } from "@/lib/api/types";
import {
  deriveRelatedId,
  describeLastPaymentError,
  readCreatedSeconds,
  readPaymentIntentId,
  toUnixSeconds,
} from "@/mocks/payments/stripe/stripe-object-ids";

/** How long Stripe gives the merchant to answer a dispute. */
const evidenceWindowSeconds = 7 * 24 * 60 * 60;

function describeCardDetails(
  paymentDetail: PaymentDetail,
): Record<string, unknown> | null {
  const paymentMethod = paymentDetail.method;
  if (paymentMethod?.kind !== "card") {
    return null;
  }

  return {
    card: {
      amount_authorized: paymentDetail.amount_minor,
      brand: paymentMethod.brand,
      country: "US",
      exp_month: paymentMethod.exp_month,
      exp_year: paymentMethod.exp_year,
      funding: "credit",
      last4: paymentMethod.last4,
      network: paymentMethod.brand,
    },
    type: "card",
  };
}

/**
 * The payment as the Charge Stripe made for its PaymentIntent. Since API
 * version 2022-11-15 Stripe leaves the `refunds` list out, so it is left out here too.
 */
export function describeCharge(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const paymentIntentId = readPaymentIntentId(paymentDetail);
  const isPaid = paymentDetail.status !== "failed";
  const lastPaymentError = describeLastPaymentError(paymentDetail);

  return {
    id: deriveRelatedId(paymentIntentId, "ch"),
    object: "charge",
    amount: paymentDetail.amount_minor,
    amount_captured: paymentDetail.captured_minor,
    amount_refunded: paymentDetail.refunded_minor,
    captured: paymentDetail.captured_minor > 0,
    created: readCreatedSeconds(paymentDetail),
    currency: paymentDetail.currency.toLowerCase(),
    customer: null,
    disputed: paymentDetail.dispute !== null,
    failure_code: lastPaymentError?.code ?? null,
    failure_message: lastPaymentError?.message ?? null,
    livemode: false,
    metadata: paymentDetail.metadata,
    paid: isPaid,
    payment_intent: paymentIntentId,
    payment_method:
      paymentDetail.method === null
        ? null
        : deriveRelatedId(paymentIntentId, "pm"),
    payment_method_details: describeCardDetails(paymentDetail),
    receipt_email: paymentDetail.customer_email,
    refunded: paymentDetail.status === "refunded",
    status: isPaid ? "succeeded" : "failed",
  };
}

/** The payment's dispute as Stripe's Dispute object; null while it has none. */
export function describeDispute(
  paymentDetail: PaymentDetail,
): Record<string, unknown> | null {
  const paymentDispute = paymentDetail.dispute;
  if (paymentDispute === null) {
    return null;
  }
  const paymentIntentId = readPaymentIntentId(paymentDetail);
  const openedEvent = paymentDetail.timeline.find(
    (timelineEvent) => timelineEvent.kind === "dispute_opened",
  );
  const openedSeconds =
    openedEvent === undefined
      ? readCreatedSeconds(paymentDetail)
      : toUnixSeconds(openedEvent.created_at);
  const isOpen = paymentDispute.status === "needs_response";

  return {
    id: deriveRelatedId(paymentIntentId, "dp"),
    object: "dispute",
    amount: paymentDetail.captured_minor,
    charge: deriveRelatedId(paymentIntentId, "ch"),
    created: openedSeconds,
    currency: paymentDetail.currency.toLowerCase(),
    evidence_details: {
      due_by: isOpen ? openedSeconds + evidenceWindowSeconds : null,
      has_evidence: false,
      past_due: false,
      submission_count: 0,
    },
    is_charge_refundable: false,
    livemode: false,
    metadata: {},
    payment_intent: paymentIntentId,
    reason: paymentDispute.reason,
    status: paymentDispute.status,
  };
}
