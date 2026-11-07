import { faker } from "@faker-js/faker";

import type { PaymentDetail } from "@/lib/api/types";

const capturedStatuses = new Set([
  "succeeded",
  "partially_refunded",
  "refunded",
  "disputed",
]);

function readUnixSeconds(timestampText: string): number {
  return Math.floor(Date.parse(timestampText) / 1000);
}

function readPaymentStatus(paymentDetail: PaymentDetail): string {
  const statusNames: Record<string, string> = {
    authorized: "authorized",
    refunded: "refunded",
    failed: "failed",
  };

  return statusNames[paymentDetail.status] ?? "captured";
}

function describePayment(paymentDetail: PaymentDetail) {
  return {
    id: paymentDetail.provider_ids.payment ?? "",
    entity: "payment",
    amount: paymentDetail.amount_minor,
    currency: paymentDetail.currency,
    status: readPaymentStatus(paymentDetail),
    order_id: paymentDetail.provider_ids.order ?? "",
    method: paymentDetail.method_key ?? "card",
    amount_refunded: paymentDetail.refunded_minor,
    captured: capturedStatuses.has(paymentDetail.status),
    email: paymentDetail.customer_email ?? "void@razorpay.com",
    contact: paymentDetail.customer_phone ?? "+919000090000",
    notes: paymentDetail.metadata,
    error_code:
      paymentDetail.failure_code === null ? null : "BAD_REQUEST_ERROR",
    error_reason: paymentDetail.failure_code,
    created_at: readUnixSeconds(paymentDetail.created_at),
  };
}

/** What Checkout hands `callback_url`; the signature looks real but is random here. */
export function buildRazorpayRedirectObject(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  return {
    razorpay_payment_id: paymentDetail.provider_ids.payment ?? "",
    razorpay_order_id: paymentDetail.provider_ids.order ?? "",
    razorpay_signature: faker.string
      .hexadecimal({ length: 64, prefix: "" })
      .toLowerCase(),
  };
}

/** A webhook's `contains` and `payload`, as Razorpay nests each entity. */
export function buildRazorpayEventObject(
  paymentDetail: PaymentDetail,
  eventName: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    payment: { entity: describePayment(paymentDetail) },
  };
  const contains = ["payment"];
  if (eventName.startsWith("refund.")) {
    payload.refund = {
      entity: {
        id: `rfnd_${(paymentDetail.provider_ids.order ?? "").replace("order_", "")}`,
        entity: "refund",
        amount: paymentDetail.refunded_minor,
        currency: paymentDetail.currency,
        payment_id: paymentDetail.provider_ids.payment ?? "",
        status: "processed",
      },
    };
    contains.unshift("refund");
  }
  if (eventName.startsWith("order.")) {
    payload.order = {
      entity: {
        id: paymentDetail.provider_ids.order ?? "",
        entity: "order",
        amount: paymentDetail.amount_minor,
        currency: paymentDetail.currency,
        status: "paid",
      },
    };
    contains.push("order");
  }

  return {
    ...buildRazorpayRedirectObject(paymentDetail),
    contains,
    payload,
  };
}
