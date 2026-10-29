use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::WebhookEndpointRecord;
use sendmock_webhooks::WebhookSecret;
use serde::Serialize;

use super::endpoint_settings::EndpointRequestSettings;
use crate::OperationError;

/// Hours in the success sparkline (WH-01.7).
const SUCCESS_HISTORY_HOURS: usize = 24;

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct WebhookEndpoint {
    pub id: String,
    pub name: String,
    pub url: String,
    pub is_enabled: bool,
    #[serde(flatten)]
    pub request_settings: EndpointRequestSettings,
    /// Always masked, e.g. `whsec_••••3f9a`.
    pub masked_secret: String,
    /// Until when the secret before the last rotation still signs; null when none.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub previous_secret_expires_at: Option<String>,
    /// Success rate over the last 24 hours; null without finished deliveries.
    #[schemars(required, schema_with = "crate::nullable_schema::<f64>")]
    pub success_rate: Option<f64>,
    pub delivery_count_24h: u32,
    /// 24 hourly success rates, oldest first; null for hours without deliveries.
    pub success_history: Vec<Option<f64>>,
    pub created_by: String,
    pub created_at: String,
}

/// Reads the stored settings back; a document that no longer parses is a storage fault.
pub fn read_request_settings(
    stored_endpoint: &WebhookEndpointRecord,
) -> Result<EndpointRequestSettings, OperationError> {
    serde_json::from_str(&stored_endpoint.request_settings_json).map_err(|parse_error| {
        OperationError::Internal(format!(
            "the stored settings of endpoint {} do not parse: {parse_error}",
            stored_endpoint.endpoint_id
        ))
    })
}

pub fn write_request_settings(
    request_settings: &EndpointRequestSettings,
) -> Result<String, OperationError> {
    serde_json::to_string(request_settings)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// The endpoint as the API shows it: the secret masked and the previous one's expiry only
/// while it still signs. Delivery numbers stay empty until deliveries are recorded.
pub fn build_endpoint_view(
    stored_endpoint: WebhookEndpointRecord,
    now_unix_ms: i64,
) -> Result<WebhookEndpoint, OperationError> {
    let request_settings = read_request_settings(&stored_endpoint)?;
    let masked_secret = WebhookSecret::parse(&stored_endpoint.signing_secret)
        .map_err(|secret_error| OperationError::Internal(secret_error.to_string()))?
        .masked();
    let previous_secret_expires_at = stored_endpoint
        .previous_secret_expires_at_unix_ms
        .filter(|expires_at_unix_ms| *expires_at_unix_ms > now_unix_ms)
        .map(format_rfc3339);
    Ok(WebhookEndpoint {
        id: stored_endpoint.endpoint_id,
        name: stored_endpoint.name,
        url: stored_endpoint.url,
        is_enabled: stored_endpoint.is_enabled,
        request_settings,
        masked_secret,
        previous_secret_expires_at,
        success_rate: None,
        delivery_count_24h: 0,
        success_history: vec![None; SUCCESS_HISTORY_HOURS],
        created_by: stored_endpoint.created_by,
        created_at: format_rfc3339(stored_endpoint.created_at_unix_ms),
    })
}
