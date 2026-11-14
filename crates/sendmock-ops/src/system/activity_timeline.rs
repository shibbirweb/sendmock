use sendmock_core::format_rfc3339;
use sendmock_store::{HourlyActivityRecord, HourlyCountRecord};
use sendmock_webhooks::DeliverySample;

use super::app_stats::ActivityBucket;

const HOUR_MS: i64 = 60 * 60 * 1_000;

/// One bucket per hour start, with the emails, SMS and webhook deliveries of that hour. HTTP
/// requests stay at zero until the HTTP catcher stores them.
pub fn build_activity_buckets(
    hour_starts: &[i64],
    hourly_activity: &HourlyActivityRecord,
    delivery_samples: &[&DeliverySample],
) -> Vec<ActivityBucket> {
    let window_start_unix_ms = hour_starts.first().copied().unwrap_or_default();
    let mut delivery_counts = vec![0_u64; hour_starts.len()];
    for delivery_sample in delivery_samples {
        let elapsed_ms = delivery_sample.created_at_unix_ms - window_start_unix_ms;
        let hour_slot = usize::try_from(elapsed_ms.div_euclid(HOUR_MS)).ok();
        if let Some(hour_count) = hour_slot.and_then(|hour_slot| delivery_counts.get_mut(hour_slot))
        {
            *hour_count += 1;
        }
    }
    hour_starts
        .iter()
        .zip(delivery_counts)
        .enumerate()
        .map(
            |(hour_index, (hour_start_unix_ms, webhook_delivery_count))| ActivityBucket {
                bucket_start: format_rfc3339(*hour_start_unix_ms),
                email_count: count_in_hour(&hourly_activity.email_counts, hour_index),
                sms_count: count_in_hour(&hourly_activity.sms_counts, hour_index),
                http_request_count: 0,
                webhook_delivery_count,
            },
        )
        .collect()
}

fn count_in_hour(hourly_counts: &[HourlyCountRecord], hour_index: usize) -> u64 {
    hourly_counts
        .iter()
        .find(|hourly_count| usize::try_from(hourly_count.hour_offset).ok() == Some(hour_index))
        .map(|hourly_count| hourly_count.item_count)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn delivery_at(created_at_unix_ms: i64) -> DeliverySample {
        DeliverySample {
            delivery_id: "d".to_owned(),
            endpoint_id: "endpoint-1".to_owned(),
            endpoint_name: "Orders app".to_owned(),
            event_type: "email.received".to_owned(),
            attempt: 1,
            status: "succeeded".to_owned(),
            response_status_code: Some(200),
            duration_ms: Some(10),
            error_message: None,
            has_retry_due: false,
            created_at_unix_ms,
        }
    }

    #[test]
    fn each_hour_counts_its_emails_sms_and_deliveries() {
        let hour_starts = [0, HOUR_MS, 2 * HOUR_MS];
        let hourly_activity = HourlyActivityRecord {
            email_counts: vec![HourlyCountRecord {
                hour_offset: 2,
                item_count: 4,
            }],
            sms_counts: vec![HourlyCountRecord {
                hour_offset: 0,
                item_count: 1,
            }],
        };
        let deliveries = [
            delivery_at(HOUR_MS + 5),
            delivery_at(HOUR_MS + 9),
            delivery_at(3 * HOUR_MS),
        ];
        let delivery_references: Vec<&DeliverySample> = deliveries.iter().collect();

        let buckets = build_activity_buckets(&hour_starts, &hourly_activity, &delivery_references);

        let counts: Vec<(u64, u64, u64)> = buckets
            .iter()
            .map(|bucket| {
                (
                    bucket.email_count,
                    bucket.sms_count,
                    bucket.webhook_delivery_count,
                )
            })
            .collect();
        assert_eq!(counts, vec![(0, 1, 0), (0, 0, 2), (4, 0, 0)]);
        assert_eq!(buckets[1].bucket_start, "1970-01-01T01:00:00Z");
    }
}
