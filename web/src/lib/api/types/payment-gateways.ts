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
  name: string;
  value: string;
  is_secret: boolean;
};

/** A field sent back to the app on redirect, from a template. */
export type GatewayRedirectField = {
  name: string;
  template: string;
  /** PayPal sends `PayerID` only after a successful approval. */
  send_on: "always" | "success";
};

export type GatewayHeaderTemplate = { name: string; template: string };

/** An emulated provider (PY-12.2): its checkout, credentials, redirect and notification. */
export type PaymentGatewayDefinition = {
  /** The `provider` value in the API and in `/providers/<key>/...` paths. */
  key: string;
  name: string;
  /** `#rrggbb`, used on its checkout pages. */
  accent: string;
  is_enabled: boolean;
  /** The methods its checkout offers, in order (PY-12.3). */
  method_keys: string[];
  credentials: GatewayCredential[];
  /** The webhook endpoint its IPN or webhook deliveries go to. */
  notification_endpoint_id: Ulid | null;
  redirect_method: "GET" | "POST";
  redirect_fields: GatewayRedirectField[];
  notification_content_type: "json" | "form";
  /** The gateway's name for each native event; blank sends nothing. */
  event_names: Record<PaymentEventType, string>;
  notification_body: string;
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
  name: string;
  key: string;
  /** A gateway to copy (methods, redirect and notification), or null for blank. */
  start_from: string | null;
};

/** Body of POST /api/v1/payments/gateways/{gatewayKey}/preview (PY-12.4). */
export type PaymentGatewayPreviewRequest = {
  gateway: PaymentGatewayInput;
  /** The payment to render against; the newest one when left out. */
  payment_id?: Ulid;
  event_type: PaymentEventType;
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
  provider: string;
  amount_minor: number;
  /** Settings > Payments' default currency when left out. */
  currency?: string;
  customer_email?: string;
  line_items?: { name: string; quantity: number; unit_amount_minor: number }[];
};
