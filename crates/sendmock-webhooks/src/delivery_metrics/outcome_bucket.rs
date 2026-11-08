use super::delivery_summary::sort_durations;
use super::{DeliveryOutcome, DeliverySample, MetricsRange, calculate_percentile};

/// One hour or day of attempts by outcome, for the stacked deliveries chart.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutcomeBucket {
    pub bucket_start_unix_ms: i64,
    pub succeeded_count: u64,
    pub retrying_count: u64,
    pub failed_count: u64,
    pub p50_latency_ms: Option<u32>,
    pub p95_latency_ms: Option<u32>,
}

/// Every bucket of the range, oldest first, empty ones included.
pub fn build_outcome_buckets(
    metrics_range: MetricsRange,
    now_unix_ms: i64,
    samples: &[&DeliverySample],
) -> Vec<OutcomeBucket> {
    let bucket_starts = metrics_range.bucket_starts(now_unix_ms);
    let mut bucket_samples: Vec<Vec<&DeliverySample>> = vec![Vec::new(); bucket_starts.len()];
    let window_start_unix_ms = metrics_range.window_start_unix_ms(now_unix_ms);
    for sample in samples {
        let elapsed_ms = sample.created_at_unix_ms - window_start_unix_ms;
        if elapsed_ms < 0 {
            continue;
        }
        let bucket_index =
            usize::try_from(elapsed_ms / metrics_range.bucket_length_ms()).unwrap_or(usize::MAX);
        if let Some(samples_in_bucket) = bucket_samples.get_mut(bucket_index) {
            samples_in_bucket.push(sample);
        }
    }
    bucket_starts
        .into_iter()
        .zip(bucket_samples)
        .map(|(bucket_start_unix_ms, samples_in_bucket)| {
            summarize_bucket(bucket_start_unix_ms, &samples_in_bucket)
        })
        .collect()
}

fn summarize_bucket(bucket_start_unix_ms: i64, samples: &[&DeliverySample]) -> OutcomeBucket {
    let count_outcome = |delivery_outcome: DeliveryOutcome| {
        let outcome_count = samples
            .iter()
            .filter(|sample| sample.outcome() == delivery_outcome)
            .count();
        u64::try_from(outcome_count).unwrap_or(u64::MAX)
    };
    let sorted_durations_ms = sort_durations(samples);
    OutcomeBucket {
        bucket_start_unix_ms,
        succeeded_count: count_outcome(DeliveryOutcome::Succeeded),
        retrying_count: count_outcome(DeliveryOutcome::Retrying),
        failed_count: count_outcome(DeliveryOutcome::Failed),
        p50_latency_ms: calculate_percentile(&sorted_durations_ms, 50),
        p95_latency_ms: calculate_percentile(&sorted_durations_ms, 95),
    }
}

#[cfg(test)]
mod tests {
    use super::super::delivery_sample::tests::sample_with_status;
    use super::*;

    const HOUR_MS: i64 = 60 * 60 * 1_000;
    const NOW_UNIX_MS: i64 = 1_767_277_500_000;

    fn sample_at(
        status: &str,
        created_at_unix_ms: i64,
        duration_ms: Option<u32>,
    ) -> DeliverySample {
        let mut sample = sample_with_status("d", status);
        sample.created_at_unix_ms = created_at_unix_ms;
        sample.duration_ms = duration_ms;
        sample
    }

    #[test]
    fn attempts_land_in_their_hour_by_outcome_with_its_latency() {
        let current_hour_start = NOW_UNIX_MS - 25 * 60 * 1_000;
        let samples = [
            sample_at("succeeded", current_hour_start + 1_000, Some(80)),
            sample_at("exhausted", current_hour_start + 2_000, Some(20)),
            sample_at("pending", current_hour_start + 3_000, None),
            sample_at("succeeded", current_hour_start - HOUR_MS, Some(5)),
        ];
        let sample_references: Vec<&DeliverySample> = samples.iter().collect();

        let buckets = build_outcome_buckets(MetricsRange::LastDay, NOW_UNIX_MS, &sample_references);

        assert_eq!(buckets.len(), 24);
        let current_hour = &buckets[23];
        assert_eq!(current_hour.bucket_start_unix_ms, current_hour_start);
        assert_eq!(
            (
                current_hour.succeeded_count,
                current_hour.failed_count,
                current_hour.retrying_count
            ),
            (1, 1, 1)
        );
        assert_eq!(current_hour.p50_latency_ms, Some(20));
        assert_eq!(current_hour.p95_latency_ms, Some(80));
        assert_eq!(buckets[22].succeeded_count, 1);
    }

    #[test]
    fn attempts_before_the_range_are_left_out() {
        let too_old = sample_at("succeeded", NOW_UNIX_MS - 25 * HOUR_MS, Some(5));

        let buckets = build_outcome_buckets(MetricsRange::LastDay, NOW_UNIX_MS, &[&too_old]);

        let counted_total: u64 = buckets.iter().map(|bucket| bucket.succeeded_count).sum();
        assert_eq!(counted_total, 0);
    }
}
