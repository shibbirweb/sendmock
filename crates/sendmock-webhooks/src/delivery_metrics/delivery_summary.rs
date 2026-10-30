use std::collections::BTreeMap;

use super::DeliverySample;

/// Totals over a set of delivery attempts.
#[derive(Debug, Clone, PartialEq)]
pub struct DeliverySummary {
    pub delivery_count: u64,
    /// Succeeded among finished attempts, 0 to 1; none before any finished.
    pub success_rate: Option<f64>,
    pub p50_latency_ms: Option<u32>,
    pub p95_latency_ms: Option<u32>,
    /// Attempts after the first.
    pub retry_count: u64,
    pub render_failed_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FailureCodeCount {
    pub failure_code: String,
    pub failure_count: u64,
}

impl DeliverySummary {
    pub fn summarize(samples: &[&DeliverySample]) -> Self {
        let sorted_durations_ms = sort_durations(samples);
        Self {
            delivery_count: count_matching(samples, |_| true),
            success_rate: calculate_success_rate(samples),
            p50_latency_ms: calculate_percentile(&sorted_durations_ms, 50),
            p95_latency_ms: calculate_percentile(&sorted_durations_ms, 95),
            retry_count: count_matching(samples, |sample| sample.attempt > 1),
            render_failed_count: count_matching(samples, |sample| sample.status == "render_failed"),
        }
    }
}

fn count_matching(
    samples: &[&DeliverySample],
    is_counted: impl Fn(&DeliverySample) -> bool,
) -> u64 {
    let matching_count = samples.iter().filter(|sample| is_counted(sample)).count();
    u64::try_from(matching_count).unwrap_or(u64::MAX)
}

fn calculate_success_rate(samples: &[&DeliverySample]) -> Option<f64> {
    let finished_count = count_matching(samples, DeliverySample::is_finished);
    if finished_count == 0 {
        return None;
    }
    let succeeded_count = count_matching(samples, |sample| sample.status == "succeeded");
    Some(succeeded_count as f64 / finished_count as f64)
}

/// The durations of attempts that ran, shortest first.
pub(crate) fn sort_durations(samples: &[&DeliverySample]) -> Vec<u32> {
    let mut durations_ms: Vec<u32> = samples
        .iter()
        .filter_map(|sample| sample.duration_ms)
        .collect();
    durations_ms.sort_unstable();
    durations_ms
}

/// The nearest-rank percentile of values sorted ascending; none for no values.
pub fn calculate_percentile(sorted_values: &[u32], percentile_rank: usize) -> Option<u32> {
    let value_count = sorted_values.len();
    if value_count == 0 {
        return None;
    }
    let value_index = (percentile_rank * value_count)
        .div_ceil(100)
        .saturating_sub(1)
        .min(value_count - 1);
    sorted_values.get(value_index).copied()
}

/// The most frequent failure codes, most first (ties by code), at most `code_limit`.
pub fn count_top_failure_codes(
    samples: &[&DeliverySample],
    code_limit: usize,
) -> Vec<FailureCodeCount> {
    let mut failure_counts: BTreeMap<String, u64> = BTreeMap::new();
    for failed_sample in samples.iter().filter(|sample| sample.is_failure()) {
        *failure_counts
            .entry(failed_sample.failure_code())
            .or_default() += 1;
    }
    let mut code_counts: Vec<FailureCodeCount> = failure_counts
        .into_iter()
        .map(|(failure_code, failure_count)| FailureCodeCount {
            failure_code,
            failure_count,
        })
        .collect();
    code_counts.sort_by_key(|code_count| std::cmp::Reverse(code_count.failure_count));
    code_counts.truncate(code_limit);
    code_counts
}

#[cfg(test)]
mod tests {
    use super::super::delivery_sample::tests::sample_with_status;
    use super::*;

    fn timed_sample(status: &str, duration_ms: u32) -> DeliverySample {
        let mut sample = sample_with_status("d", status);
        sample.duration_ms = Some(duration_ms);
        sample
    }

    #[test]
    fn percentiles_use_the_nearest_rank() {
        let sorted_durations_ms: Vec<u32> = (1..=20).map(|step| step * 10).collect();

        assert_eq!(calculate_percentile(&sorted_durations_ms, 50), Some(100));
        assert_eq!(calculate_percentile(&sorted_durations_ms, 95), Some(190));
        assert_eq!(calculate_percentile(&[42], 95), Some(42));
        assert_eq!(calculate_percentile(&[], 50), None);
    }

    #[test]
    fn the_success_rate_counts_only_finished_attempts() {
        let samples = [
            timed_sample("succeeded", 10),
            timed_sample("succeeded", 30),
            timed_sample("exhausted", 20),
            timed_sample("failed", 40),
            sample_with_status("pending", "pending"),
            sample_with_status("render_failed", "render_failed"),
        ];
        let sample_references: Vec<&DeliverySample> = samples.iter().collect();

        let summary = DeliverySummary::summarize(&sample_references);

        assert_eq!(summary.delivery_count, 6);
        assert_eq!(summary.success_rate, Some(0.5));
        assert_eq!(summary.p50_latency_ms, Some(20));
        assert_eq!(summary.p95_latency_ms, Some(40));
        assert_eq!(summary.render_failed_count, 1);
    }

    #[test]
    fn nothing_finished_leaves_the_rate_and_latency_empty() {
        let pending_sample = sample_with_status("d", "pending");

        let summary = DeliverySummary::summarize(&[&pending_sample]);

        assert_eq!(summary.success_rate, None);
        assert_eq!(summary.p95_latency_ms, None);
    }

    #[test]
    fn retries_are_attempts_after_the_first() {
        let first_attempt = sample_with_status("d1", "failed");
        let mut second_attempt = sample_with_status("d2", "succeeded");
        second_attempt.attempt = 2;

        let summary = DeliverySummary::summarize(&[&first_attempt, &second_attempt]);

        assert_eq!(summary.retry_count, 1);
    }

    #[test]
    fn top_failure_codes_are_counted_most_first_with_ties_by_code() {
        let mut server_errors = Vec::new();
        for _ in 0..3 {
            let mut server_error = sample_with_status("d", "exhausted");
            server_error.response_status_code = Some(500);
            server_errors.push(server_error);
        }
        let mut not_found = sample_with_status("d", "failed");
        not_found.response_status_code = Some(404);
        let no_response = sample_with_status("d", "failed");
        let succeeded = sample_with_status("d", "succeeded");
        let mut samples: Vec<&DeliverySample> = server_errors.iter().collect();
        samples.extend([&not_found, &no_response, &succeeded]);

        let top_codes = count_top_failure_codes(&samples, 2);

        assert_eq!(
            top_codes,
            vec![
                FailureCodeCount {
                    failure_code: "500".to_owned(),
                    failure_count: 3,
                },
                FailureCodeCount {
                    failure_code: "404".to_owned(),
                    failure_count: 1,
                },
            ]
        );
    }
}
