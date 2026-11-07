use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    RequiresPayment,
    RequiresAction,
    Authorized,
    Succeeded,
    Failed,
    Canceled,
    Refunded,
    PartiallyRefunded,
    Disputed,
}

impl PaymentStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RequiresPayment => "requires_payment",
            Self::RequiresAction => "requires_action",
            Self::Authorized => "authorized",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Canceled => "canceled",
            Self::Refunded => "refunded",
            Self::PartiallyRefunded => "partially_refunded",
            Self::Disputed => "disputed",
        }
    }
}

/// `Manual` holds the money as `authorized` until it is captured or voided.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum PaymentCaptureMethod {
    #[default]
    Automatic,
    Manual,
}

/// What the customer paid with, reduced to what is safe to keep: never a full card number or
/// a CVC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PaymentInstrument {
    Card {
        brand: String,
        last4: String,
        exp_month: u32,
        exp_year: u32,
    },
    Wallet {
        wallet_name: String,
        masked_number: String,
    },
    Bank {
        bank_name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentLineItem {
    pub name: String,
    pub quantity: u32,
    pub unit_amount_minor: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentTimelineEvent {
    /// `created`, `three_ds`, `authorized`, `captured`, `succeeded`, `failed`, `canceled`,
    /// `expired`, `refunded`, `dispute_opened`, `dispute_closed`, `redirected`, `delayed` or
    /// `notification_sent`.
    pub kind: String,
    pub description: String,
    pub created_at: String,
}

/// Where the customer was sent back to the app, and with which fields.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentRedirect {
    /// `success`, `fail` or `cancel`.
    pub outcome: String,
    pub url: String,
    /// `GET` or `POST`.
    pub method: String,
    pub fields: BTreeMap<String, String>,
    pub redirected_at: String,
}

/// An IPN or webhook sent for the payment, as a webhook delivery.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentNotification {
    pub delivery_id: String,
    pub event_type: String,
    pub provider_event_name: String,
    pub status: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<u16>")]
    pub status_code: Option<u16>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentDispute {
    /// `needs_response`, `under_review`, `won` or `lost`.
    pub status: String,
    pub reason: String,
    /// What the merchant answered with; none until the dispute is answered.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub evidence: Option<String>,
}

/// A payment as the list shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentSummary {
    pub id: String,
    /// The gateway's key.
    pub provider: String,
    pub provider_name: String,
    /// The gateway's main id for it, e.g. a Stripe Checkout Session id.
    pub provider_reference: String,
    /// In the currency's minor units (cents); JPY has none.
    pub amount_minor: u64,
    pub currency: String,
    pub status: PaymentStatus,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub customer_email: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub customer_name: Option<String>,
    /// A decline reason, or `expired`.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub failure_code: Option<String>,
    pub refunded_minor: u64,
    pub created_at: String,
}

/// One payment with everything that happened to it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentDetail {
    #[serde(flatten)]
    pub summary: PaymentSummary,
    pub provider_ids: BTreeMap<String, String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub customer_phone: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<PaymentInstrument>")]
    pub method: Option<PaymentInstrument>,
    pub line_items: Vec<PaymentLineItem>,
    pub metadata: BTreeMap<String, String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub success_url: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub fail_url: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub cancel_url: Option<String>,
    /// The test checkout page; none once the checkout is closed.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub checkout_url: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<PaymentRedirect>")]
    pub redirect: Option<PaymentRedirect>,
    pub captured_minor: u64,
    pub capture_method: PaymentCaptureMethod,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub method_key: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<PaymentDispute>")]
    pub dispute: Option<PaymentDispute>,
    pub timeline: Vec<PaymentTimelineEvent>,
    pub notifications: Vec<PaymentNotification>,
}

/// `GET /api/v1/payments` filters.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct PaymentListQuery {
    /// One status, or several separated by commas, e.g. `succeeded,refunded`.
    pub status: Option<String>,
    /// A gateway's key.
    pub provider: Option<String>,
    /// An ISO currency code, e.g. `BDT`.
    pub currency: Option<String>,
    /// The `next_cursor` of the previous page.
    pub cursor: Option<String>,
    /// At most this many (default 50).
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentReference {
    /// The payment's ID, from `GET /api/v1/payments`.
    pub payment_id: String,
}
