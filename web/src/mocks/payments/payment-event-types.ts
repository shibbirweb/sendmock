import type { AppEventType, PaymentEventType } from "@/lib/api/types";

/** Whether an event is one a payment notification can carry. */
export function isPaymentEventType(
  eventType: AppEventType,
): eventType is PaymentEventType {
  return eventType.startsWith("payment.") || eventType.startsWith("checkout.");
}
