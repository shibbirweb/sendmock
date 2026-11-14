use std::time::{SystemTime, UNIX_EPOCH};

use super::Clock;

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_unix_ms(&self) -> i64 {
        // A system clock set before 1970 reads as the epoch instead of failing.
        let elapsed_since_epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        i64::try_from(elapsed_since_epoch.as_millis()).unwrap_or(i64::MAX)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_time_after_the_year_2024() {
        let first_of_january_2024_unix_ms = 1_704_067_200_000;

        assert!(SystemClock.now_unix_ms() > first_of_january_2024_unix_ms);
    }
}
