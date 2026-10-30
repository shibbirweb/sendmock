use super::EmailDeliveryEvent;

/// What happens to a sent email, from a magic address, a custom rule or the profile.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailOutcome {
    Delivered,
    HardBounce,
    /// Deferred first, then bounced after the retries run out.
    SoftBounce,
    /// Delivered, then marked as spam.
    Complaint,
    Unsubscribe,
    /// Delivered, then an out-of-office reply comes back (SES `ooto@`).
    OutOfOffice,
    /// A hard bounce because the address is on the suppression list (SES `suppressionlist@`).
    SuppressionList,
}

/// One thing an outcome does, `after_ms` after it starts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutcomeStep {
    pub after_ms: u64,
    pub action: OutcomeAction,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutcomeAction {
    Report(EmailDeliveryEvent),
    /// Stores an automatic reply from the recipient as a new incoming email.
    ReplyOutOfOffice,
}

/// The wait between an outcome's first report and the one that follows it.
pub const FOLLOW_UP_DELAY_MS: u64 = 2_000;

impl EmailOutcome {
    /// The steps in order, the first `first_after_ms` after the outcome starts.
    pub fn plan_steps(self, first_after_ms: u64) -> Vec<OutcomeStep> {
        let follow_up_after_ms = first_after_ms + FOLLOW_UP_DELAY_MS;
        let report_at = |after_ms: u64, delivery_event: EmailDeliveryEvent| OutcomeStep {
            after_ms,
            action: OutcomeAction::Report(delivery_event),
        };
        match self {
            Self::Delivered => vec![report_at(first_after_ms, EmailDeliveryEvent::Delivered)],
            Self::HardBounce => vec![report_at(
                first_after_ms,
                EmailDeliveryEvent::hard_bounce("user unknown"),
            )],
            Self::SuppressionList => vec![report_at(
                first_after_ms,
                EmailDeliveryEvent::hard_bounce("address on the suppression list"),
            )],
            Self::SoftBounce => vec![
                report_at(first_after_ms, EmailDeliveryEvent::Deferred),
                report_at(follow_up_after_ms, EmailDeliveryEvent::soft_bounce()),
            ],
            Self::Complaint => vec![
                report_at(first_after_ms, EmailDeliveryEvent::Delivered),
                report_at(follow_up_after_ms, EmailDeliveryEvent::Complained),
            ],
            Self::Unsubscribe => vec![report_at(first_after_ms, EmailDeliveryEvent::Unsubscribed)],
            Self::OutOfOffice => vec![
                report_at(first_after_ms, EmailDeliveryEvent::Delivered),
                OutcomeStep {
                    after_ms: follow_up_after_ms,
                    action: OutcomeAction::ReplyOutOfOffice,
                },
            ],
        }
    }

    /// How the timeline names it, e.g. `hard bounce`.
    pub fn label(self) -> &'static str {
        match self {
            Self::Delivered => "delivered",
            Self::HardBounce => "hard bounce",
            Self::SoftBounce => "soft bounce",
            Self::Complaint => "complaint",
            Self::Unsubscribe => "unsubscribe",
            Self::OutOfOffice => "out of office",
            Self::SuppressionList => "suppression list",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reported_statuses(outcome_steps: &[OutcomeStep]) -> Vec<(u64, &'static str)> {
        outcome_steps
            .iter()
            .map(|outcome_step| match &outcome_step.action {
                OutcomeAction::Report(delivery_event) => {
                    (outcome_step.after_ms, delivery_event.delivery_status())
                }
                OutcomeAction::ReplyOutOfOffice => (outcome_step.after_ms, "reply"),
            })
            .collect()
    }

    #[test]
    fn a_soft_bounce_is_deferred_then_bounced() {
        let outcome_steps = EmailOutcome::SoftBounce.plan_steps(0);

        assert_eq!(
            reported_statuses(&outcome_steps),
            vec![(0, "deferred"), (FOLLOW_UP_DELAY_MS, "bounced")]
        );
    }

    #[test]
    fn a_complaint_is_delivered_first_and_starts_after_the_given_delay() {
        let outcome_steps = EmailOutcome::Complaint.plan_steps(1_000);

        assert_eq!(
            reported_statuses(&outcome_steps),
            vec![
                (1_000, "delivered"),
                (1_000 + FOLLOW_UP_DELAY_MS, "complained")
            ]
        );
    }

    #[test]
    fn out_of_office_is_delivered_then_replies() {
        let outcome_steps = EmailOutcome::OutOfOffice.plan_steps(0);

        assert_eq!(
            reported_statuses(&outcome_steps),
            vec![(0, "delivered"), (FOLLOW_UP_DELAY_MS, "reply")]
        );
    }

    #[test]
    fn the_suppression_list_is_a_hard_bounce_with_its_own_reason() {
        let outcome_steps = EmailOutcome::SuppressionList.plan_steps(0);

        assert_eq!(
            outcome_steps[0].action,
            OutcomeAction::Report(EmailDeliveryEvent::hard_bounce(
                "address on the suppression list"
            ))
        );
    }
}
