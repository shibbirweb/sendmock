import type { PaymentDetail } from "@/lib/api/types";
import { buildPayPalEventObject } from "@/mocks/payments/paypal/build-paypal-event-object";
import { describeSslcommerzTransaction } from "@/mocks/payments/sslcommerz/sslcommerz-transaction";
import {
  describeCharge,
  describeDispute,
} from "@/mocks/payments/stripe/stripe-charge-object";
import { describeCheckoutSession } from "@/mocks/payments/stripe/stripe-checkout-session-object";
import { describePaymentIntent } from "@/mocks/payments/stripe/stripe-payment-intent-object";
import {
  buildRazorpayEventObject,
  buildRazorpayRedirectObject,
} from "@/mocks/payments/razorpay/build-razorpay-event-object";

/**
 * The object a Stripe event is about, chosen by the event's name as the
 * binary chooses it; null for a name Stripe does not send.
 */
export function buildStripeEventObject(
  paymentDetail: PaymentDetail,
  eventName: string,
): Record<string, unknown> | null {
  if (eventName.startsWith("checkout.session.")) {
    return describeCheckoutSession(paymentDetail);
  }
  if (eventName.startsWith("charge.dispute.")) {
    return describeDispute(paymentDetail);
  }
  if (eventName.startsWith("charge.")) {
    return describeCharge(paymentDetail);
  }
  if (eventName.startsWith("payment_intent.")) {
    return describePaymentIntent(paymentDetail);
  }

  return null;
}

/**
 * The gateway's own object its redirect fields read as `event.object`, with
 * `redirectStatus` the gateway's name for the outcome; SSLCommerz has one.
 */
export function buildProviderRedirectObject(
  gatewayKey: string,
  paymentDetail: PaymentDetail,
  redirectStatus: string,
): Record<string, unknown> | null {
  if (gatewayKey === "razorpay") {
    return buildRazorpayRedirectObject(paymentDetail);
  }

  return gatewayKey === "sslcommerz"
    ? describeSslcommerzTransaction(paymentDetail, redirectStatus)
    : null;
}

/** The gateway's own object for `event.object`; Stripe, PayPal, SSLCommerz and Razorpay have one. */
export function buildProviderEventObject(
  gatewayKey: string,
  paymentDetail: PaymentDetail,
  eventName: string,
): Record<string, unknown> | null {
  if (gatewayKey === "stripe") {
    return buildStripeEventObject(paymentDetail, eventName);
  }
  if (gatewayKey === "paypal") {
    return buildPayPalEventObject(paymentDetail, eventName);
  }
  if (gatewayKey === "razorpay") {
    return buildRazorpayEventObject(paymentDetail, eventName);
  }

  return buildProviderRedirectObject(gatewayKey, paymentDetail, eventName);
}
