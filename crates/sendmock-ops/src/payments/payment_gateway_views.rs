use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_payments::PaymentGatewayDraft;
use serde::{Deserialize, Serialize};

use crate::providers::ProviderCredential;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum RedirectMethod {
    #[serde(rename = "GET")]
    Get,
    #[serde(rename = "POST")]
    Post,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum NotificationContentType {
    Json,
    Form,
}

/// When a redirect field is sent: always, or only after a successful payment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RedirectFieldSendOn {
    Always,
    Success,
}

/// A field sent back to the app with the customer's redirect.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct GatewayRedirectField {
    pub name: String,
    /// A template, e.g. `{{ payment.reference }}`.
    pub template: String,
    pub send_on: RedirectFieldSendOn,
}

/// A header of the gateway's notification, from a template (signatures).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct GatewayHeaderTemplate {
    pub name: String,
    pub template: String,
}

/// What a gateway is made of, as stored, shipped and sent in a change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct PaymentGatewayFields {
    /// The `provider` value in the API and in `/providers/<key>/...` paths.
    pub key: String,
    pub name: String,
    pub accent: String,
    pub is_enabled: bool,
    /// The methods its checkout offers, in order.
    pub method_keys: Vec<String>,
    /// Merchant credentials; secrets are masked in answers.
    pub credentials: Vec<ProviderCredential>,
    /// The webhook endpoint its notifications are delivered to.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub notification_endpoint_id: Option<String>,
    pub redirect_method: RedirectMethod,
    pub redirect_fields: Vec<GatewayRedirectField>,
    pub notification_content_type: NotificationContentType,
    /// The gateway's name for each native event; empty sends nothing for it.
    pub event_names: BTreeMap<String, String>,
    pub notification_body: String,
    pub notification_headers: Vec<GatewayHeaderTemplate>,
}

impl PaymentGatewayFields {
    pub fn to_draft(&self) -> PaymentGatewayDraft {
        PaymentGatewayDraft {
            name: self.name.clone(),
            accent: self.accent.clone(),
            method_keys: self.method_keys.clone(),
            credential_names: self
                .credentials
                .iter()
                .map(|credential| credential.name.clone())
                .collect(),
            redirect_field_names: self
                .redirect_fields
                .iter()
                .map(|field| field.name.clone())
                .collect(),
            header_names: self
                .notification_headers
                .iter()
                .map(|header| header.name.clone())
                .collect(),
        }
    }
}

/// A gateway as stored and shipped.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentGatewayRecord {
    #[serde(flatten)]
    pub fields: PaymentGatewayFields,
    pub is_builtin: bool,
}

/// An emulated provider: its checkout methods, redirect and notification, secrets masked.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PaymentGatewayDefinition {
    #[serde(flatten)]
    pub fields: PaymentGatewayFields,
    pub is_builtin: bool,
    /// A built-in that differs from its shipped default.
    pub is_modified: bool,
    /// Payments made through it; a custom gateway with payments cannot be deleted.
    pub payment_count: u32,
}

/// Body of `POST /api/v1/payments/gateways`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentGatewayCreateRequest {
    pub name: String,
    pub key: String,
    /// A gateway to copy (its methods, redirect and notification); null starts from Native.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub start_from: Option<String>,
}

/// `PATCH /api/v1/payments/gateways/{gatewayKey}`: the whole gateway; its key stays.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentGatewayUpdate {
    /// The gateway's key, from `GET /api/v1/payments/gateways`.
    pub gateway_key: String,
    #[serde(flatten)]
    pub changes: PaymentGatewayFields,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentGatewayReference {
    /// The gateway's key, from `GET /api/v1/payments/gateways`.
    pub gateway_key: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct GatewayCredentialReference {
    /// The gateway's key, from `GET /api/v1/payments/gateways`.
    pub gateway_key: String,
    /// The credential's name in the gateway, e.g. `store_passwd`.
    pub credential_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct GatewayCredentialReveal {
    pub name: String,
    pub value: String,
}
