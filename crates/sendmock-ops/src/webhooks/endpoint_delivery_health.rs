use std::collections::HashMap;

use sendmock_store::DeliveryOutcomeFilter;
use sendmock_webhooks::{DeliverySample, DeliverySummary, MetricsRange};

use super::endpoint_view::WebhookEndpoint;
use super::metrics_loading::load_delivery_samples;
use crate::{OperationContext, OperationError};

/// Adds each endpoint's last 24 hours as the endpoints table shows them (WH-01.7): the
/// success rate, how many attempts it made and the success rate of each hour, oldest first.
/// The hours are the ones the webhook metrics use, so both screens agree.
pub async fn add_delivery_health(
    operation_context: &OperationContext,
    mut endpoints: Vec<WebhookEndpoint>,
) -> Result<Vec<WebhookEndpoint>, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let only_endpoint_id = match endpoints.as_slice() {
        [single_endpoint] => Some(single_endpoint.id.clone()),
        _ => None,
    };
    let samples = load_delivery_samples(
        operation_context,
        DeliveryOutcomeFilter {
            created_from_unix_ms: Some(MetricsRange::LastDay.window_start_unix_ms(now_unix_ms)),
            endpoint_id: only_endpoint_id,
        },
    )
    .await?;
    let mut samples_by_endpoint: HashMap<&str, Vec<&DeliverySample>> = HashMap::new();
    for sample in &samples {
        samples_by_endpoint
            .entry(sample.endpoint_id.as_str())
            .or_default()
            .push(sample);
    }
    for endpoint in &mut endpoints {
        let endpoint_samples = samples_by_endpoint
            .get(endpoint.id.as_str())
            .map(Vec::as_slice)
            .unwrap_or_default();
        apply_day_summary(endpoint, endpoint_samples, now_unix_ms);
    }
    Ok(endpoints)
}

/// The same, for the one endpoint an operation answers.
pub async fn add_endpoint_delivery_health(
    operation_context: &OperationContext,
    endpoint: WebhookEndpoint,
) -> Result<WebhookEndpoint, OperationError> {
    let mut endpoints = add_delivery_health(operation_context, vec![endpoint]).await?;
    endpoints
        .pop()
        .ok_or_else(|| OperationError::Internal("the endpoint went missing".to_owned()))
}

fn apply_day_summary(
    endpoint: &mut WebhookEndpoint,
    samples: &[&DeliverySample],
    now_unix_ms: i64,
) {
    let day_summary = DeliverySummary::summarize(samples);
    endpoint.success_rate = day_summary.success_rate;
    endpoint.delivery_count_24h = u32::try_from(day_summary.delivery_count).unwrap_or(u32::MAX);
    endpoint.success_history = summarize_each_hour(samples, now_unix_ms);
}

fn summarize_each_hour(samples: &[&DeliverySample], now_unix_ms: i64) -> Vec<Option<f64>> {
    let hour_length_ms = MetricsRange::LastDay.bucket_length_ms();
    MetricsRange::LastDay
        .bucket_starts(now_unix_ms)
        .into_iter()
        .map(|hour_start_unix_ms| {
            let hour_samples: Vec<&DeliverySample> = samples
                .iter()
                .copied()
                .filter(|sample| {
                    sample.created_at_unix_ms >= hour_start_unix_ms
                        && sample.created_at_unix_ms < hour_start_unix_ms + hour_length_ms
                })
                .collect();
            DeliverySummary::summarize(&hour_samples).success_rate
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR_MS: i64 = 60 * 60 * 1_000;
    const NOW_UNIX_MS: i64 = 1_767_277_500_000;

    fn build_sample(status: &str, created_at_unix_ms: i64) -> DeliverySample {
        DeliverySample {
            delivery_id: format!("delivery-{created_at_unix_ms}-{status}"),
            endpoint_id: "endpoint".to_owned(),
            endpoint_name: "Orders".to_owned(),
            event_type: "test.ping".to_owned(),
            attempt: 1,
            status: status.to_owned(),
            response_status_code: Some(200),
            duration_ms: Some(12),
            error_message: None,
            has_retry_due: false,
            created_at_unix_ms,
        }
    }

    // AC: WH-01.7
    #[test]
    fn each_hour_gets_its_own_success_rate_and_quiet_hours_stay_empty() {
        let two_hours_ago = build_sample("failed", NOW_UNIX_MS - 2 * HOUR_MS);
        let now_succeeded = build_sample("succeeded", NOW_UNIX_MS);
        let now_failed = build_sample("failed", NOW_UNIX_MS);
        let samples = vec![&two_hours_ago, &now_succeeded, &now_failed];

        let success_history = summarize_each_hour(&samples, NOW_UNIX_MS);

        assert_eq!(success_history.len(), 24);
        assert_eq!(success_history[23], Some(0.5));
        assert_eq!(success_history[22], None);
        assert_eq!(success_history[21], Some(0.0));
    }
}
