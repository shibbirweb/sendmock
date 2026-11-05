import type { PaymentDetail, PaymentStatus } from "@/lib/api/types";
import { readMinorUnitDigits } from "@/lib/payments/format-money";

const mockApiBaseUrl = "http://127.0.0.1:8025/providers/paypal";

type PayPalAmount = { currency_code: string; value: string };

/** An amount as PayPal writes it: the currency and a decimal text. */
export function describePayPalAmount(
  amountMinor: number,
  currency: string,
): PayPalAmount {
  const minorUnitDigits = readMinorUnitDigits(currency);

  return {
    currency_code: currency,
    value: (amountMinor / 10 ** minorUnitDigits).toFixed(minorUnitDigits),
  };
}

export function readOrderId(paymentDetail: PaymentDetail): string {
  return paymentDetail.provider_ids.order ?? "";
}

/** A PayPal id made from the payment's, as the binary makes it when the Orders API made none. */
export function derivePayPalId(
  paymentDetail: PaymentDetail,
  idPrefix: string,
): string {
  return `${idPrefix}${paymentDetail.id.toUpperCase().slice(-16)}`;
}

const orderStatuses: Record<PaymentStatus, string> = {
  requires_payment: "CREATED",
  requires_action: "CREATED",
  authorized: "APPROVED",
  failed: "APPROVED",
  canceled: "VOIDED",
  succeeded: "COMPLETED",
  refunded: "COMPLETED",
  partially_refunded: "COMPLETED",
  disputed: "COMPLETED",
};

function readCaptureStatus(paymentDetail: PaymentDetail): string {
  if (paymentDetail.status === "failed") {
    return "DECLINED";
  }
  if (paymentDetail.status === "refunded") {
    return "REFUNDED";
  }

  return paymentDetail.status === "partially_refunded"
    ? "PARTIALLY_REFUNDED"
    : "COMPLETED";
}

/** The order with its main fields, as `GET /v2/checkout/orders/{id}` answers it. */
export function describeOrder(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const orderId = readOrderId(paymentDetail);

  return {
    id: orderId,
    intent: "CAPTURE",
    status: orderStatuses[paymentDetail.status],
    purchase_units: [
      {
        reference_id: "default",
        amount: describePayPalAmount(
          paymentDetail.amount_minor,
          paymentDetail.currency,
        ),
      },
    ],
    create_time: paymentDetail.created_at,
    links: [
      {
        href: `${mockApiBaseUrl}/v2/checkout/orders/${orderId}`,
        rel: "self",
        method: "GET",
      },
    ],
  };
}

/** The capture with its main fields, as `GET /v2/payments/captures/{id}` answers it. */
export function describeCapture(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const captureId = derivePayPalId(paymentDetail, "C");

  return {
    id: captureId,
    status: readCaptureStatus(paymentDetail),
    amount: describePayPalAmount(
      paymentDetail.amount_minor,
      paymentDetail.currency,
    ),
    final_capture: true,
    supplementary_data: {
      related_ids: { order_id: readOrderId(paymentDetail) },
    },
    links: [
      {
        href: `${mockApiBaseUrl}/v2/payments/captures/${captureId}`,
        rel: "self",
        method: "GET",
      },
    ],
    create_time: paymentDetail.created_at,
    update_time: paymentDetail.created_at,
  };
}

/** A refund of all that was refunded, as `GET /v2/payments/refunds/{id}` answers it. */
export function describeRefund(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const refundId = derivePayPalId(paymentDetail, "R");

  return {
    id: refundId,
    amount: describePayPalAmount(
      paymentDetail.refunded_minor,
      paymentDetail.currency,
    ),
    status: "COMPLETED",
    links: [
      {
        href: `${mockApiBaseUrl}/v2/payments/refunds/${refundId}`,
        rel: "self",
        method: "GET",
      },
      {
        href: `${mockApiBaseUrl}/v2/payments/captures/${derivePayPalId(paymentDetail, "C")}`,
        rel: "up",
        method: "GET",
      },
    ],
  };
}

const disputeReasons: Partial<Record<string, string>> = {
  fraudulent: "UNAUTHORISED",
  product_not_received: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  product_unacceptable: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
  duplicate: "DUPLICATE_TRANSACTION",
  credit_not_processed: "CREDIT_NOT_PROCESSED",
  subscription_canceled: "CANCELED_RECURRING_BILLING",
};

/** The dispute with its main fields, as PayPal's Customer Disputes API describes it. */
export function describePayPalDispute(
  paymentDetail: PaymentDetail,
): Record<string, unknown> | null {
  const paymentDispute = paymentDetail.dispute;
  if (paymentDispute === null) {
    return null;
  }
  const captureId = derivePayPalId(paymentDetail, "C");
  const isResolved = ["won", "lost"].includes(paymentDispute.status);
  const paypalStatuses: Record<string, string> = {
    needs_response: "OPEN",
    under_review: "UNDER_REVIEW",
  };

  return {
    dispute_id: `PP-D-${captureId}`,
    disputed_transactions: [{ seller_transaction_id: captureId }],
    reason: disputeReasons[paymentDispute.reason] ?? "OTHER",
    status: paypalStatuses[paymentDispute.status] ?? "RESOLVED",
    dispute_amount: describePayPalAmount(
      paymentDetail.captured_minor,
      paymentDetail.currency,
    ),
    ...(!isResolved
      ? {}
      : {
          dispute_outcome: {
            outcome_code:
              paymentDispute.status === "won"
                ? "RESOLVED_SELLER_FAVOUR"
                : "RESOLVED_BUYER_FAVOUR",
          },
        }),
  };
}
