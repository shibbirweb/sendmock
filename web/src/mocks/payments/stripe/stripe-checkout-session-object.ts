import type { PaymentDetail } from "@/lib/api/types";
import {
  readCreatedSeconds,
  readPaymentIntentId,
  readSessionId,
} from "@/mocks/payments/stripe/stripe-object-ids";

/** How long Stripe keeps a Checkout Session open when `expires_at` is not sent. */
const sessionLifetimeSeconds = 24 * 60 * 60;

const paidStatuses = new Set<PaymentDetail["status"]>([
  "succeeded",
  "refunded",
  "partially_refunded",
  "disputed",
]);

/** `open` until paid or expired: after a decline the customer may still pay, as on Stripe. */
function readSessionStatus(paymentDetail: PaymentDetail): string {
  if (paymentDetail.status === "canceled") {
    return "expired";
  }
  if (
    paymentDetail.status === "authorized" ||
    paidStatuses.has(paymentDetail.status)
  ) {
    return "complete";
  }

  return "open";
}

function describeCustomerDetails(
  paymentDetail: PaymentDetail,
): Record<string, unknown> | null {
  if (readSessionStatus(paymentDetail) !== "complete") {
    return null;
  }

  return {
    address: null,
    email: paymentDetail.customer_email,
    name: paymentDetail.customer_name,
    phone: null,
    tax_exempt: "none",
    tax_ids: [],
  };
}

/** The payment as Stripe's Checkout Session object in `payment` mode. */
export function describeCheckoutSession(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const createdSeconds = readCreatedSeconds(paymentDetail);

  return {
    id: readSessionId(paymentDetail),
    object: "checkout.session",
    amount_subtotal: paymentDetail.amount_minor,
    amount_total: paymentDetail.amount_minor,
    cancel_url: paymentDetail.cancel_url,
    client_reference_id: null,
    created: createdSeconds,
    currency: paymentDetail.currency.toLowerCase(),
    customer: null,
    customer_details: describeCustomerDetails(paymentDetail),
    customer_email: paymentDetail.customer_email,
    expires_at: createdSeconds + sessionLifetimeSeconds,
    livemode: false,
    metadata: paymentDetail.metadata,
    mode: "payment",
    payment_intent:
      paymentDetail.method === null ? null : readPaymentIntentId(paymentDetail),
    payment_method_types: ["card"],
    payment_status: paidStatuses.has(paymentDetail.status) ? "paid" : "unpaid",
    status: readSessionStatus(paymentDetail),
    success_url: paymentDetail.success_url,
    ui_mode: "hosted",
    url: paymentDetail.checkout_url,
  };
}
