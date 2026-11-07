use sendmock_store::DeliveryOutcomeFilter;
use sendmock_webhooks::{
    DeliverySample, DeliverySummary, MeteredEndpoint, MetricsRange, build_outcome_buckets,
    count_top_failure_codes, select_recent_failures, summarize_endpoint_health,
};

use super::metrics_inputs::WebhookMetricsInput;
use super::metrics_loading::{load_delivery_samples, load_metered_endpoints};
use super::metrics_view::{
    DeliveryOutcomeBucket, EndpointMetrics, FailureCodeCount, RecentFailedDelivery, WebhookMetrics,
    WebhookMetricsRange,
};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const TOP_FAILURE_CODE_LIMIT: usize = 6;
const RECENT_FAILURE_LIMIT: usize = 8;

impl From<WebhookMetricsRange> for MetricsRange {
    fn from(metrics_range: WebhookMetricsRange) -> Self {
        match metrics_range {
            WebhookMetricsRange::LastDay => Self::LastDay,
            WebhookMetricsRange::LastWeek => Self::LastWeek,
        }
    }
}

pub struct GetWebhookMetricsOperation;

impl Operation for GetWebhookMetricsOperation {
    type Input = WebhookMetricsInput;
    type Output = WebhookMetrics;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksMetrics",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/metrics",
            summary: "Volume, success rate, latency and failures over a range.",
            is_read_only: true,
            cli_usage: "sendmock webhook metrics",
            mcp_tool: "sendmock_webhook_metrics",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Reads every attempt made since the range's first hour or day from the delivery log, so
    /// the numbers always match it (WH-11.2); an unknown endpoint answers empty metrics.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookMetricsInput,
    ) -> Result<WebhookMetrics, OperationError> {
        let metrics_range = MetricsRange::from(input.range);
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let samples = load_delivery_samples(
            operation_context,
            DeliveryOutcomeFilter {
                created_from_unix_ms: Some(metrics_range.window_start_unix_ms(now_unix_ms)),
                endpoint_id: input.endpoint_id.clone(),
            },
        )
        .await?;
        let sample_references: Vec<&DeliverySample> = samples.iter().collect();
        let metered_endpoints =
            load_metered_endpoints(operation_context, input.endpoint_id.as_deref()).await?;
        let summary = DeliverySummary::summarize(&sample_references);
        Ok(WebhookMetrics {
            range: input.range,
            endpoint_id: input.endpoint_id,
            delivery_count: summary.delivery_count,
            success_rate: summary.success_rate,
            p50_latency_ms: summary.p50_latency_ms,
            p95_latency_ms: summary.p95_latency_ms,
            retry_count: summary.retry_count,
            render_failed_count: summary.render_failed_count,
            buckets: build_outcome_buckets(metrics_range, now_unix_ms, &sample_references)
                .into_iter()
                .map(DeliveryOutcomeBucket::from)
                .collect(),
            endpoint_metrics: build_endpoint_metrics(metered_endpoints, &sample_references),
            top_failure_codes: build_top_failure_codes(&sample_references, TOP_FAILURE_CODE_LIMIT),
            recent_failures: build_recent_failures(&sample_references, RECENT_FAILURE_LIMIT),
        })
    }
}

pub fn build_endpoint_metrics(
    metered_endpoints: Vec<MeteredEndpoint>,
    samples: &[&DeliverySample],
) -> Vec<EndpointMetrics> {
    summarize_endpoint_health(metered_endpoints, samples)
        .into_iter()
        .map(EndpointMetrics::from)
        .collect()
}

fn build_top_failure_codes(
    samples: &[&DeliverySample],
    code_limit: usize,
) -> Vec<FailureCodeCount> {
    count_top_failure_codes(samples, code_limit)
        .into_iter()
        .map(FailureCodeCount::from)
        .collect()
}

pub fn build_recent_failures(
    samples: &[&DeliverySample],
    failure_limit: usize,
) -> Vec<RecentFailedDelivery> {
    select_recent_failures(samples, failure_limit)
        .into_iter()
        .map(RecentFailedDelivery::from)
        .collect()
}
