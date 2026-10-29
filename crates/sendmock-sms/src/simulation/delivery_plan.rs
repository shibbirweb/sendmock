use sendmock_core::RandomSource;

use super::magic_numbers::is_twilio_test_from_number;
use super::outcome_resolver::{CustomOutcomeRule, OutcomeSource, resolve_number_outcome};
use super::sms_outcome::{MatchField, PlannedOutcome, SmsOutcomeKind};

/// Twilio's code for a `From` number test credentials do not own.
const NOT_OWNED_FROM_ERROR_CODE: &str = "21606";
/// The codes a random failure reports: an unreachable handset, or an unknown error.
const RANDOM_UNDELIVERED_ERROR_CODE: &str = "30003";
const RANDOM_FAILED_ERROR_CODE: &str = "30008";

/// How messages move on from `queued` when no rule or magic number decides.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimulationProfile {
    /// Sent and delivered at once.
    Instant,
    /// Sent after 700 ms, delivered after 1.8 s.
    Realistic,
    /// Sent at once, then waits for a status set by hand.
    Manual,
}

impl SimulationProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Instant => "instant",
            Self::Realistic => "realistic",
            Self::Manual => "manual",
        }
    }

    /// When the message is sent and when it reaches its final status, from the moment of sending.
    fn step_times_ms(self) -> (u64, u64) {
        match self {
            Self::Instant => (0, 0),
            Self::Realistic | Self::Manual => (700, 1800),
        }
    }
}

/// One change the simulation makes to a message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeliveryChange {
    Status {
        status: &'static str,
        error_code: Option<String>,
    },
    /// The recipient read it, as WhatsApp and RCS report.
    Read,
}

/// A change and when it happens, in milliseconds after the send.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliveryStep {
    pub after_ms: u64,
    pub change: DeliveryChange,
}

/// Whether a send is refused, or accepted with the changes that follow.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SendDecision {
    Rejected {
        error_code: String,
        /// "custom rule 2", "magic number" or "strict test mode", for the error message.
        reason: String,
    },
    Accepted(Vec<DeliveryStep>),
}

/// Everything that decides what happens to a new outbound message.
pub struct SendSimulation<'rules> {
    pub to_number: &'rules str,
    pub from_number: &'rules str,
    pub custom_rules: &'rules [CustomOutcomeRule],
    pub is_magic_numbers_enabled: bool,
    pub is_strict_twilio_test_mode: bool,
    pub profile: SimulationProfile,
    pub failure_rate_percent: u32,
}

/// Rejections first (the recipient, then the sender, then strict test mode); otherwise the
/// recipient's outcome, the sender's, or the profile with its failure rate.
pub fn plan_send(
    simulation: &SendSimulation<'_>,
    random_source: &dyn RandomSource,
) -> SendDecision {
    let to_source = resolve_number_outcome(
        simulation.to_number,
        MatchField::To,
        simulation.custom_rules,
        simulation.is_magic_numbers_enabled,
    );
    let from_source = resolve_number_outcome(
        simulation.from_number,
        MatchField::From,
        simulation.custom_rules,
        simulation.is_magic_numbers_enabled,
    );
    for outcome_source in [&to_source, &from_source] {
        if let Some(rejection) = read_rejection(outcome_source) {
            return rejection;
        }
    }
    if simulation.is_strict_twilio_test_mode
        && !matches!(from_source, OutcomeSource::Custom(_))
        && !is_twilio_test_from_number(simulation.from_number)
    {
        return SendDecision::Rejected {
            error_code: NOT_OWNED_FROM_ERROR_CODE.to_owned(),
            reason: "strict Twilio test mode".to_owned(),
        };
    }
    let planned_outcome = to_source
        .planned_outcome()
        .or_else(|| from_source.planned_outcome());
    SendDecision::Accepted(match planned_outcome {
        Some(planned_outcome) => plan_outcome_steps(&planned_outcome, simulation.profile),
        None => plan_profile_steps(simulation, random_source),
    })
}

fn read_rejection(outcome_source: &OutcomeSource<'_>) -> Option<SendDecision> {
    let planned_outcome = outcome_source.planned_outcome()?;
    if planned_outcome.kind != SmsOutcomeKind::Reject {
        return None;
    }
    let reason = match outcome_source {
        OutcomeSource::Custom(custom_rule) => format!("custom rule {}", custom_rule.position),
        OutcomeSource::Magic(_) | OutcomeSource::Profile => "magic number".to_owned(),
    };
    Some(SendDecision::Rejected {
        error_code: planned_outcome.error_code.unwrap_or_default(),
        reason,
    })
}

fn status_step(after_ms: u64, status: &'static str, error_code: Option<String>) -> DeliveryStep {
    DeliveryStep {
        after_ms,
        change: DeliveryChange::Status { status, error_code },
    }
}

/// A rule's outcome replaces the profile; `manual` uses the realistic timings, so the outcome
/// still plays out.
fn plan_outcome_steps(
    planned_outcome: &PlannedOutcome,
    profile: SimulationProfile,
) -> Vec<DeliveryStep> {
    let (sent_after_ms, final_after_ms) = profile.step_times_ms();
    let sent_step = status_step(sent_after_ms, "sent", None);
    match planned_outcome.kind {
        SmsOutcomeKind::Undelivered | SmsOutcomeKind::Failed => vec![
            sent_step,
            status_step(
                final_after_ms,
                planned_outcome.kind.as_str(),
                planned_outcome.error_code.clone(),
            ),
        ],
        SmsOutcomeKind::DelayedDelivery => {
            let delay_ms = u64::from(planned_outcome.delay_seconds.unwrap_or_default()) * 1000;
            vec![
                sent_step,
                status_step(delay_ms.max(sent_after_ms), "delivered", None),
            ]
        }
        SmsOutcomeKind::Read => vec![
            sent_step,
            status_step(final_after_ms, "delivered", None),
            DeliveryStep {
                after_ms: final_after_ms,
                change: DeliveryChange::Read,
            },
        ],
        SmsOutcomeKind::Reject => Vec::new(),
    }
}

fn plan_profile_steps(
    simulation: &SendSimulation<'_>,
    random_source: &dyn RandomSource,
) -> Vec<DeliveryStep> {
    if simulation.profile == SimulationProfile::Manual {
        return vec![status_step(0, "sent", None)];
    }
    let (sent_after_ms, final_after_ms) = simulation.profile.step_times_ms();
    let sent_step = status_step(sent_after_ms, "sent", None);
    let random_number = random_source.next_u64();
    let is_failure = random_number % 100 < u64::from(simulation.failure_rate_percent.min(100));
    let final_step = match (is_failure, (random_number / 100).is_multiple_of(2)) {
        (false, _) => status_step(final_after_ms, "delivered", None),
        (true, true) => status_step(
            final_after_ms,
            "undelivered",
            Some(RANDOM_UNDELIVERED_ERROR_CODE.to_owned()),
        ),
        (true, false) => status_step(
            final_after_ms,
            "failed",
            Some(RANDOM_FAILED_ERROR_CODE.to_owned()),
        ),
    };
    vec![sent_step, final_step]
}

#[cfg(test)]
mod tests {
    use sendmock_core::SeededRandomSource;

    use super::*;

    fn simulation<'rules>(
        to_number: &'rules str,
        from_number: &'rules str,
        profile: SimulationProfile,
    ) -> SendSimulation<'rules> {
        SendSimulation {
            to_number,
            from_number,
            custom_rules: &[],
            is_magic_numbers_enabled: true,
            is_strict_twilio_test_mode: false,
            profile,
            failure_rate_percent: 0,
        }
    }

    fn accepted_steps(send_decision: SendDecision) -> Vec<(u64, DeliveryChange)> {
        match send_decision {
            SendDecision::Accepted(delivery_steps) => delivery_steps
                .into_iter()
                .map(|delivery_step| (delivery_step.after_ms, delivery_step.change))
                .collect(),
            SendDecision::Rejected { error_code, .. } => panic!("rejected with {error_code}"),
        }
    }

    fn status(status: &'static str) -> DeliveryChange {
        DeliveryChange::Status {
            status,
            error_code: None,
        }
    }

    // AC: SM-07.1
    #[test]
    fn each_profile_produces_its_documented_sequence() {
        let random_source = SeededRandomSource::new(1);
        let plan = |profile| {
            accepted_steps(plan_send(
                &simulation("+15551230000", "+15559990000", profile),
                &random_source,
            ))
        };

        assert_eq!(
            plan(SimulationProfile::Instant),
            vec![(0, status("sent")), (0, status("delivered"))]
        );
        assert_eq!(
            plan(SimulationProfile::Realistic),
            vec![(700, status("sent")), (1800, status("delivered"))]
        );
        assert_eq!(plan(SimulationProfile::Manual), vec![(0, status("sent"))]);
    }

    // AC: SM-07.2
    #[test]
    fn a_magic_recipient_is_rejected_before_a_magic_sender() {
        let send_decision = plan_send(
            &simulation("+15005550002", "+15005550008", SimulationProfile::Instant),
            &SeededRandomSource::new(1),
        );

        assert_eq!(
            send_decision,
            SendDecision::Rejected {
                error_code: "21612".to_owned(),
                reason: "magic number".to_owned(),
            }
        );
    }

    // AC: SM-07.3
    #[test]
    fn a_delayed_number_is_delivered_after_its_delay_in_every_profile() {
        let delivery_steps = accepted_steps(plan_send(
            &simulation("+15005550105", "+15559990000", SimulationProfile::Instant),
            &SeededRandomSource::new(1),
        ));

        assert_eq!(
            delivery_steps,
            vec![(0, status("sent")), (30_000, status("delivered"))]
        );
    }

    // AC: SM-07.3
    #[test]
    fn the_read_number_is_delivered_then_read() {
        let delivery_steps = accepted_steps(plan_send(
            &simulation("+15005550106", "+15559990000", SimulationProfile::Realistic),
            &SeededRandomSource::new(1),
        ));

        assert_eq!(
            delivery_steps,
            vec![
                (700, status("sent")),
                (1800, status("delivered")),
                (1800, DeliveryChange::Read),
            ]
        );
    }

    // AC: SM-07.4
    #[test]
    fn strict_test_mode_rejects_senders_that_are_not_test_numbers() {
        let mut strict_simulation =
            simulation("+15551230000", "+15559990000", SimulationProfile::Instant);
        strict_simulation.is_strict_twilio_test_mode = true;
        let random_source = SeededRandomSource::new(1);

        let rejected = plan_send(&strict_simulation, &random_source);
        strict_simulation.from_number = "+15005550006";
        let accepted = plan_send(&strict_simulation, &random_source);

        assert!(matches!(
            rejected,
            SendDecision::Rejected { ref error_code, .. } if error_code == "21606"
        ));
        assert!(matches!(accepted, SendDecision::Accepted(_)));
    }

    // AC: SM-07.5
    #[test]
    fn a_failure_rate_fails_about_that_share_of_messages() {
        let mut failing_simulation =
            simulation("+15551230000", "+15559990000", SimulationProfile::Instant);
        failing_simulation.failure_rate_percent = 20;
        let random_source = SeededRandomSource::new(42);

        let failed_count = (0..1000)
            .filter(|_| {
                accepted_steps(plan_send(&failing_simulation, &random_source))
                    .iter()
                    .any(|(_, change)| {
                        matches!(
                            change,
                            DeliveryChange::Status {
                                status: "undelivered" | "failed",
                                ..
                            }
                        )
                    })
            })
            .count();

        assert!(
            (150..=250).contains(&failed_count),
            "{failed_count} of 1000 failed"
        );
    }

    // AC: SM-07.8
    #[test]
    fn a_custom_reject_rule_names_its_position() {
        let custom_rules = vec![CustomOutcomeRule {
            rule_id: "rule-1".to_owned(),
            position: 1,
            match_field: MatchField::From,
            pattern: "+1555999*".to_owned(),
            planned_outcome: PlannedOutcome {
                kind: SmsOutcomeKind::Reject,
                error_code: Some("21610".to_owned()),
                delay_seconds: None,
            },
            is_enabled: true,
        }];
        let mut custom_simulation =
            simulation("+15551230000", "+15559990000", SimulationProfile::Instant);
        custom_simulation.custom_rules = &custom_rules;

        let send_decision = plan_send(&custom_simulation, &SeededRandomSource::new(1));

        assert_eq!(
            send_decision,
            SendDecision::Rejected {
                error_code: "21610".to_owned(),
                reason: "custom rule 1".to_owned(),
            }
        );
    }
}
