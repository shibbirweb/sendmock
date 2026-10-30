use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::Deserialize;

use super::endpoint_settings::{
    EndpointBodyField, EndpointBodyMode, EndpointRequestSettings, FieldsEncoding,
    NameValueTemplate, RenderMode, RetryPolicy, TemplateMode, WebhookHttpMethod,
};

/// Body of `POST /api/v1/webhooks/endpoints`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookEndpointInput {
    /// A name for the endpoint, shown in lists and deliveries.
    pub name: String,
    /// Where deliveries are sent; can use templates.
    pub url: String,
    /// Off endpoints receive no deliveries.
    pub is_enabled: bool,
    #[serde(flatten)]
    pub request_settings: EndpointRequestSettings,
}

/// `PATCH /api/v1/webhooks/endpoints/{endpointId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookEndpointUpdate {
    /// The webhook endpoint's ID, from `GET /api/v1/webhooks/endpoints`.
    pub endpoint_id: String,
    pub name: Option<String>,
    pub url: Option<String>,
    pub is_enabled: Option<bool>,
    pub method: Option<WebhookHttpMethod>,
    pub headers: Option<BTreeMap<String, String>>,
    pub extra_fields: Option<BTreeMap<String, String>>,
    pub template_id: Option<String>,
    pub template_mode: Option<TemplateMode>,
    pub timeout_ms: Option<u32>,
    pub retry_policy: Option<RetryPolicy>,
    pub query_params: Option<Vec<NameValueTemplate>>,
    pub body_mode: Option<EndpointBodyMode>,
    pub body_fields: Option<Vec<EndpointBodyField>>,
    pub fields_encoding: Option<FieldsEncoding>,
    pub raw_content_type: Option<String>,
    pub raw_body: Option<String>,
    pub render_mode: Option<RenderMode>,
}

impl WebhookEndpointUpdate {
    /// The request settings with the sent keys applied over the stored ones.
    pub fn apply_to_settings(&self, stored: EndpointRequestSettings) -> EndpointRequestSettings {
        let changes = self.clone();
        EndpointRequestSettings {
            method: changes.method.unwrap_or(stored.method),
            headers: changes.headers.unwrap_or(stored.headers),
            extra_fields: changes.extra_fields.unwrap_or(stored.extra_fields),
            template_id: changes.template_id.unwrap_or(stored.template_id),
            template_mode: changes.template_mode.unwrap_or(stored.template_mode),
            timeout_ms: changes.timeout_ms.unwrap_or(stored.timeout_ms),
            retry_policy: changes.retry_policy.unwrap_or(stored.retry_policy),
            query_params: changes.query_params.unwrap_or(stored.query_params),
            body_mode: changes.body_mode.unwrap_or(stored.body_mode),
            body_fields: changes.body_fields.unwrap_or(stored.body_fields),
            fields_encoding: changes.fields_encoding.unwrap_or(stored.fields_encoding),
            raw_content_type: changes.raw_content_type.unwrap_or(stored.raw_content_type),
            raw_body: changes.raw_body.unwrap_or(stored.raw_body),
            render_mode: changes.render_mode.unwrap_or(stored.render_mode),
        }
    }
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookEndpointReference {
    /// The webhook endpoint's ID, from `GET /api/v1/webhooks/endpoints`.
    pub endpoint_id: String,
}

/// Body of `POST /api/v1/webhooks/endpoints/{endpointId}/rotate-secret`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct RotateSecretRequest {
    /// The webhook endpoint's ID, from `GET /api/v1/webhooks/endpoints`.
    pub endpoint_id: String,
    /// How many hours the old secret keeps signing next to the new one (0 to 168).
    pub overlap_hours: u32,
}

/// `POST /api/v1/webhooks/endpoints/{endpointId}/save-as-template`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EndpointSaveAsTemplateRequest {
    /// The webhook endpoint's ID, from `GET /api/v1/webhooks/endpoints`.
    pub endpoint_id: String,
    /// The name of the new custom template.
    pub name: String,
}
