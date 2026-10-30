use sendmock_store::{DeliveryOutcomeFilter, HourlyActivityRecord, MessageTotalsRecord};
use sendmock_webhooks::{DeliverySample, DeliverySummary, MeteredEndpoint, MetricsRange};

use super::activity_timeline::build_activity_buckets;
use super::app_stats::AppStats;
use crate::webhooks::{
    build_endpoint_metrics, build_recent_failures, load_delivery_samples, load_metered_endpoints,
};
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

const DAY_MS: i64 = 24 * 60 * 60 * 1_000;
const RECENT_FAILURE_LIMIT: usize = 5;

pub struct GetStatsOperation;

impl Operation for GetStatsOperation {
    type Input = NoInput;
    type Output = AppStats;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getStats",
            method: HttpMethod::Get,
            path: "/api/v1/stats",
            summary: "Counts and rates shown on the Overview.",
            is_read_only: true,
            cli_usage: "sendmock stats",
            mcp_tool: "sendmock_stats",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Webhook numbers come from the delivery log (WH-11.2): totals over every attempt, each
    /// endpoint over the last 24 hours.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<AppStats, OperationError> {
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let start_of_today_unix_ms = now_unix_ms - now_unix_ms.rem_euclid(DAY_MS);
        let message_totals = operation_context
            .activity_stats_repository
            .read_message_totals(start_of_today_unix_ms)
            .await?;
        let hourly_activity = operation_context
            .activity_stats_repository
            .count_messages_by_hour(MetricsRange::LastDay.window_start_unix_ms(now_unix_ms))
            .await?;
        let delivery_samples =
            load_delivery_samples(operation_context, DeliveryOutcomeFilter::default()).await?;
        let metered_endpoints = load_metered_endpoints(operation_context, None).await?;
        Ok(build_app_stats(
            now_unix_ms,
            message_totals,
            &hourly_activity,
            &delivery_samples,
            metered_endpoints,
        ))
    }
}

fn build_app_stats(
    now_unix_ms: i64,
    message_totals: MessageTotalsRecord,
    hourly_activity: &HourlyActivityRecord,
    delivery_samples: &[DeliverySample],
    metered_endpoints: Vec<MeteredEndpoint>,
) -> AppStats {
    let every_delivery: Vec<&DeliverySample> = delivery_samples.iter().collect();
    let last_day_deliveries: Vec<&DeliverySample> = every_delivery
        .iter()
        .copied()
        .filter(|delivery_sample| delivery_sample.created_at_unix_ms >= now_unix_ms - DAY_MS)
        .collect();
    let delivery_summary = DeliverySummary::summarize(&every_delivery);
    AppStats {
        email_count: message_totals.email_count,
        emails_today: message_totals.emails_since,
        unread_email_count: message_totals.unread_email_count,
        sms_count: message_totals.sms_count,
        sms_today: message_totals.sms_since,
        unread_sms_count: message_totals.unread_sms_count,
        verification_count: message_totals.verification_count,
        pending_verification_count: message_totals.pending_verification_count,
        http_request_count: 0,
        http_requests_today: 0,
        webhook_delivery_count: delivery_summary.delivery_count,
        webhook_success_rate: delivery_summary.success_rate,
        webhook_p95_latency_ms: delivery_summary.p95_latency_ms,
        payment_count: 0,
        payments_today: 0,
        payment_success_rate: None,
        payment_revenue: Vec::new(),
        activity: build_activity_buckets(
            &MetricsRange::LastDay.bucket_starts(now_unix_ms),
            hourly_activity,
            &every_delivery,
        ),
        endpoint_metrics: build_endpoint_metrics(metered_endpoints, &last_day_deliveries),
        recent_failures: build_recent_failures(&every_delivery, RECENT_FAILURE_LIMIT),
    }
}
