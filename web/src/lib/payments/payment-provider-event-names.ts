import type { PaymentEventType } from "@/lib/api/types";

/**
 * The tables the `payment_event` template filter knows: each provider's
 * event names, and the status its payload object has after the event
 * (`stripe_status`, `paypal_status`, `razorpay_status`, `paddle_status`),
 * and the `resource_type` and `summary` of PayPal's webhook event
 * (`paypal_resource_type`, `paypal_summary`).
 */
export type PaymentEventProvider =
  | "stripe"
  | "stripe_status"
  | "paypal"
  | "paypal_status"
  | "paypal_resource_type"
  | "paypal_summary"
  | "paypal_ipn"
  | "sslcommerz"
  | "bkash"
  | "razorpay"
  | "razorpay_status"
  | "paddle"
  | "paddle_status";

/**
 * SendMock's payment and checkout events in each provider's own words, as
 * its webhooks or IPNs name them; an event the provider has no word for is
 * left out. The binary's `payment_event` filter reads the same table, exported
 * to crates/sendmock-ops/builtin/payment-event-names.json.
 */
export const paymentProviderEventNames: Record<
  PaymentEventProvider,
  Partial<Record<PaymentEventType, string>>
> = {
  stripe: {
    "payment.created": "payment_intent.created",
    "payment.authorized": "payment_intent.amount_capturable_updated",
    "payment.succeeded": "payment_intent.succeeded",
    "payment.failed": "payment_intent.payment_failed",
    "payment.canceled": "payment_intent.canceled",
    "payment.refunded": "charge.refunded",
    "payment.partially_refunded": "charge.refunded",
    "payment.dispute_opened": "charge.dispute.created",
    "payment.dispute_updated": "charge.dispute.updated",
    "payment.dispute_closed": "charge.dispute.closed",
    "checkout.completed": "checkout.session.completed",
    "checkout.expired": "checkout.session.expired",
  },
  stripe_status: {
    "payment.created": "requires_payment_method",
    "payment.authorized": "requires_capture",
    "payment.succeeded": "succeeded",
    "payment.failed": "requires_payment_method",
    "payment.canceled": "canceled",
    "payment.refunded": "succeeded",
    "payment.partially_refunded": "succeeded",
    "payment.dispute_opened": "succeeded",
    "payment.dispute_updated": "succeeded",
    "payment.dispute_closed": "succeeded",
    "checkout.completed": "succeeded",
    "checkout.expired": "canceled",
  },
  paypal: {
    "payment.authorized": "PAYMENT.AUTHORIZATION.CREATED",
    "payment.succeeded": "PAYMENT.CAPTURE.COMPLETED",
    "payment.failed": "PAYMENT.CAPTURE.DENIED",
    "payment.canceled": "PAYMENT.AUTHORIZATION.VOIDED",
    "payment.refunded": "PAYMENT.CAPTURE.REFUNDED",
    "payment.partially_refunded": "PAYMENT.CAPTURE.REFUNDED",
    "payment.dispute_opened": "CUSTOMER.DISPUTE.CREATED",
    "payment.dispute_updated": "CUSTOMER.DISPUTE.UPDATED",
    "payment.dispute_closed": "CUSTOMER.DISPUTE.RESOLVED",
    "checkout.completed": "CHECKOUT.ORDER.APPROVED",
    "checkout.expired": "CHECKOUT.ORDER.VOIDED",
  },
  paypal_status: {
    "payment.created": "PENDING",
    "payment.authorized": "PENDING",
    "payment.succeeded": "COMPLETED",
    "payment.failed": "DECLINED",
    "payment.canceled": "FAILED",
    "payment.refunded": "REFUNDED",
    "payment.partially_refunded": "PARTIALLY_REFUNDED",
    "payment.dispute_opened": "COMPLETED",
    "payment.dispute_updated": "COMPLETED",
    "payment.dispute_closed": "COMPLETED",
    "checkout.completed": "COMPLETED",
    "checkout.expired": "FAILED",
  },
  paypal_resource_type: {
    "payment.succeeded": "capture",
    "payment.failed": "capture",
    "payment.refunded": "refund",
    "payment.partially_refunded": "refund",
    "payment.dispute_opened": "dispute",
    "payment.dispute_updated": "dispute",
    "payment.dispute_closed": "dispute",
    "checkout.completed": "checkout-order",
    "checkout.expired": "checkout-order",
  },
  paypal_summary: {
    "payment.succeeded": "Payment completed",
    "payment.failed": "Payment denied",
    "payment.refunded": "A capture payment was refunded",
    "payment.partially_refunded": "A capture payment was refunded",
    "payment.dispute_opened": "A new dispute opened",
    "payment.dispute_updated": "A dispute was updated",
    "payment.dispute_closed": "A dispute was resolved",
    "checkout.completed": "An order has been approved by buyer",
    "checkout.expired": "An order has been voided",
  },
  paypal_ipn: {
    "payment.created": "Pending",
    "payment.authorized": "Pending",
    "payment.succeeded": "Completed",
    "payment.failed": "Denied",
    "payment.canceled": "Voided",
    "payment.refunded": "Refunded",
    "payment.partially_refunded": "Refunded",
    "payment.dispute_opened": "Reversed",
    "payment.dispute_updated": "Reversed",
    "payment.dispute_closed": "Canceled_Reversal",
    "checkout.completed": "Completed",
    "checkout.expired": "Expired",
  },
  sslcommerz: {
    "payment.created": "UNATTEMPTED",
    "payment.succeeded": "VALID",
    "payment.failed": "FAILED",
    "payment.canceled": "CANCELLED",
    "checkout.completed": "VALID",
    "checkout.expired": "EXPIRED",
  },
  bkash: {
    "payment.succeeded": "success",
    "payment.failed": "failure",
    "payment.canceled": "cancel",
    "checkout.completed": "success",
    "checkout.expired": "cancel",
  },
  razorpay: {
    "payment.authorized": "payment.authorized",
    "payment.succeeded": "payment.captured",
    "payment.failed": "payment.failed",
    "payment.refunded": "refund.processed",
    "payment.partially_refunded": "refund.processed",
    "payment.dispute_opened": "payment.dispute.created",
    "payment.dispute_updated": "payment.dispute.under_review",
    "payment.dispute_closed": "payment.dispute.closed",
    "checkout.completed": "order.paid",
  },
  razorpay_status: {
    "payment.created": "created",
    "payment.authorized": "authorized",
    "payment.succeeded": "captured",
    "payment.failed": "failed",
    "payment.canceled": "failed",
    "payment.refunded": "refunded",
    "payment.partially_refunded": "captured",
    "payment.dispute_opened": "captured",
    "payment.dispute_updated": "captured",
    "payment.dispute_closed": "captured",
    "checkout.completed": "captured",
    "checkout.expired": "failed",
  },
  paddle: {
    "payment.created": "transaction.created",
    "payment.authorized": "transaction.ready",
    "payment.succeeded": "transaction.completed",
    "payment.failed": "transaction.payment_failed",
    "payment.canceled": "transaction.canceled",
    "payment.refunded": "adjustment.created",
    "payment.partially_refunded": "adjustment.created",
    "checkout.completed": "transaction.paid",
  },
  paddle_status: {
    "payment.created": "ready",
    "payment.authorized": "billed",
    "payment.succeeded": "completed",
    "payment.failed": "past_due",
    "payment.canceled": "canceled",
    "payment.refunded": "completed",
    "payment.partially_refunded": "completed",
    "payment.dispute_opened": "completed",
    "payment.dispute_updated": "completed",
    "payment.dispute_closed": "completed",
    "checkout.completed": "paid",
    "checkout.expired": "canceled",
  },
};

function isPaymentEventProvider(
  provider: string,
): provider is PaymentEventProvider {
  return Object.hasOwn(paymentProviderEventNames, provider);
}

/**
 * An event's name in the provider's words; the native name when the provider
 * is unknown or has no name for it.
 */
export function readPaymentProviderEventName(
  eventType: string,
  provider: string,
): string {
  if (!isPaymentEventProvider(provider)) {
    return eventType;
  }
  const providerEventNames: Partial<Record<string, string>> =
    paymentProviderEventNames[provider];

  return providerEventNames[eventType] ?? eventType;
}
