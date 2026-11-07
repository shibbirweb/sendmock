use schemars::JsonSchema;
use serde::Serialize;

use crate::webhooks::{EndpointMetrics, RecentFailedDelivery};

/// One hour of traffic in the Overview activity chart.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ActivityBucket {
    pub bucket_start: String,
    pub email_count: u64,
    pub sms_count: u64,
    pub http_request_count: u64,
    pub webhook_delivery_count: u64,
}

/// Test money in one currency, in its smallest unit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct CurrencyAmount {
    pub currency: String,
    pub amount_minor: i64,
}

/// Everything the Overview shows (UI-03). Today starts at midnight UTC.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct AppStats {
    pub email_count: u64,
    pub emails_today: u64,
    pub unread_email_count: u64,
    pub sms_count: u64,
    pub sms_today: u64,
    pub unread_sms_count: u64,
    pub verification_count: u64,
    pub pending_verification_count: u64,
    pub http_request_count: u64,
    pub http_requests_today: u64,
    pub webhook_delivery_count: u64,
    #[schemars(required, schema_with = "crate::nullable_schema::<f64>")]
    pub webhook_success_rate: Option<f64>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub webhook_p95_latency_ms: Option<u32>,
    pub payment_count: u64,
    pub payments_today: u64,
    /// Succeeded among finished payments; null before any finished.
    #[schemars(required, schema_with = "crate::nullable_schema::<f64>")]
    pub payment_success_rate: Option<f64>,
    /// Captured minus refunded, per currency, largest first (test money).
    pub payment_revenue: Vec<CurrencyAmount>,
    /// 24 hourly buckets, oldest first, ending with the current hour.
    pub activity: Vec<ActivityBucket>,
    /// Each endpoint over the last 24 hours.
    pub endpoint_metrics: Vec<EndpointMetrics>,
    pub recent_failures: Vec<RecentFailedDelivery>,
}
