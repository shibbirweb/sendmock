import type {
  BuiltinPaymentProvider,
  PaymentEventType,
  PaymentGatewayDefinition,
} from "@/lib/api/types";

/** What the mock stores; Modified and usage are worked out when presented. */
export type PaymentGatewayRecord = Omit<
  PaymentGatewayDefinition,
  "is_modified" | "payment_count"
>;

export const paymentEventTypes: PaymentEventType[] = [
  "payment.created",
  "payment.authorized",
  "payment.succeeded",
  "payment.failed",
  "payment.canceled",
  "payment.refunded",
  "payment.partially_refunded",
  "payment.dispute_opened",
  "payment.dispute_closed",
  "checkout.completed",
  "checkout.expired",
];

/** Every event named; the ones a gateway does not send stay blank. */
function nameEvents(
  eventNames: Partial<Record<PaymentEventType, string>>,
): Record<PaymentEventType, string> {
  return Object.fromEntries(
    paymentEventTypes.map((eventType) => [
      eventType,
      eventNames[eventType] ?? "",
    ]),
  ) as Record<PaymentEventType, string>;
}

const stripeBody = `{
  "id": "evt_{{ random_string(24) }}",
  "object": "event",
  "type": "{{ event.name }}",
  "created": {{ event.created }},
  "data": {
    "object": {
      "id": "{{ payment.reference }}",
      "amount": {{ payment.amount_minor }},
      "currency": "{{ payment.currency | lower }}",
      "status": "{{ payment.status }}"
    }
  }
}`;

const paypalBody = `{
  "id": "WH-{{ random_string(17) | upper }}",
  "event_type": "{{ event.name }}",
  "resource": {
    "id": "{{ payment.reference }}",
    "amount": {
      "currency_code": "{{ payment.currency }}",
      "value": "{{ payment.amount_major }}"
    },
    "status": "{{ payment.status | upper }}"
  }
}`;

const sslcommerzBody = [
  "tran_id={{ payment.reference | urlencode }}",
  'val_id={{ payment.provider_ids.val_id | default("") | urlencode }}',
  "amount={{ payment.amount_major }}",
  "currency={{ payment.currency }}",
  "status={{ event.name }}",
  "verify_key=amount%2Ccurrency%2Cstatus%2Ctran_id%2Cval_id",
  "verify_sign={{ random_hex(32) }}",
].join("&");

const bkashBody = `{
  "paymentID": "{{ payment.reference }}",
  "trxID": "{{ payment.provider_ids.trx_id | default("") }}",
  "transactionStatus": "{{ event.name }}",
  "amount": "{{ payment.amount_major }}",
  "currency": "{{ payment.currency }}"
}`;

const nativeBody = `{
  "type": "{{ event.type }}",
  "data": {
    "id": "{{ payment.id }}",
    "amount_minor": {{ payment.amount_minor }},
    "currency": "{{ payment.currency }}",
    "status": "{{ payment.status }}"
  }
}`;

type ShippedGateway = Omit<
  PaymentGatewayRecord,
  "notification_endpoint_id" | "is_enabled" | "is_builtin"
>;

/** The shipped gateways, reproducing each provider's real shapes (17-payments). */
const shippedGateways: ShippedGateway[] = [
  {
    key: "stripe",
    name: "Stripe",
    accent: "#635bff",
    method_keys: ["card"],
    credentials: [
      {
        name: "secret_key",
        value: "sk_test_sendmock000000000000",
        is_secret: true,
      },
      {
        name: "webhook_secret",
        value: "whsec_sendmock0000000000000",
        is_secret: true,
      },
    ],
    redirect_method: "GET",
    redirect_fields: [
      {
        name: "session_id",
        template: "{{ payment.reference }}",
        send_on: "always",
      },
    ],
    notification_content_type: "json",
    event_names: nameEvents({
      "payment.created": "payment_intent.created",
      "payment.authorized": "payment_intent.amount_capturable_updated",
      "payment.succeeded": "payment_intent.succeeded",
      "payment.failed": "payment_intent.payment_failed",
      "payment.canceled": "payment_intent.canceled",
      "payment.refunded": "charge.refunded",
      "payment.partially_refunded": "charge.refunded",
      "payment.dispute_opened": "charge.dispute.created",
      "payment.dispute_closed": "charge.dispute.closed",
      "checkout.completed": "checkout.session.completed",
      "checkout.expired": "checkout.session.expired",
    }),
    notification_body: stripeBody,
    notification_headers: [
      {
        name: "stripe-signature",
        template: "{{ stripe_signature(merchant.webhook_secret) }}",
      },
    ],
  },
  {
    key: "paypal",
    name: "PayPal",
    accent: "#ffc439",
    method_keys: ["paypal_account"],
    credentials: [
      {
        name: "client_id",
        value: "AZsendmockSandboxClient01",
        is_secret: false,
      },
      {
        name: "client_secret",
        value: "EKsendmockSandboxSecret01",
        is_secret: true,
      },
    ],
    redirect_method: "GET",
    redirect_fields: [
      { name: "token", template: "{{ payment.reference }}", send_on: "always" },
      { name: "PayerID", template: "TESTPAYER01", send_on: "success" },
    ],
    notification_content_type: "json",
    event_names: nameEvents({
      "payment.authorized": "PAYMENT.AUTHORIZATION.CREATED",
      "payment.succeeded": "PAYMENT.CAPTURE.COMPLETED",
      "payment.failed": "PAYMENT.CAPTURE.DENIED",
      "payment.canceled": "PAYMENT.AUTHORIZATION.VOIDED",
      "payment.refunded": "PAYMENT.CAPTURE.REFUNDED",
      "payment.partially_refunded": "PAYMENT.CAPTURE.REFUNDED",
      "payment.dispute_opened": "CUSTOMER.DISPUTE.CREATED",
      "payment.dispute_closed": "CUSTOMER.DISPUTE.RESOLVED",
      "checkout.completed": "CHECKOUT.ORDER.APPROVED",
      "checkout.expired": "CHECKOUT.ORDER.VOIDED",
    }),
    notification_body: paypalBody,
    notification_headers: [
      { name: "paypal-transmission-id", template: "{{ uuid() }}" },
      { name: "paypal-transmission-time", template: "{{ now_iso() }}" },
      { name: "paypal-transmission-sig", template: "{{ random_string(88) }}" },
      { name: "paypal-auth-algo", template: "SHA256withRSA" },
    ],
  },
  {
    key: "sslcommerz",
    name: "SSLCommerz",
    accent: "#1e5bb8",
    method_keys: ["card", "bkash", "nagad", "rocket", "dbbl", "city", "brac"],
    credentials: [
      { name: "store_id", value: "sendm0000000001", is_secret: false },
      { name: "store_passwd", value: "sendm0000000001@ssl", is_secret: true },
    ],
    redirect_method: "POST",
    redirect_fields: [
      {
        name: "tran_id",
        template: "{{ payment.reference }}",
        send_on: "always",
      },
      {
        name: "val_id",
        template: '{{ payment.provider_ids.val_id | default("") }}',
        send_on: "always",
      },
      {
        name: "amount",
        template: "{{ payment.amount_major }}",
        send_on: "always",
      },
      {
        name: "currency",
        template: "{{ payment.currency }}",
        send_on: "always",
      },
      { name: "status", template: "{{ redirect.status }}", send_on: "always" },
    ],
    notification_content_type: "form",
    event_names: nameEvents({
      "payment.succeeded": "VALID",
      "payment.failed": "FAILED",
      "payment.canceled": "CANCELLED",
      "payment.refunded": "REFUNDED",
      "payment.partially_refunded": "REFUNDED",
      "checkout.expired": "EXPIRED",
    }),
    notification_body: sslcommerzBody,
    notification_headers: [],
  },
  {
    key: "bkash",
    name: "bKash",
    accent: "#e2136e",
    method_keys: ["bkash"],
    credentials: [
      { name: "app_key", value: "sendmock-bkash-app-key", is_secret: false },
      {
        name: "app_secret",
        value: "sendmock-bkash-app-secret",
        is_secret: true,
      },
      { name: "username", value: "sandboxTokenizedUser02", is_secret: false },
      {
        name: "password",
        value: "sandboxTokenizedUser02@12345",
        is_secret: true,
      },
    ],
    redirect_method: "GET",
    redirect_fields: [
      {
        name: "paymentID",
        template: "{{ payment.reference }}",
        send_on: "always",
      },
      { name: "status", template: "{{ redirect.status }}", send_on: "always" },
    ],
    notification_content_type: "json",
    event_names: nameEvents({
      "payment.succeeded": "success",
      "payment.failed": "failure",
      "payment.canceled": "cancel",
      "payment.refunded": "refunded",
      "payment.partially_refunded": "refunded",
      "checkout.expired": "cancel",
    }),
    notification_body: bkashBody,
    notification_headers: [],
  },
  {
    key: "native",
    name: "Native",
    accent: "#0d9488",
    method_keys: ["card"],
    credentials: [],
    redirect_method: "GET",
    redirect_fields: [
      { name: "payment_id", template: "{{ payment.id }}", send_on: "always" },
      {
        name: "outcome",
        template: "{{ redirect.outcome }}",
        send_on: "always",
      },
    ],
    notification_content_type: "json",
    event_names: nameEvents(
      Object.fromEntries(
        paymentEventTypes.map((eventType) => [eventType, eventType]),
      ),
    ),
    notification_body: nativeBody,
    // Signed with the notification endpoint's own secret (Standard Webhooks).
    notification_headers: [],
  },
];

/** The shipped gateways; a fresh copy each time, so Reset to default has an original (PY-12.2). */
export function buildBuiltinPaymentGateways(
  notificationEndpointId: string | null,
): PaymentGatewayRecord[] {
  return structuredClone(shippedGateways).map((shippedGateway) => ({
    ...shippedGateway,
    is_enabled: true,
    is_builtin: true,
    notification_endpoint_id: notificationEndpointId,
  }));
}

export const builtinPaymentProviders: BuiltinPaymentProvider[] = [
  "stripe",
  "paypal",
  "sslcommerz",
  "bkash",
  "native",
];
