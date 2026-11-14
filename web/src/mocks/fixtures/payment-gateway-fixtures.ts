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
  "payment.dispute_updated",
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
  "id": "{{ event.id }}",
  "object": "event",
  "api_version": "2025-03-31.basil",
  "created": {{ event.created }},
  "data": {
    "object": {{ event.object | json }}
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": {
    "id": null,
    "idempotency_key": null
  },
  "type": "{{ event.name }}"
}`;

const paypalBody = `{
  "id": "WH-{{ event.id | replace("evt_", "") | upper }}",
  "event_version": "1.0",
  "create_time": "{{ now_iso() }}",
  "resource_type": "{{ event.type | payment_event("paypal_resource_type") }}",
  "resource_version": "2.0",
  "event_type": "{{ event.name }}",
  "summary": "{{ event.type | payment_event("paypal_summary") }}",
  "resource": {{ event.object | json }}
}`;

/** The fields SSLCommerz posts in its IPN and its redirects, in its order. */
const sslcommerzTransactionFields = [
  "status",
  "tran_date",
  "tran_id",
  "val_id",
  "amount",
  "store_amount",
  "currency",
  "bank_tran_id",
  "card_type",
  "card_no",
  "card_issuer",
  "card_brand",
  "card_issuer_country",
  "card_issuer_country_code",
  "currency_type",
  "currency_amount",
  "currency_rate",
  "base_fair",
  "value_a",
  "value_b",
  "value_c",
  "value_d",
  "risk_level",
  "risk_title",
  "verify_key",
];

const sslcommerzVerifySign =
  "{{ sslcommerz_verify_sign(merchant.store_passwd, event.object) }}";

const sslcommerzBody = [
  ...sslcommerzTransactionFields.map(
    (fieldName) => `${fieldName}={{ event.object.${fieldName} | urlencode }}`,
  ),
  `verify_sign=${sslcommerzVerifySign}`,
].join("&");

const sslcommerzRedirectFields: ShippedGateway["redirect_fields"] = [
  ...sslcommerzTransactionFields.map((fieldName) => ({
    name: fieldName,
    template: `{{ event.object.${fieldName} }}`,
    send_on: "always" as const,
  })),
  {
    name: "verify_sign",
    template: sslcommerzVerifySign,
    send_on: "always",
  },
];

const bkashBody = `{
  "paymentID": "{{ payment.reference }}",
  "trxID": "{{ payment.provider_ids.trx_id | default("") }}",
  "transactionStatus": "{{ event.name }}",
  "amount": "{{ payment.amount_major }}",
  "currency": "{{ payment.currency }}"
}`;

/** Razorpay's webhook: the entities nest under `payload`, named by `contains`. */
const razorpayBody = `{
  "entity": "event",
  "account_id": "acc_SendMock000001",
  "event": "{{ event.name }}",
  "contains": {{ event.object.contains | json }},
  "payload": {{ event.object.payload | json }},
  "created_at": {{ event.created }}
}`;

const razorpayCheckoutFields = [
  "razorpay_payment_id",
  "razorpay_order_id",
  "razorpay_signature",
];

/** Paddle's notification: the transaction or adjustment as `data`. */
const paddleBody = `{
  "event_id": "{{ event.id }}",
  "event_type": "{{ event.name }}",
  "occurred_at": "{{ event.object.occurred_at }}",
  "notification_id": "{{ event.id | replace("evt_", "ntf_") }}",
  "data": {{ event.object.data | json }}
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
      "payment.dispute_updated": "charge.dispute.updated",
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
      "payment.succeeded": "PAYMENT.CAPTURE.COMPLETED",
      "payment.failed": "PAYMENT.CAPTURE.DENIED",
      "payment.refunded": "PAYMENT.CAPTURE.REFUNDED",
      "payment.partially_refunded": "PAYMENT.CAPTURE.REFUNDED",
      "payment.dispute_opened": "CUSTOMER.DISPUTE.CREATED",
      "payment.dispute_updated": "CUSTOMER.DISPUTE.UPDATED",
      "payment.dispute_closed": "CUSTOMER.DISPUTE.RESOLVED",
      "checkout.completed": "CHECKOUT.ORDER.APPROVED",
      "checkout.expired": "CHECKOUT.ORDER.VOIDED",
    }),
    notification_body: paypalBody,
    notification_headers: [
      { name: "paypal-transmission-id", template: "{{ uuid() }}" },
      { name: "paypal-transmission-time", template: "{{ now_iso() }}" },
      { name: "paypal-transmission-sig", template: "{{ random_string(344) }}" },
      {
        name: "paypal-cert-url",
        template:
          "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-a5cafa77",
      },
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
    redirect_fields: sslcommerzRedirectFields,
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
    key: "razorpay",
    name: "Razorpay",
    accent: "#3395ff",
    method_keys: ["card"],
    credentials: [
      { name: "key_id", value: "rzp_test_SendMock0001", is_secret: false },
      {
        name: "key_secret",
        value: "sendmockRazorpayKeySecret01",
        is_secret: true,
      },
      {
        name: "webhook_secret",
        value: "sendmock_razorpay_webhook_secret",
        is_secret: true,
      },
    ],
    redirect_method: "POST",
    redirect_fields: razorpayCheckoutFields.map((fieldName) => ({
      name: fieldName,
      template: `{{ event.object.${fieldName} }}`,
      send_on: "success" as const,
    })),
    notification_content_type: "json",
    event_names: nameEvents({
      "payment.authorized": "payment.authorized",
      "payment.succeeded": "payment.captured",
      "payment.failed": "payment.failed",
      "payment.refunded": "refund.processed",
      "payment.partially_refunded": "refund.processed",
      "payment.dispute_opened": "payment.dispute.created",
      "payment.dispute_updated": "payment.dispute.under_review",
      "payment.dispute_closed": "payment.dispute.closed",
      "checkout.completed": "order.paid",
    }),
    notification_body: razorpayBody,
    notification_headers: [
      {
        name: "x-razorpay-signature",
        template: "{{ razorpay_signature(merchant.webhook_secret) }}",
      },
      { name: "x-razorpay-event-id", template: "{{ event.id }}" },
    ],
  },
  {
    key: "paddle",
    name: "Paddle",
    accent: "#fddd35",
    method_keys: ["card"],
    credentials: [
      {
        name: "api_key",
        value: "pdl_sdbx_apikey_sendmock_SendMockPaddleKey01",
        is_secret: true,
      },
      {
        name: "notification_secret",
        value: "pdl_ntfset_sendmock_SendMockPaddleSecret01",
        is_secret: true,
      },
    ],
    redirect_method: "GET",
    redirect_fields: [
      { name: "_ptxn", template: "{{ payment.reference }}", send_on: "always" },
    ],
    notification_content_type: "json",
    event_names: nameEvents({
      "payment.created": "transaction.created",
      "payment.succeeded": "transaction.completed",
      "payment.failed": "transaction.payment_failed",
      "payment.canceled": "transaction.canceled",
      "payment.refunded": "adjustment.created",
      "payment.partially_refunded": "adjustment.created",
      "checkout.completed": "transaction.paid",
    }),
    notification_body: paddleBody,
    notification_headers: [
      {
        name: "paddle-signature",
        template: "{{ paddle_signature(merchant.notification_secret) }}",
      },
    ],
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
  "razorpay",
  "paddle",
  "native",
];
