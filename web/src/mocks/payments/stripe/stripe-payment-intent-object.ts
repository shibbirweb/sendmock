import type { PaymentDetail } from "@/lib/api/types";
import {
  deriveRelatedId,
  describeLastPaymentError,
  readCreatedSeconds,
  readPaymentIntentId,
} from "@/mocks/payments/stripe/stripe-object-ids";

/** The address Stripe's `next_action` sends a 3-D Secure customer to. */
const mockHttpAddress = "127.0.0.1:8025";

/** The PaymentIntent's status for the payment's, as the binary maps it. */
function readIntentStatus(paymentDetail: PaymentDetail): string {
  switch (paymentDetail.status) {
    case "requires_payment":
    case "failed":
      return "requires_payment_method";
    case "requires_action":
      return "requires_action";
    case "authorized":
      return "requires_capture";
    case "canceled":
      return "canceled";
    default:
      return "succeeded";
  }
}

/** The card a payment was paid with as a Stripe PaymentMethod; null before a card is used. */
export function describePaymentMethod(
  paymentDetail: PaymentDetail,
  paymentMethodId: string,
): Record<string, unknown> | null {
  const paymentMethod = paymentDetail.method;
  if (paymentMethod?.kind !== "card") {
    return null;
  }

  return {
    id: paymentMethodId,
    object: "payment_method",
    card: {
      brand: paymentMethod.brand,
      country: "US",
      exp_month: paymentMethod.exp_month,
      exp_year: paymentMethod.exp_year,
      funding: "credit",
      last4: paymentMethod.last4,
    },
    created: readCreatedSeconds(paymentDetail),
    customer: null,
    livemode: false,
    metadata: {},
    type: "card",
  };
}

function describeNextAction(
  paymentDetail: PaymentDetail,
): Record<string, unknown> | null {
  if (paymentDetail.status !== "requires_action") {
    return null;
  }

  return {
    type: "redirect_to_url",
    redirect_to_url: {
      return_url: null,
      url: `http://${mockHttpAddress}/pay/${paymentDetail.id}`,
    },
  };
}

/** The payment as Stripe's PaymentIntent object. */
export function describePaymentIntent(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const paymentIntentId = readPaymentIntentId(paymentDetail);
  const intentStatus = readIntentStatus(paymentDetail);
  const hasCard = paymentDetail.method !== null;
  const lastPaymentError = describeLastPaymentError(paymentDetail);

  return {
    id: paymentIntentId,
    object: "payment_intent",
    amount: paymentDetail.amount_minor,
    amount_capturable:
      intentStatus === "requires_capture" ? paymentDetail.amount_minor : 0,
    amount_received: paymentDetail.captured_minor,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: paymentDetail.capture_method,
    client_secret: `${paymentIntentId}_secret_${paymentDetail.id}`,
    confirmation_method: "automatic",
    created: readCreatedSeconds(paymentDetail),
    currency: paymentDetail.currency.toLowerCase(),
    customer: null,
    description: null,
    last_payment_error:
      lastPaymentError === null
        ? null
        : {
            ...lastPaymentError,
            payment_method: describePaymentMethod(
              paymentDetail,
              deriveRelatedId(paymentIntentId, "pm"),
            ),
          },
    latest_charge: hasCard ? deriveRelatedId(paymentIntentId, "ch") : null,
    livemode: false,
    metadata: paymentDetail.metadata,
    next_action: describeNextAction(paymentDetail),
    payment_method:
      hasCard && intentStatus !== "requires_payment_method"
        ? deriveRelatedId(paymentIntentId, "pm")
        : null,
    payment_method_types: ["card"],
    receipt_email: paymentDetail.customer_email,
    status: intentStatus,
  };
}
