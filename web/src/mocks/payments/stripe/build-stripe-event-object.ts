import type { PaymentDetail } from "@/lib/api/types";
import { buildPayPalEventObject } from "@/mocks/payments/paypal/build-paypal-event-object";
import {
  describeCharge,
  describeDispute,
} from "@/mocks/payments/stripe/stripe-charge-object";
import { describeCheckoutSession } from "@/mocks/payments/stripe/stripe-checkout-session-object";
import { describePaymentIntent } from "@/mocks/payments/stripe/stripe-payment-intent-object";

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

/** The gateway's own object for `event.object`; Stripe and PayPal have one. */
export function buildProviderEventObject(
  gatewayKey: string,
  paymentDetail: PaymentDetail,
  eventName: string,
): Record<string, unknown> | null {
  if (gatewayKey === "stripe") {
    return buildStripeEventObject(paymentDetail, eventName);
  }

  return gatewayKey === "paypal"
    ? buildPayPalEventObject(paymentDetail, eventName)
    : null;
}
