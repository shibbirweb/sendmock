use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::gateway_template_rendering::RedirectOutcome;
use super::payment_gateway_views::PaymentGatewayFields;
use crate::message_providers::TemplateReference;

/// `POST /api/v1/payments/gateways/{gatewayKey}/preview`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentGatewayPreviewRequest {
    /// The gateway's key; a saved gateway lends its stored secrets to masked ones sent.
    pub gateway_key: String,
    /// The gateway settings to render, saved or not.
    pub gateway: PaymentGatewayFields,
    /// The payment to render against; the gateway's newest, else the newest, when left out.
    pub payment_id: Option<String>,
    /// The native event to render the notification for, e.g. `payment.succeeded`.
    pub event_type: String,
    /// The redirect to render.
    pub redirect_outcome: RedirectOutcome,
}

/// One template problem, named by the part it is in, e.g. `Redirect field status`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct GatewayTemplateProblem {
    pub part: String,
    pub message: String,
    /// `error` or `warning`.
    pub severity: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct GatewayPreviewRedirect {
    /// `GET` or `POST`.
    pub method: String,
    pub url: String,
    pub fields: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct GatewayPreviewNotification {
    pub event_name: String,
    pub headers: BTreeMap<String, String>,
    pub body: String,
}

/// The gateway's redirect and notification rendered against a payment, secrets masked.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PaymentGatewayPreview {
    /// None when there is no payment yet to render against.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub payment_id: Option<String>,
    pub redirect: GatewayPreviewRedirect,
    /// None when the gateway sends nothing for the event.
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<GatewayPreviewNotification>"
    )]
    pub notification: Option<GatewayPreviewNotification>,
    pub problems: Vec<GatewayTemplateProblem>,
    /// What templates can read, for `{{` suggestions.
    pub reference: TemplateReference,
}
