import type { IsoTimestamp, PageRequest, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
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
  | "fraudulent";

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
