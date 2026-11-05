use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::payment_flow_views::PaymentFlowDefinition;
use super::payment_method_views::PaymentMethodDefinition;
use super::payment_views::{PaymentLineItem, PaymentRedirect};

/// Body of `POST /api/v1/payments/checkout`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentCheckoutCreateRequest {
    /// The gateway's key, e.g. `sslcommerz`.
    pub provider: String,
    /// In the currency's minor units.
    pub amount_minor: u64,
    /// An ISO code; the default currency from Settings > Payments when left out.
    pub currency: Option<String>,
    pub customer_email: Option<String>,
    /// One "Test order" line for the amount when left out.
    pub line_items: Option<Vec<PaymentLineItem>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CheckoutState {
    Open,
    RequiresThreeDs,
    Pending,
    Completed,
    Failed,
    Canceled,
    Expired,
}

/// What a test checkout page shows: the order, the gateway's methods and the flows they run.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct CheckoutSession {
    pub session_id: String,
    pub payment_id: String,
    pub provider: String,
    pub provider_name: String,
    pub merchant_name: String,
    pub amount_minor: u64,
    pub currency: String,
    pub line_items: Vec<PaymentLineItem>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub customer_email: Option<String>,
    pub accent: String,
    pub methods: Vec<PaymentMethodDefinition>,
    pub flows: Vec<PaymentFlowDefinition>,
    pub state: CheckoutState,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub failure_code: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<PaymentRedirect>")]
    pub redirect: Option<PaymentRedirect>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct CheckoutSessionReference {
    /// The session's ID, from the checkout URL.
    pub session_id: String,
}
