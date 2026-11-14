import type { PaymentDetail } from "@/lib/api/types";
import { toMajorAmountText } from "@/mocks/payments/render-gateway-templates";

/**
 * What a payment event carries as `data`: the payment without its timeline
 * and notifications, plus the amount with decimals, as the binary sends it.
 */
export function toPaymentEventData(
  paymentDetail: PaymentDetail,
): Record<string, unknown> {
  const eventData: Record<string, unknown> = {
    ...paymentDetail,
    amount_major: toMajorAmountText(paymentDetail),
  };
  delete eventData.timeline;
  delete eventData.notifications;

  return eventData;
}

/** A paid Stripe checkout, for previews of payment events when no payment is picked. */
export const samplePaymentEventData: Record<string, unknown> = {
  id: "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
  provider: "stripe",
  provider_name: "Stripe",
  provider_reference: "cs_test_01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
  amount_minor: 1200,
  amount_major: "12.00",
  currency: "USD",
  status: "succeeded",
  customer_email: "lena@example.com",
  customer_name: "Lena Vogel",
  failure_code: null,
  refunded_minor: 0,
  created_at: "2026-01-01T09:00:00Z",
  provider_ids: {
    checkout_session: "cs_test_01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
    payment_intent: "pi_01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
  },
  customer_phone: null,
  method: {
    kind: "card",
    brand: "visa",
    last4: "4242",
    exp_month: 12,
    exp_year: 2030,
  },
  line_items: [{ name: "Test order", quantity: 1, unit_amount_minor: 1200 }],
  metadata: { order_id: "1001" },
  success_url: "http://localhost:8000/checkout/success",
  fail_url: "http://localhost:8000/checkout/fail",
  cancel_url: "http://localhost:8000/checkout/cancel",
  checkout_url: null,
  redirect: null,
  captured_minor: 1200,
  method_key: "card",
  dispute: null,
};
