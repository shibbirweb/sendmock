use schemars::JsonSchema;
use serde::Deserialize;

use super::metrics_view::WebhookMetricsRange;

/// Query of `GET /api/v1/webhooks/metrics`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookMetricsInput {
    /// 24h or 7d.
    pub range: WebhookMetricsRange,
    /// Only this endpoint.
    pub endpoint_id: Option<String>,
}
