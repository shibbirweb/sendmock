use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// How often a subscription renews.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionInterval {
    Day,
    Week,
    Month,
    Year,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Trialing,
    Active,
    PastDue,
    Canceled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct SubscriptionTimelineEvent {
    /// `created`, `renewed`, `payment_failed`, `cancel_scheduled` or `canceled`.
    pub kind: String,
    pub description: String,
    pub created_at: String,
}

/// A subscription and its own clock, renewed when advanced (PY-07.4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentSubscription {
    pub id: String,
    /// The gateway's key.
    pub provider: String,
    pub provider_name: String,
    pub customer_email: String,
    pub plan_name: String,
    pub amount_minor: u64,
    pub currency: String,
    pub interval: SubscriptionInterval,
    pub status: SubscriptionStatus,
    /// The last four digits of the test card that pays each renewal.
    pub card_last4: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub trial_end: Option<String>,
    pub current_period_start: String,
    pub current_period_end: String,
    /// True when it ends at the next advance instead of renewing.
    pub cancel_at_period_end: bool,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub canceled_at: Option<String>,
    pub renewal_count: u32,
    /// The payments charged for it, oldest first.
    pub payment_ids: Vec<String>,
    pub created_at: String,
    pub timeline: Vec<SubscriptionTimelineEvent>,
}

/// `POST /api/v1/payments/subscriptions`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentSubscriptionCreateRequest {
    /// The gateway's key.
    pub provider: String,
    pub customer_email: String,
    pub plan_name: String,
    /// The amount of each renewal in minor units.
    pub amount_minor: u64,
    /// ISO 4217 code; Settings > Payments' default currency when left out.
    pub currency: Option<String>,
    pub interval: SubscriptionInterval,
    /// Days before the first charge; none charges at once.
    pub trial_days: Option<u32>,
    /// The test card that pays each renewal; `4242424242424242` when left out.
    pub card_number: Option<String>,
}

/// One subscription, by the path's id.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SubscriptionPathInput {
    /// The subscription's ID, from `GET /api/v1/payments/subscriptions`.
    pub subscription_id: String,
}

/// `POST /api/v1/payments/subscriptions/{subscriptionId}/cancel`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentSubscriptionCancelRequest {
    /// The subscription's ID, from `GET /api/v1/payments/subscriptions`.
    pub subscription_id: String,
    /// End at the next advance instead of now.
    pub at_period_end: Option<bool>,
}
