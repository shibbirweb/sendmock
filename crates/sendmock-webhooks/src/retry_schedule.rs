/// How one attempt went, as the sender saw it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttemptOutcome {
    /// Your app answered with this status code.
    Answered {
        status_code: u16,
    },
    TimedOut,
    ConnectionFailed,
}

/// What happens after an attempt.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttemptDecision {
    Succeeded,
    /// Failed; the next attempt runs at this time.
    RetryAt {
        next_attempt_at_unix_ms: i64,
    },
    /// Failed with an answer that is not retried, such as a `4xx`.
    Failed,
    /// Failed on the last allowed attempt.
    Exhausted,
}

/// The retry Strategy of an endpoint: `5xx`, timeouts and connection errors are retried with
/// the backoff, up to `max_attempts` in total; `4xx` only when `retry_on_client_errors` is on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetrySchedule {
    pub max_attempts: u32,
    /// Seconds before each retry, in order; the last value repeats.
    pub backoff_seconds: Vec<u32>,
    pub retry_on_client_errors: bool,
}

impl RetrySchedule {
    /// Decides what follows attempt number `attempt` (one-based) that ended at `now_unix_ms`.
    pub fn decide_after_attempt(
        &self,
        attempt: u32,
        attempt_outcome: AttemptOutcome,
        now_unix_ms: i64,
    ) -> AttemptDecision {
        if !self.is_retryable(attempt_outcome) {
            return match attempt_outcome {
                AttemptOutcome::Answered { status_code } if (200..300).contains(&status_code) => {
                    AttemptDecision::Succeeded
                }
                _ => AttemptDecision::Failed,
            };
        }
        if attempt >= self.max_attempts {
            return AttemptDecision::Exhausted;
        }
        AttemptDecision::RetryAt {
            next_attempt_at_unix_ms: now_unix_ms
                + i64::from(self.delay_before_retry_seconds(attempt)) * 1_000,
        }
    }

    fn is_retryable(&self, attempt_outcome: AttemptOutcome) -> bool {
        match attempt_outcome {
            AttemptOutcome::TimedOut | AttemptOutcome::ConnectionFailed => true,
            AttemptOutcome::Answered { status_code } => {
                status_code >= 500
                    || (self.retry_on_client_errors && (400..500).contains(&status_code))
            }
        }
    }

    /// The wait after attempt `attempt`; past the end of the list the last value repeats.
    fn delay_before_retry_seconds(&self, attempt: u32) -> u32 {
        let backoff_index = usize::try_from(attempt.saturating_sub(1)).unwrap_or(usize::MAX);
        self.backoff_seconds
            .get(backoff_index)
            .or_else(|| self.backoff_seconds.last())
            .copied()
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_schedule() -> RetrySchedule {
        RetrySchedule {
            max_attempts: 5,
            backoff_seconds: vec![1, 5, 30, 120, 600],
            retry_on_client_errors: false,
        }
    }

    // AC: WH-03.2
    #[test]
    fn server_errors_timeouts_and_connection_errors_retry_with_the_backoff() {
        let schedule = default_schedule();

        assert_eq!(
            schedule.decide_after_attempt(1, AttemptOutcome::Answered { status_code: 503 }, 10_000),
            AttemptDecision::RetryAt {
                next_attempt_at_unix_ms: 11_000
            }
        );
        assert_eq!(
            schedule.decide_after_attempt(2, AttemptOutcome::TimedOut, 10_000),
            AttemptDecision::RetryAt {
                next_attempt_at_unix_ms: 15_000
            }
        );
        assert_eq!(
            schedule.decide_after_attempt(4, AttemptOutcome::ConnectionFailed, 10_000),
            AttemptDecision::RetryAt {
                next_attempt_at_unix_ms: 130_000
            }
        );
    }

    // AC: WH-03.2
    #[test]
    fn client_errors_are_not_retried_unless_configured() {
        let schedule = default_schedule();
        let retrying_schedule = RetrySchedule {
            retry_on_client_errors: true,
            ..default_schedule()
        };

        assert_eq!(
            schedule.decide_after_attempt(1, AttemptOutcome::Answered { status_code: 404 }, 0),
            AttemptDecision::Failed
        );
        assert_eq!(
            retrying_schedule.decide_after_attempt(
                1,
                AttemptOutcome::Answered { status_code: 404 },
                0
            ),
            AttemptDecision::RetryAt {
                next_attempt_at_unix_ms: 1_000
            }
        );
    }

    #[test]
    fn a_2xx_answer_succeeds_and_a_3xx_fails() {
        let schedule = default_schedule();

        assert_eq!(
            schedule.decide_after_attempt(1, AttemptOutcome::Answered { status_code: 204 }, 0),
            AttemptDecision::Succeeded
        );
        assert_eq!(
            schedule.decide_after_attempt(1, AttemptOutcome::Answered { status_code: 302 }, 0),
            AttemptDecision::Failed
        );
    }

    // AC: WH-03.4
    #[test]
    fn the_last_allowed_attempt_is_exhausted() {
        let schedule = default_schedule();

        assert_eq!(
            schedule.decide_after_attempt(5, AttemptOutcome::Answered { status_code: 500 }, 0),
            AttemptDecision::Exhausted
        );
    }

    #[test]
    fn the_last_delay_repeats_past_the_end_of_the_list() {
        let schedule = RetrySchedule {
            max_attempts: 10,
            backoff_seconds: vec![2],
            retry_on_client_errors: false,
        };

        assert_eq!(
            schedule.decide_after_attempt(7, AttemptOutcome::TimedOut, 0),
            AttemptDecision::RetryAt {
                next_attempt_at_unix_ms: 2_000
            }
        );
    }
}
