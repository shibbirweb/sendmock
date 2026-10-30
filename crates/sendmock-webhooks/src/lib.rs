//! The webhook domain: endpoints, rules, templates, rendering and the delivery queue.

mod delivery_metrics;
mod retry_schedule;
mod rule_filter;
mod standard_webhooks;
mod webhook_secret;

pub use delivery_metrics::{
    DeliveryOutcome, DeliverySample, DeliverySummary, EndpointHealth, FailureCodeCount,
    MeteredEndpoint, MetricsRange, OutcomeBucket, build_outcome_buckets, calculate_percentile,
    count_top_failure_codes, select_recent_failures, summarize_endpoint_health,
};
pub use retry_schedule::{AttemptDecision, AttemptOutcome, RetrySchedule};
pub use rule_filter::{
    FilterCondition, FilterExpression, RuleMessage, RuleOperator, find_first_filter_error,
};
pub use standard_webhooks::{StandardWebhookHeaders, build_signed_headers, sign_payload};
pub use webhook_secret::{WebhookSecret, WebhookSecretError};
