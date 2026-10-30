use sendmock_sms::{
    CustomOutcomeRule, MatchField, PlannedOutcome, SendDecision, SendSimulation, SimulationProfile,
    SmsOutcomeKind, plan_send,
};
use sendmock_store::SmsOutcomeRuleRecord;

use crate::{OperationContext, OperationError, SmsSimulationProfile};

/// Whether a new outbound message is refused, or accepted with the status changes that follow,
/// from the custom outcome numbers, the magic numbers and the SMS simulation settings.
pub async fn decide_outbound_send(
    operation_context: &OperationContext,
    to_number: &str,
    from_number: &str,
) -> Result<SendDecision, OperationError> {
    let app_settings = operation_context.settings_store.current().await?;
    let custom_rules = load_custom_outcome_rules(operation_context).await?;
    let send_simulation = SendSimulation {
        to_number,
        from_number,
        custom_rules: &custom_rules,
        is_magic_numbers_enabled: app_settings.is_magic_numbers_enabled,
        is_strict_twilio_test_mode: app_settings.is_strict_twilio_test_mode,
        profile: to_simulation_profile(app_settings.sms_simulation_profile),
        failure_rate_percent: app_settings.sms_failure_rate_percent,
    };
    Ok(plan_send(
        &send_simulation,
        operation_context.random_source.as_ref(),
    ))
}

/// The error the native API answers a refused send with.
pub fn describe_rejection(error_code: &str, reason: &str) -> OperationError {
    OperationError::Rejected {
        code: "sms_rejected",
        message: format!("Rejected with error {error_code} ({reason})"),
    }
}

pub fn to_simulation_profile(profile_setting: SmsSimulationProfile) -> SimulationProfile {
    match profile_setting {
        SmsSimulationProfile::Instant => SimulationProfile::Instant,
        SmsSimulationProfile::Realistic => SimulationProfile::Realistic,
        SmsSimulationProfile::Manual => SimulationProfile::Manual,
    }
}

pub async fn load_custom_outcome_rules(
    operation_context: &OperationContext,
) -> Result<Vec<CustomOutcomeRule>, OperationError> {
    let stored_rules = operation_context
        .sms_outcome_rule_repository
        .list_rules()
        .await?;
    Ok(stored_rules
        .into_iter()
        .filter_map(to_custom_outcome_rule)
        .collect())
}

/// `None` for a stored rule this version cannot read, which is then skipped.
fn to_custom_outcome_rule(stored_rule: SmsOutcomeRuleRecord) -> Option<CustomOutcomeRule> {
    Some(CustomOutcomeRule {
        match_field: MatchField::parse(&stored_rule.match_field)?,
        planned_outcome: PlannedOutcome {
            kind: SmsOutcomeKind::parse(&stored_rule.outcome)?,
            error_code: stored_rule.error_code,
            delay_seconds: stored_rule.delay_seconds,
        },
        rule_id: stored_rule.rule_id,
        position: stored_rule.position,
        pattern: stored_rule.pattern,
        is_enabled: stored_rule.is_enabled,
    })
}
