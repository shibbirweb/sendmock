import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";

/** How often a subscription renews. */
export type SubscriptionInterval = "day" | "week" | "month" | "year";

export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "canceled";

export type SubscriptionTimelineKind =
  "created" | "renewed" | "payment_failed" | "cancel_scheduled" | "canceled";

export type SubscriptionTimelineEvent = {
  kind: SubscriptionTimelineKind;
  description: string;
  created_at: IsoTimestamp;
};

/** A subscription and its own clock, renewed when advanced (PY-07.4). */
export type PaymentSubscription = {
  id: Ulid;
  /** The gateway's key. */
  provider: string;
  provider_name: string;
  customer_email: string;
  plan_name: string;
  amount_minor: number;
  currency: string;
  interval: SubscriptionInterval;
  status: SubscriptionStatus;
  /** The last four digits of the test card that pays each renewal. */
  card_last4: string;
  trial_end: IsoTimestamp | null;
  current_period_start: IsoTimestamp;
  current_period_end: IsoTimestamp;
  /** True when it ends at the next advance instead of renewing. */
  cancel_at_period_end: boolean;
  canceled_at: IsoTimestamp | null;
  renewal_count: number;
  /** The payments charged for it, oldest first. */
  payment_ids: Ulid[];
  created_at: IsoTimestamp;
  timeline: SubscriptionTimelineEvent[];
};

/** Body of POST /api/v1/payments/subscriptions. */
export type PaymentSubscriptionCreateRequest = {
  /**
   * The gateway's key.
   * @example "stripe"
   */
  provider: string;
  /** @example "sam@example.test" */
  customer_email: string;
  /** @example "Pro monthly" */
  plan_name: string;
  /**
   * The amount of each renewal in minor units.
   * @example 1500
   */
  amount_minor: number;
  /**
   * ISO 4217 code; Settings > Payments' default currency when left out.
   * @example "USD"
   */
  currency?: string;
  /** @example "month" */
  interval: SubscriptionInterval;
  /**
   * Days before the first charge; none charges at once.
   * @example 7
   */
  trial_days?: number;
  /**
   * The test card that pays each renewal; `4242424242424242` when left out.
   * @example "4000000000009995"
   */
  card_number?: string;
};

/** Body of POST /api/v1/payments/subscriptions/{subscriptionId}/cancel. */
export type PaymentSubscriptionCancelRequest = {
  /**
   * End at the next advance instead of now.
   * @example false
   */
  at_period_end?: boolean;
};
