import type {
  DeclineReason,
  PaymentDetail,
  PaymentSimulateAction,
} from "@/lib/api/types";

export const declineReasons: { reason: DeclineReason; label: string }[] = [
  {
    reason: "insufficient_funds",
    label: "Insufficient funds",
  },
  {
    reason: "expired_card",
    label: "Expired card",
  },
  {
    reason: "incorrect_cvc",
    label: "Incorrect CVC",
  },
  {
    reason: "generic_decline",
    label: "Generic decline",
  },
  {
    reason: "fraudulent",
    label: "Fraud",
  },
];

/** What the Simulate menu offers for a payment, by its status (PY-09.3). */
export function listSimulateActions(
  paymentDetail: Pick<PaymentDetail, "status" | "checkout_url">,
): PaymentSimulateAction[] {
  switch (paymentDetail.status) {
    case "requires_payment":
    case "requires_action":
      return paymentDetail.checkout_url === null
        ? ["succeed", "decline"]
        : ["succeed", "decline", "expire"];
    case "authorized":
      return ["capture", "void"];
    case "succeeded":
    case "partially_refunded":
      return ["refund", "dispute"];
    case "disputed":
      return ["resolve_dispute"];
    default:
      return [];
  }
}

/** What can still be refunded: captured minus refunded. */
export function readRefundableMinor(
  paymentDetail: Pick<PaymentDetail, "captured_minor" | "refunded_minor">,
): number {
  return Math.max(
    0,
    paymentDetail.captured_minor - paymentDetail.refunded_minor,
  );
}

/** Why a refund amount cannot be used, or null (PY-07.2). */
export function validateRefundAmount(
  refundAmountMinor: number | null,
  paymentDetail: Pick<PaymentDetail, "captured_minor" | "refunded_minor">,
): string | null {
  if (refundAmountMinor === null || refundAmountMinor <= 0) {
    return "Enter an amount above zero";
  }
  if (refundAmountMinor > readRefundableMinor(paymentDetail)) {
    return "That is more than is left to refund";
  }

  return null;
}
