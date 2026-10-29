use sendmock_sms::{SmsOutcomeKind, is_valid_outcome_pattern};
use sendmock_store::SmsOutcomeRuleRecord;

use crate::OperationError;

const MAXIMUM_NOTE_CHARACTERS: usize = 120;
const MAXIMUM_DELAY_SECONDS: u32 = 3600;

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// Trims the text and drops an error code or delay the outcome does not use, then checks the
/// pattern, code, delay and note the way the Settings form does.
pub fn normalize_and_validate(
    mut sms_outcome_rule: SmsOutcomeRuleRecord,
) -> Result<SmsOutcomeRuleRecord, OperationError> {
    let Some(outcome_kind) = SmsOutcomeKind::parse(&sms_outcome_rule.outcome) else {
        return Err(field_error("outcome", "Choose one of the outcomes"));
    };
    sms_outcome_rule.pattern = sms_outcome_rule.pattern.trim().to_owned();
    sms_outcome_rule.error_code = sms_outcome_rule
        .error_code
        .map(|error_code| error_code.trim().to_owned())
        .filter(|error_code| outcome_kind.requires_error_code() && !error_code.is_empty());
    if outcome_kind != SmsOutcomeKind::DelayedDelivery {
        sms_outcome_rule.delay_seconds = None;
    }
    if !is_valid_outcome_pattern(&sms_outcome_rule.pattern) {
        return Err(field_error(
            "pattern",
            "Use a number like +15559990000, or * for any digits (+1555777*)",
        ));
    }
    let is_error_code_valid = sms_outcome_rule
        .error_code
        .as_deref()
        .is_some_and(|error_code| {
            (3..=6).contains(&error_code.len())
                && error_code
                    .chars()
                    .all(|character| character.is_ascii_digit())
        });
    if outcome_kind.requires_error_code() && !is_error_code_valid {
        return Err(field_error(
            "error_code",
            "Enter the error code, for example 30007",
        ));
    }
    let is_delay_valid = sms_outcome_rule
        .delay_seconds
        .is_some_and(|delay_seconds| (1..=MAXIMUM_DELAY_SECONDS).contains(&delay_seconds));
    if outcome_kind == SmsOutcomeKind::DelayedDelivery && !is_delay_valid {
        return Err(field_error("delay_seconds", "Choose 1 to 3,600 seconds"));
    }
    if sms_outcome_rule.note.chars().count() > MAXIMUM_NOTE_CHARACTERS {
        return Err(field_error("note", "Use at most 120 characters"));
    }
    Ok(sms_outcome_rule)
}
