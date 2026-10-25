/** What each value a gateway template can read means, by path (PY-12.4). */
export const gatewayFieldDescriptions: Record<string, string> = {
  payment: "The payment the redirect or notification is about.",
  "payment.id": "SendMock id of the payment.",
  "payment.reference":
    "The gateway's main id: session, intent, order or transaction.",
  "payment.amount_minor": "The amount in minor units, e.g. 1200 for 12.00.",
  "payment.amount_major": "The amount with decimals as text, e.g. 12.00.",
  "payment.currency": "ISO 4217 currency code, e.g. BDT or USD.",
  "payment.status": "SendMock status, e.g. succeeded, failed or refunded.",
  "payment.failure_code": "Why it failed or was declined, else empty.",
  "payment.customer": "Who paid.",
  "payment.customer.email": "The customer's email, may be empty.",
  "payment.customer.name": "The customer's name, may be empty.",
  "payment.customer.phone": "The customer's phone, may be empty.",
  "payment.method":
    "What was paid with: card brand and last 4, or a masked wallet.",
  "payment.provider_ids": "Every id the gateway gave the payment, by name.",
  "payment.metadata": "Key / value pairs the app attached, e.g. order_id.",
  event: "The native event the notification is for.",
  "event.id": "Event id, the same on every retry.",
  "event.type": "SendMock's event name, e.g. payment.succeeded.",
  "event.name": "This gateway's name for the event, from Event names.",
  "event.created": "When it happened, Unix seconds.",
  redirect: "Where the checkout ended, for redirect fields.",
  "redirect.outcome": "success, fail or cancel.",
  "redirect.status":
    "This gateway's event name for the outcome (payment.succeeded, failed or canceled).",
  merchant:
    "The merchant credentials by name; secrets are masked in previews and real in deliveries.",
};
