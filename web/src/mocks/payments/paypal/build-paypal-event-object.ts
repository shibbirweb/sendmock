import type { PaymentDetail } from "@/lib/api/types";
import {
  describeCapture,
  describeOrder,
  describePayPalDispute,
  describeRefund,
} from "@/mocks/payments/paypal/paypal-resource-objects";

/**
 * The resource a PayPal webhook event is about, chosen by the event's name as
 * the binary chooses it; null for a name PayPal does not send.
 */
export function buildPayPalEventObject(
  paymentDetail: PaymentDetail,
  eventName: string,
): Record<string, unknown> | null {
  if (eventName.startsWith("CHECKOUT.ORDER.")) {
    return describeOrder(paymentDetail);
  }
  if (eventName === "PAYMENT.CAPTURE.REFUNDED") {
    return describeRefund(paymentDetail);
  }
  if (eventName.startsWith("PAYMENT.CAPTURE.")) {
    return describeCapture(paymentDetail);
  }
  if (eventName.startsWith("CUSTOMER.DISPUTE.")) {
    return describePayPalDispute(paymentDetail);
  }

  return null;
}
