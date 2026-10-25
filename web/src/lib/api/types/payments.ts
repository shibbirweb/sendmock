import type { IsoTimestamp, PageRequest, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
import type { PaymentFlowDefinition } from "@/lib/api/types/payment-flows";
import type { DeliveryStatus } from "@/lib/api/types/webhooks";

export type PaymentProvider =
  "stripe" | "paypal" | "sslcommerz" | "bkash" | "native";

export type PaymentStatus =
  | "requires_payment"
  | "requires_action"
  | "authorized"
  | "succeeded"
  | "failed"
  | "canceled"
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type DeclineReason =
  | "insufficient_funds"
  | "expired_card"
  | "incorrect_cvc"
  | "generic_decline"
  | "fraudulent"
  | "authentication_failed";

/** Never a full card number or CVC (PY-01.2). */
export type PaymentMethod =
  | {
      kind: "card";
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    }
  | { kind: "wallet"; wallet_name: string; masked_number: string }
  | { kind: "bank"; bank_name: string };

export type PaymentLineItem = {
  name: string;
  quantity: number;
  unit_amount_minor: number;
};

export type PaymentTimelineKind =
  | "created"
  | "three_ds"
  | "authorized"
  | "captured"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired"
  | "refunded"
  | "dispute_opened"
  | "dispute_closed"
  | "redirected"
  | "delayed"
  | "notification_sent";

export type PaymentTimelineEvent = {
  kind: PaymentTimelineKind;
  description: string;
  created_at: IsoTimestamp;
};

export type PaymentRedirect = {
  outcome: "success" | "fail" | "cancel";
  url: string;
  method: "GET" | "POST";
  /** The parameters sent to the app, as the provider sends them. */
  fields: Record<string, string>;
  redirected_at: IsoTimestamp;
};

/** One IPN or webhook sent for the payment, in the webhook delivery log (PY-08.3). */
export type PaymentNotification = {
  delivery_id: Ulid;
  event_type: AppEventType;
  /** The provider's own name, e.g. `checkout.session.completed` or `VALID`. */
  provider_event_name: string;
  status: DeliveryStatus;
  status_code: number | null;
  created_at: IsoTimestamp;
};

export type PaymentDispute = {
  status: "needs_response" | "won" | "lost";
  reason: string;
};

export type CardTestOutcome =
  "succeed" | "decline" | "three_ds" | "succeed_then_dispute";

export type TestCardValue = {
  number: string;
  outcome: CardTestOutcome;
  /** Set when the outcome is a decline. */
  decline_reason: DeclineReason | null;
};

/** `wrong_pin` needs a PIN step in the flow. */
export type NumberTestOutcome = "succeed" | "decline" | "wrong_pin";

/** A test account number or voucher code with its outcome. */
export type TestNumberValue = {
  number: string;
  outcome: NumberTestOutcome;
  decline_reason: DeclineReason | null;
};

/** What a customer pays with on a checkout page, and its test values (PY-12.1). */
export type PaymentMethodDefinition = {
  key: string;
  name: string;
  /** The key of the flow its checkout runs (PY-12.6). */
  flow: string;
  /** `#rrggbb`, used on checkout pages. */
  accent: string;
  is_enabled: boolean;
  is_builtin: boolean;
  /** A built-in that differs from its shipped default. */
  is_modified: boolean;
  /** Read by a card form step. */
  test_cards: TestCardValue[];
  /** Read by an account number or voucher code step. */
  test_numbers: TestNumberValue[];
  /** Read by an OTP step. */
  otp: string;
  /** Read by a PIN step. */
  pin: string;
  /** The outcome when the flow has no deciding step. */
  default_outcome: "succeed" | "decline";
  /** Read by a signed-in account step. */
  test_account: string;
  /** Gateways whose checkout offers this method. */
  gateway_keys: string[];
  /** Payments made with it; a custom method in use cannot be deleted. */
  payment_count: number;
};

/** Body of POST and PATCH /api/v1/payments/methods; key and flow are fixed after creation. */
export type PaymentMethodInput = Pick<
  PaymentMethodDefinition,
  | "key"
  | "name"
  | "flow"
  | "accent"
  | "is_enabled"
  | "test_cards"
  | "test_numbers"
  | "otp"
  | "pin"
  | "default_outcome"
  | "test_account"
>;

export type PaymentSummary = {
  id: Ulid;
  provider: PaymentProvider;
  /** The provider's main id: session, intent, order or transaction. */
  provider_reference: string;
  amount_minor: number;
  /** ISO 4217, e.g. USD, BDT, JPY. */
  currency: string;
  status: PaymentStatus;
  customer_email: string | null;
  customer_name: string | null;
  failure_code: DeclineReason | "expired" | null;
  refunded_minor: number;
  created_at: IsoTimestamp;
};

/** GET /api/v1/payments/{paymentId} (PY-09.2). */
export type PaymentDetail = PaymentSummary & {
  provider_ids: Record<string, string>;
  customer_phone: string | null;
  method: PaymentMethod | null;
  line_items: PaymentLineItem[];
  metadata: Record<string, string>;
  success_url: string | null;
  fail_url: string | null;
  cancel_url: string | null;
  /** Hosted checkout URL while the session can still be paid. */
  checkout_url: string | null;
  redirect: PaymentRedirect | null;
  captured_minor: number;
  /** The payment method used, once paid. */
  method_key: string | null;
  dispute: PaymentDispute | null;
  timeline: PaymentTimelineEvent[];
  notifications: PaymentNotification[];
};

/** Query of GET /api/v1/payments; `status` takes a comma-separated list. */
export type PaymentListFilters = PageRequest & {
  status?: string;
  provider?: PaymentProvider;
  currency?: string;
};

export type PaymentSimulateAction =
  | "succeed"
  | "decline"
  | "refund"
  | "dispute"
  | "resolve_dispute"
  | "expire"
  | "capture"
  | "void";

/** Body of POST /api/v1/payments/{paymentId}/simulate (PY-09.3). */
export type PaymentSimulateRequest = {
  action: PaymentSimulateAction;
  decline_reason?: DeclineReason;
  refund_amount_minor?: number;
  dispute_outcome?: "won" | "lost";
};

/** Where a test checkout stands, from the customer's side (PY-03). */
export type CheckoutState =
  | "open"
  | "requires_three_ds"
  | "pending"
  | "completed"
  | "failed"
  | "canceled"
  | "expired";

/** GET /api/v1/checkout-sessions/{sessionId}: what the test checkout page shows. */
export type CheckoutSession = {
  session_id: Ulid;
  payment_id: Ulid;
  provider: PaymentProvider;
  merchant_name: string;
  amount_minor: number;
  currency: string;
  line_items: PaymentLineItem[];
  customer_email: string | null;
  /** The gateway's accent, `#rrggbb`. */
  accent: string;
  /** The enabled methods the gateway offers, in order (PY-12.3). */
  methods: PaymentMethodDefinition[];
  /** The flows those methods run (PY-12.6). */
  flows: PaymentFlowDefinition[];
  state: CheckoutState;
  failure_code: PaymentSummary["failure_code"];
  /** Where the browser goes once the checkout is finished. */
  redirect: PaymentRedirect | null;
};

export type CheckoutAction =
  | "pay"
  | "decline"
  | "cancel"
  | "delay"
  | "require_three_ds"
  | "three_ds_approve"
  | "three_ds_fail";

/** A card typed on the checkout page; only test cards are accepted, and none is stored (PY-01.1). */
export type CheckoutCard = {
  number: string;
  exp_month: number;
  exp_year: number;
  cvc: string;
  holder_name: string;
};

/** What the customer typed in a flow's steps; only the flow's own steps are read. */
export type CheckoutStepEntries = {
  /** An account number or voucher code. */
  number?: string;
  otp?: string;
  pin?: string;
};

/** Body of POST /api/v1/checkout-sessions/{sessionId}/complete. */
export type CheckoutCompleteRequest = {
  action: CheckoutAction;
  /** The method the customer paid with. */
  method_key?: string;
  card?: CheckoutCard;
  entries?: CheckoutStepEntries;
  decline_reason?: DeclineReason;
};
