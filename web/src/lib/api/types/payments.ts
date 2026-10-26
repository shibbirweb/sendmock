import type { IsoTimestamp, PageRequest, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
import type { PaymentFlowDefinition } from "@/lib/api/types/payment-flows";
import type { DeliveryStatus } from "@/lib/api/types/webhooks";

/** A gateway key: a built-in one (stripe, paypal, sslcommerz, bkash, native) or a custom one. */
export type PaymentProvider = string;

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
  /**
   * The card number to type on the checkout page.
   * @example "4242424242424242"
   */
  number: string;
  /**
   * `succeed`, `decline`, `three_ds` (asks for 3-D Secure first) or `succeed_then_dispute`.
   * @example "succeed"
   */
  outcome: CardTestOutcome;
  /**
   * Set when the outcome is a decline.
   * @example "insufficient_funds"
   */
  decline_reason: DeclineReason | null;
};

/** `wrong_pin` needs a PIN step in the flow. */
export type NumberTestOutcome = "succeed" | "decline" | "wrong_pin";

/** A test account number or voucher code with its outcome. */
export type TestNumberValue = {
  /**
   * The account number or voucher code to type.
   * @example "01770000001"
   */
  number: string;
  /**
   * `succeed`, `decline` or `wrong_pin` (needs a PIN step).
   * @example "succeed"
   */
  outcome: NumberTestOutcome;
  /**
   * Set when the outcome is a decline.
   * @example "insufficient_funds"
   */
  decline_reason: DeclineReason | null;
};

/** What a customer pays with on a checkout page, and its test values (PY-12.1). */
export type PaymentMethodDefinition = {
  /**
   * The method's key; fixed after creation.
   * @example "upay_wallet"
   */
  key: string;
  /**
   * The method's name on checkout pages.
   * @example "Upay wallet"
   */
  name: string;
  /**
   * The key of the flow its checkout runs (PY-12.6).
   * @example "wallet"
   */
  flow: string;
  /**
   * `#rrggbb`, used on checkout pages.
   * @example "#e2136e"
   */
  accent: string;
  /**
   * Off methods are hidden on checkout pages.
   * @example true
   */
  is_enabled: boolean;
  is_builtin: boolean;
  /** A built-in that differs from its shipped default. */
  is_modified: boolean;
  /**
   * Read by a card form step.
   */
  test_cards: TestCardValue[];
  /**
   * Read by an account number or voucher code step.
   */
  test_numbers: TestNumberValue[];
  /**
   * Read by an OTP step.
   * @example "123456"
   */
  otp: string;
  /**
   * Read by a PIN step.
   * @example "12121"
   */
  pin: string;
  /**
   * The outcome when the flow has no deciding step.
   * @example "succeed"
   */
  default_outcome: "succeed" | "decline";
  /**
   * Read by a signed-in account step.
   * @example "sb-buyer@personal.example.com"
   */
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
  /** The gateway's name, e.g. "SSLCommerz". */
  provider_name: string;
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
  /**
   * What happens to the payment: `succeed`, `decline`, `refund`, `dispute`, `resolve_dispute`, `expire`, `capture` or `void`.
   * @example "refund"
   */
  action: PaymentSimulateAction;
  /**
   * For `decline`: why the bank declined.
   * @example "insufficient_funds"
   */
  decline_reason?: DeclineReason;
  /**
   * For `refund`: the amount in minor units; the full amount when left out.
   * @example 500
   */
  refund_amount_minor?: number;
  /**
   * For `resolve_dispute`: `won` or `lost`.
   * @example "won"
   */
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
  provider_name: string;
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
  /**
   * A test card number of the method.
   * @example "4242424242424242"
   */
  number: string;
  /**
   * Expiry month, 1 to 12.
   * @example 12
   */
  exp_month: number;
  /**
   * Expiry year, four digits.
   * @example 2030
   */
  exp_year: number;
  /**
   * Any three or four digits.
   * @example "123"
   */
  cvc: string;
  /**
   * The name on the card.
   * @example "Sam Tester"
   */
  holder_name: string;
};

/** What the customer typed in a flow's steps; only the flow's own steps are read. */
export type CheckoutStepEntries = {
  /**
   * An account number or voucher code.
   * @example "01770000001"
   */
  number?: string;
  /**
   * The one-time code typed in an OTP step.
   * @example "123456"
   */
  otp?: string;
  /**
   * The PIN typed in a PIN step.
   * @example "12121"
   */
  pin?: string;
};

/** Body of POST /api/v1/checkout-sessions/{sessionId}/complete. */
export type CheckoutCompleteRequest = {
  /**
   * What the customer does: `pay`, `decline`, `cancel`, `delay` (pending), `require_three_ds`, `three_ds_approve` or `three_ds_fail`.
   * @example "pay"
   */
  action: CheckoutAction;
  /**
   * The method the customer paid with.
   * @example "card"
   */
  method_key?: string;
  /**
   * The card typed, for card methods.
   */
  card?: CheckoutCard;
  /**
   * What was typed in the flow's other steps.
   */
  entries?: CheckoutStepEntries;
  /**
   * For `decline`: why the bank declined.
   * @example "insufficient_funds"
   */
  decline_reason?: DeclineReason;
};
