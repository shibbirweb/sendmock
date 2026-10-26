import type { Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
import type { TemplateReference } from "@/lib/api/types/webhooks";

/** The gateways SendMock ships; custom gateways have their own keys. */
export type BuiltinPaymentProvider =
  "stripe" | "paypal" | "sslcommerz" | "bkash" | "native";

/** A native event a payment notification can carry. */
export type PaymentEventType = Extract<
  AppEventType,
  `payment.${string}` | `checkout.${string}`
>;

/** A merchant credential; a secret's value comes back masked (`••••` and the last 4). */
export type GatewayCredential = {
  /**
   * The credential's name, readable in templates as `merchant.<name>`.
   * @example "webhook_secret"
   */
  name: string;
  /**
   * The value; a secret comes back masked.
   * @example "whsec_test_123"
   */
  value: string;
  /**
   * Masks the value in the UI, API answers and logs.
   * @example true
   */
  is_secret: boolean;
};

/** A field sent back to the app on redirect, from a template. */
export type GatewayRedirectField = {
  /**
   * The parameter name sent to your app.
   * @example "session_id"
   */
  name: string;
  /**
   * The value, a template over the payment.
   * @example "{{ payment.reference }}"
   */
  template: string;
  /**
   * PayPal sends `PayerID` only after a successful approval.
   * @example "always"
   */
  send_on: "always" | "success";
};

export type GatewayHeaderTemplate = {
  /**
   * The header name.
   * @example "stripe-signature"
   */
  name: string;
  /**
   * The value, a template; signature helpers sign the body.
   * @example "{{ stripe_signature(merchant.webhook_secret) }}"
   */
  template: string;
};

/** An emulated provider (PY-12.2): its checkout, credentials, redirect and notification. */
export type PaymentGatewayDefinition = {
  /**
   * The `provider` value in the API and in `/providers/<key>/...` paths.
   * @example "upay"
   */
  key: string;
  /**
   * The gateway's name, shown on checkout pages.
   * @example "Upay"
   */
  name: string;
  /**
   * `#rrggbb`, used on its checkout pages.
   * @example "#e2136e"
   */
  accent: string;
  /**
   * Off gateways reject new checkouts.
   * @example true
   */
  is_enabled: boolean;
  /**
   * The methods its checkout offers, in order (PY-12.3).
   * @example ["upay_wallet", "card"]
   */
  method_keys: string[];
  /**
   * The merchant credentials your app is configured with.
   */
  credentials: GatewayCredential[];
  /**
   * The webhook endpoint its IPN or webhook deliveries go to.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  notification_endpoint_id: Ulid | null;
  /**
   * How the browser returns to your app: `GET` (query string) or `POST` (form).
   * @example "POST"
   */
  redirect_method: "GET" | "POST";
  /**
   * The parameters sent to your app on redirect.
   */
  redirect_fields: GatewayRedirectField[];
  /**
   * How the IPN or webhook body is sent: `json` or `form`.
   * @example "json"
   */
  notification_content_type: "json" | "form";
  /**
   * The gateway's name for each native event; blank sends nothing.
   * @example {"payment.succeeded": "PAYMENT_SUCCESS", "payment.failed": "PAYMENT_FAILED", "payment.refunded": "", "checkout.completed": "", "checkout.expired": ""}
   */
  event_names: Record<PaymentEventType, string>;
  /**
   * The notification body, a template over the payment and the event.
   * @example "{\"status\": \"{{ event.name }}\", \"txn_id\": \"{{ payment.reference }}\"}"
   */
  notification_body: string;
  /**
   * Headers sent with each notification.
   */
  notification_headers: GatewayHeaderTemplate[];
  is_builtin: boolean;
  /** A built-in that differs from its shipped default. */
  is_modified: boolean;
  /** Payments made through it; a custom gateway in use cannot be deleted. */
  payment_count: number;
};

/** Body of PATCH /api/v1/payments/gateways/{gatewayKey}; the key is fixed. */
export type PaymentGatewayInput = Omit<
  PaymentGatewayDefinition,
  "is_builtin" | "is_modified" | "payment_count"
>;

/** Body of POST /api/v1/payments/gateways. */
export type PaymentGatewayCreateRequest = {
  /**
   * The new gateway's name.
   * @example "Upay"
   */
  name: string;
  /**
   * Its key in the API and in `/providers/<key>/...` paths; lowercase, fixed after creation.
   * @example "upay"
   */
  key: string;
  /**
   * A gateway to copy (methods, redirect and notification), or null for blank.
   * @example "bkash"
   */
  start_from: string | null;
};

/** Body of POST /api/v1/payments/gateways/{gatewayKey}/preview (PY-12.4). */
export type PaymentGatewayPreviewRequest = {
  /**
   * The gateway settings to render, saved or not.
   */
  gateway: PaymentGatewayInput;
  /**
   * The payment to render against; the newest one when left out.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  payment_id?: Ulid;
  /**
   * The native event to render the notification for.
   * @example "payment.succeeded"
   */
  event_type: PaymentEventType;
  /**
   * The redirect to render: `success`, `fail` or `cancel`.
   * @example "success"
   */
  redirect_outcome: "success" | "fail" | "cancel";
};

/** One template problem, named by the part it is in, e.g. `Redirect field status`. */
export type GatewayTemplateProblem = {
  part: string;
  message: string;
  severity: "error" | "warning";
};

export type PaymentGatewayPreview = {
  payment_id: Ulid | null;
  redirect: {
    method: "GET" | "POST";
    url: string;
    fields: Record<string, string>;
  };
  /** Null when the gateway sends nothing for the event. */
  notification: {
    event_name: string;
    headers: Record<string, string>;
    body: string;
  } | null;
  problems: GatewayTemplateProblem[];
  /** What templates can read, for `{{` suggestions. */
  reference: TemplateReference;
};

/** GET /api/v1/payments/gateways/{gatewayKey}/credentials/{credentialName}. */
export type GatewayCredentialReveal = { name: string; value: string };

/** Body of POST /api/v1/payments/checkout: a hosted test checkout. */
export type PaymentCheckoutCreateRequest = {
  /**
   * The gateway key, e.g. `stripe` or `sslcommerz`.
   * @example "stripe"
   */
  provider: string;
  /**
   * The amount in the currency's minor unit (cents, paisa); 1999 is 19.99.
   * @example 1999
   */
  amount_minor: number;
  /**
   * Settings > Payments' default currency when left out.
   * @example "USD"
   */
  currency?: string;
  /**
   * The customer's email, shown on the checkout page.
   * @example "user@example.test"
   */
  customer_email?: string;
  /**
   * What is being bought, shown on the checkout page.
   * @example [{"name": "T-shirt", "quantity": 1, "unit_amount_minor": 1999}]
   */
  line_items?: { name: string; quantity: number; unit_amount_minor: number }[];
};
