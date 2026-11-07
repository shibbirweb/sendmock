import type { PaymentDetail } from "@/lib/api/types";

type StripeCardDecline = {
  code: string;
  decline_code: string | null;
  message: string;
};

/** Stripe's error for a decline reason of the test card table, as the binary reports it. */
const stripeCardDeclines: Record<string, StripeCardDecline> = {
  insufficient_funds: {
    code: "card_declined",
    decline_code: "insufficient_funds",
    message: "Your card has insufficient funds.",
  },
  fraudulent: {
    code: "card_declined",
    decline_code: "fraudulent",
    message: "Your card was declined.",
  },
  expired_card: {
    code: "expired_card",
    decline_code: null,
    message: "Your card has expired.",
  },
  incorrect_cvc: {
    code: "incorrect_cvc",
    decline_code: null,
    message: "Your card's security code is incorrect.",
  },
  authentication_failed: {
    code: "payment_intent_authentication_failure",
    decline_code: null,
    message:
      "The provided PaymentMethod has failed authentication. You can provide payment_method_data or a new PaymentMethod to attempt to fulfill this PaymentIntent again.",
  },
};

const genericCardDecline: StripeCardDecline = {
  code: "card_declined",
  decline_code: "generic_decline",
  message: "Your card was declined.",
};

export function describeStripeCardDecline(
  declineReason: string,
): StripeCardDecline {
  return stripeCardDeclines[declineReason] ?? genericCardDecline;
}

export function readPaymentIntentId(paymentDetail: PaymentDetail): string {
  return paymentDetail.provider_ids.payment_intent ?? `pi_${paymentDetail.id}`;
}

export function readSessionId(paymentDetail: PaymentDetail): string {
  return paymentDetail.provider_ids.checkout_session ?? "";
}

/** The id Stripe gives the intent's charge (`ch_`), PaymentMethod (`pm_`) or dispute (`dp_`). */
export function deriveRelatedId(
  paymentIntentId: string,
  idPrefix: string,
): string {
  const idSuffix = paymentIntentId.startsWith("pi_")
    ? paymentIntentId.slice(3)
    : paymentIntentId;

  return `${idPrefix}_${idSuffix}`;
}

export function toUnixSeconds(isoTime: string): number {
  return Math.floor(Date.parse(isoTime) / 1000) || 0;
}

export function readCreatedSeconds(paymentDetail: PaymentDetail): number {
  return toUnixSeconds(paymentDetail.created_at);
}

/** Why the last confirm failed, as Stripe reports it on the PaymentIntent. */
export function describeLastPaymentError(
  paymentDetail: PaymentDetail,
): Record<string, unknown> | null {
  if (
    paymentDetail.status !== "failed" ||
    paymentDetail.failure_code === null
  ) {
    return null;
  }
  const cardDecline = describeStripeCardDecline(paymentDetail.failure_code);
  const paymentIntentId = readPaymentIntentId(paymentDetail);
  const isAuthenticationFailure =
    paymentDetail.failure_code === "authentication_failed";

  return {
    charge: isAuthenticationFailure
      ? null
      : deriveRelatedId(paymentIntentId, "ch"),
    code: cardDecline.code,
    decline_code: cardDecline.decline_code,
    doc_url: `https://stripe.com/docs/error-codes/${cardDecline.code.replaceAll("_", "-")}`,
    message: cardDecline.message,
    type: isAuthenticationFailure ? "invalid_request_error" : "card_error",
  };
}
