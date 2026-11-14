use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_webhooks::{DeliverySample, EndpointHealth, OutcomeBucket};
use serde::{Deserialize, Serialize};

/// 24 hours by the hour or 7 days by the day.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum WebhookMetricsRange {
    #[serde(rename = "24h")]
    LastDay,
    #[serde(rename = "7d")]
    LastWeek,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct FailureCodeCount {
    /// HTTP status as text (`"500"`), `"render_failed"` or `"no_response"`.
    pub failure_code: String,
    pub failure_count: u64,
}

/// Webhook health of one endpoint (WH-11.1).
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct EndpointMetrics {
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub delivery_count: u64,
    /// 0 to 1; null when nothing finished yet.
    #[schemars(required, schema_with = "crate::nullable_schema::<f64>")]
    pub success_rate: Option<f64>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub p50_latency_ms: Option<u32>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub p95_latency_ms: Option<u32>,
    pub retry_count: u64,
    pub top_failure_codes: Vec<FailureCodeCount>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct RecentFailedDelivery {
    pub delivery_id: String,
    pub endpoint_name: String,
    pub event_type: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<u16>")]
    pub status_code: Option<u16>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_message: Option<String>,
    pub created_at: String,
}

/// One hour (24h) or day (7d) of deliveries by outcome (WH-11.3).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct DeliveryOutcomeBucket {
    pub bucket_start: String,
    pub succeeded_count: u64,
    /// Pending, in flight, or failed with a retry still to come.
    pub retrying_count: u64,
    /// Exhausted, render failed, cancelled, or failed with no retry left.
    pub failed_count: u64,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub p50_latency_ms: Option<u32>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub p95_latency_ms: Option<u32>,
}

/// Delivery health over a range (WH-11.1, WH-11.3).
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct WebhookMetrics {
    pub range: WebhookMetricsRange,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub endpoint_id: Option<String>,
    pub delivery_count: u64,
    #[schemars(required, schema_with = "crate::nullable_schema::<f64>")]
    pub success_rate: Option<f64>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub p50_latency_ms: Option<u32>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub p95_latency_ms: Option<u32>,
    pub retry_count: u64,
    pub render_failed_count: u64,
    /// Oldest first, ending with the current hour or day.
    pub buckets: Vec<DeliveryOutcomeBucket>,
    pub endpoint_metrics: Vec<EndpointMetrics>,
    pub top_failure_codes: Vec<FailureCodeCount>,
    pub recent_failures: Vec<RecentFailedDelivery>,
}

impl From<sendmock_webhooks::FailureCodeCount> for FailureCodeCount {
    fn from(code_count: sendmock_webhooks::FailureCodeCount) -> Self {
        Self {
            failure_code: code_count.failure_code,
            failure_count: code_count.failure_count,
        }
    }
}

impl From<EndpointHealth> for EndpointMetrics {
    fn from(endpoint_health: EndpointHealth) -> Self {
        Self {
            endpoint_id: endpoint_health.endpoint.endpoint_id,
            endpoint_name: endpoint_health.endpoint.endpoint_name,
            delivery_count: endpoint_health.summary.delivery_count,
            success_rate: endpoint_health.summary.success_rate,
            p50_latency_ms: endpoint_health.summary.p50_latency_ms,
            p95_latency_ms: endpoint_health.summary.p95_latency_ms,
            retry_count: endpoint_health.summary.retry_count,
            top_failure_codes: endpoint_health
                .top_failure_codes
                .into_iter()
                .map(FailureCodeCount::from)
                .collect(),
        }
    }
}

impl From<DeliverySample> for RecentFailedDelivery {
    fn from(failed_sample: DeliverySample) -> Self {
        Self {
            delivery_id: failed_sample.delivery_id,
            endpoint_name: failed_sample.endpoint_name,
            event_type: failed_sample.event_type,
            status_code: failed_sample.response_status_code,
            error_message: failed_sample.error_message,
            created_at: format_rfc3339(failed_sample.created_at_unix_ms),
        }
    }
}

impl From<OutcomeBucket> for DeliveryOutcomeBucket {
    fn from(outcome_bucket: OutcomeBucket) -> Self {
        Self {
            bucket_start: format_rfc3339(outcome_bucket.bucket_start_unix_ms),
            succeeded_count: outcome_bucket.succeeded_count,
            retrying_count: outcome_bucket.retrying_count,
            failed_count: outcome_bucket.failed_count,
            p50_latency_ms: outcome_bucket.p50_latency_ms,
            p95_latency_ms: outcome_bucket.p95_latency_ms,
        }
    }
}
