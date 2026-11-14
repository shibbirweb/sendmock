use super::Clock;

#[derive(Debug, Clone, Copy)]
pub struct FixedClock {
    fixed_unix_ms: i64,
}

impl FixedClock {
    pub fn new(fixed_unix_ms: i64) -> Self {
        Self { fixed_unix_ms }
    }
}

impl Clock for FixedClock {
    fn now_unix_ms(&self) -> i64 {
        self.fixed_unix_ms
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn always_reads_the_time_it_was_given() {
        let clock = FixedClock::new(1_767_225_600_000);

        assert_eq!(clock.now_unix_ms(), 1_767_225_600_000);
        assert_eq!(clock.now_unix_ms(), 1_767_225_600_000);
    }
}
