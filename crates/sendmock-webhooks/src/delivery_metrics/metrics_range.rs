const HOUR_MS: i64 = 60 * 60 * 1_000;
const DAY_MS: i64 = 24 * HOUR_MS;

/// The span the metrics cover: 24 hours by the hour, or 7 days by the day. Hours and days
/// are UTC, as every time the API answers is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricsRange {
    LastDay,
    LastWeek,
}

impl MetricsRange {
    pub fn bucket_length_ms(self) -> i64 {
        match self {
            Self::LastDay => HOUR_MS,
            Self::LastWeek => DAY_MS,
        }
    }

    fn bucket_count(self) -> i64 {
        match self {
            Self::LastDay => 24,
            Self::LastWeek => 7,
        }
    }

    /// The start of each bucket, oldest first, ending with the current hour or day.
    pub fn bucket_starts(self, now_unix_ms: i64) -> Vec<i64> {
        let window_start_unix_ms = self.window_start_unix_ms(now_unix_ms);
        (0..self.bucket_count())
            .map(|bucket_index| window_start_unix_ms + bucket_index * self.bucket_length_ms())
            .collect()
    }

    /// Where the first bucket starts; deliveries before it are outside the range.
    pub fn window_start_unix_ms(self, now_unix_ms: i64) -> i64 {
        let bucket_length_ms = self.bucket_length_ms();
        let current_bucket_start = now_unix_ms - now_unix_ms.rem_euclid(bucket_length_ms);
        current_bucket_start - (self.bucket_count() - 1) * bucket_length_ms
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const THURSDAY_14_25_UTC: i64 = 1_767_277_500_000;

    #[test]
    fn the_day_range_has_24_hours_ending_with_the_current_hour() {
        let bucket_starts = MetricsRange::LastDay.bucket_starts(THURSDAY_14_25_UTC);

        assert_eq!(bucket_starts.len(), 24);
        assert_eq!(
            bucket_starts.last(),
            Some(&(THURSDAY_14_25_UTC - 25 * 60 * 1_000))
        );
        assert_eq!(
            bucket_starts.first(),
            Some(&(THURSDAY_14_25_UTC - 25 * 60 * 1_000 - 23 * HOUR_MS))
        );
    }

    #[test]
    fn the_week_range_has_7_utc_days_ending_today() {
        let bucket_starts = MetricsRange::LastWeek.bucket_starts(THURSDAY_14_25_UTC);
        let start_of_today = THURSDAY_14_25_UTC - (14 * HOUR_MS + 25 * 60 * 1_000);

        assert_eq!(bucket_starts.len(), 7);
        assert_eq!(bucket_starts.last(), Some(&start_of_today));
        assert_eq!(
            MetricsRange::LastWeek.window_start_unix_ms(THURSDAY_14_25_UTC),
            start_of_today - 6 * DAY_MS
        );
    }
}
