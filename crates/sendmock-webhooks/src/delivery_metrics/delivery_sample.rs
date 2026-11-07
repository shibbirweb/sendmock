/// One delivery attempt from the log, with what the metrics read from it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliverySample {
    pub delivery_id: String,
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub event_type: String,
    pub attempt: u32,
    /// `pending`, `render_failed`, `in_flight`, `succeeded`, `failed`, `exhausted` or `cancelled`.
    pub status: String,
    /// The status code your app answered with; none when it did not answer.
    pub response_status_code: Option<u16>,
    pub duration_ms: Option<u32>,
    pub error_message: Option<String>,
    /// A `failed` attempt whose retry is still to come.
    pub has_retry_due: bool,
    pub created_at_unix_ms: i64,
}

/// Which stack of the deliveries chart an attempt goes in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryOutcome {
    Succeeded,
    /// Pending, in flight, or failed with a retry still to come.
    Retrying,
    /// Exhausted, render failed, cancelled, or failed with no retry left.
    Failed,
}

impl DeliverySample {
    pub fn outcome(&self) -> DeliveryOutcome {
        match self.status.as_str() {
            "succeeded" => DeliveryOutcome::Succeeded,
            "pending" | "in_flight" => DeliveryOutcome::Retrying,
            "failed" if self.has_retry_due => DeliveryOutcome::Retrying,
            _ => DeliveryOutcome::Failed,
        }
    }

    /// Succeeded or failed for good or for now; the success rate counts only these.
    pub fn is_finished(&self) -> bool {
        matches!(self.status.as_str(), "succeeded" | "failed" | "exhausted")
    }

    /// Failed, exhausted or render failed, as the recent failures and failure codes list them.
    pub fn is_failure(&self) -> bool {
        matches!(
            self.status.as_str(),
            "failed" | "exhausted" | "render_failed"
        )
    }

    /// `"500"`, `"render_failed"` or `"no_response"`.
    pub fn failure_code(&self) -> String {
        if self.status == "render_failed" {
            return "render_failed".to_owned();
        }
        match self.response_status_code {
            Some(status_code) => status_code.to_string(),
            None => "no_response".to_owned(),
        }
    }
}

/// The newest failures first, at most `failure_limit`; `samples` are oldest first.
pub fn select_recent_failures(
    samples: &[&DeliverySample],
    failure_limit: usize,
) -> Vec<DeliverySample> {
    samples
        .iter()
        .rev()
        .filter(|sample| sample.is_failure())
        .take(failure_limit)
        .map(|sample| (*sample).clone())
        .collect()
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub fn sample_with_status(delivery_id: &str, status: &str) -> DeliverySample {
        DeliverySample {
            delivery_id: delivery_id.to_owned(),
            endpoint_id: "endpoint-1".to_owned(),
            endpoint_name: "Orders app".to_owned(),
            event_type: "email.received".to_owned(),
            attempt: 1,
            status: status.to_owned(),
            response_status_code: None,
            duration_ms: None,
            error_message: None,
            has_retry_due: false,
            created_at_unix_ms: 0,
        }
    }

    #[test]
    fn a_failed_attempt_with_a_retry_due_is_retrying_and_one_without_is_failed() {
        let mut waiting_attempt = sample_with_status("d1", "failed");
        waiting_attempt.has_retry_due = true;
        let final_attempt = sample_with_status("d2", "failed");

        assert_eq!(waiting_attempt.outcome(), DeliveryOutcome::Retrying);
        assert_eq!(final_attempt.outcome(), DeliveryOutcome::Failed);
    }

    #[test]
    fn pending_and_in_flight_are_retrying_while_cancelled_and_render_failed_are_failed() {
        let outcomes: Vec<DeliveryOutcome> = [
            "pending",
            "in_flight",
            "cancelled",
            "render_failed",
            "exhausted",
            "succeeded",
        ]
        .iter()
        .map(|status| sample_with_status("d", status).outcome())
        .collect();

        assert_eq!(
            outcomes,
            vec![
                DeliveryOutcome::Retrying,
                DeliveryOutcome::Retrying,
                DeliveryOutcome::Failed,
                DeliveryOutcome::Failed,
                DeliveryOutcome::Failed,
                DeliveryOutcome::Succeeded,
            ]
        );
    }

    #[test]
    fn failure_codes_name_the_status_code_a_render_failure_or_no_response() {
        let mut answered_attempt = sample_with_status("d1", "exhausted");
        answered_attempt.response_status_code = Some(503);
        let unanswered_attempt = sample_with_status("d2", "failed");
        let unrendered_attempt = sample_with_status("d3", "render_failed");

        assert_eq!(answered_attempt.failure_code(), "503");
        assert_eq!(unanswered_attempt.failure_code(), "no_response");
        assert_eq!(unrendered_attempt.failure_code(), "render_failed");
    }

    #[test]
    fn recent_failures_are_newest_first_and_leave_out_cancelled_attempts() {
        let samples = [
            sample_with_status("oldest", "failed"),
            sample_with_status("cancelled", "cancelled"),
            sample_with_status("middle", "render_failed"),
            sample_with_status("succeeded", "succeeded"),
            sample_with_status("newest", "exhausted"),
        ];
        let sample_references: Vec<&DeliverySample> = samples.iter().collect();

        let recent_failures = select_recent_failures(&sample_references, 2);

        let failure_ids: Vec<&str> = recent_failures
            .iter()
            .map(|failure| failure.delivery_id.as_str())
            .collect();
        assert_eq!(failure_ids, vec!["newest", "middle"]);
    }
}
