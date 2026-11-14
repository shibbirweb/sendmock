use sendmock_mail::{EmailRuleOutcome, is_valid_address_pattern, is_valid_refusal_code};
use sendmock_store::EmailOutcomeRuleRecord;

use crate::OperationError;

const MAXIMUM_NOTE_CHARACTERS: usize = 120;
const MAXIMUM_DIAGNOSTIC_CHARACTERS: usize = 200;

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

fn trim_to_present_text(optional_text: Option<String>) -> Option<String> {
    optional_text
        .map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty())
}

/// Trims the text and drops an SMTP code or diagnostic the outcome does not use, then checks
/// the pattern, code, diagnostic and note the way the Settings form does.
pub fn normalize_and_validate(
    mut email_outcome_rule: EmailOutcomeRuleRecord,
) -> Result<EmailOutcomeRuleRecord, OperationError> {
    let Some(rule_outcome) = EmailRuleOutcome::parse(&email_outcome_rule.outcome) else {
        return Err(field_error("outcome", "Choose one of the outcomes"));
    };
    email_outcome_rule.pattern = email_outcome_rule.pattern.trim().to_owned();
    email_outcome_rule.smtp_code = trim_to_present_text(email_outcome_rule.smtp_code)
        .filter(|_| rule_outcome.uses_smtp_reply());
    email_outcome_rule.diagnostic = trim_to_present_text(email_outcome_rule.diagnostic)
        .filter(|_| rule_outcome.uses_smtp_reply());
    if !is_valid_address_pattern(&email_outcome_rule.pattern) {
        return Err(field_error(
            "pattern",
            "Use an address like qa@app.test, or * wildcards (*@bounce.qa.test)",
        ));
    }
    if email_outcome_rule
        .smtp_code
        .as_deref()
        .is_some_and(|smtp_code| !is_valid_refusal_code(smtp_code))
    {
        return Err(field_error(
            "smtp_code",
            "Use an SMTP reply like 550 or 550 5.1.1",
        ));
    }
    // The diagnostic goes into an SMTP reply line, so it must stay one short line.
    if email_outcome_rule
        .diagnostic
        .as_deref()
        .is_some_and(|diagnostic| {
            diagnostic.chars().any(char::is_control)
                || diagnostic.chars().count() > MAXIMUM_DIAGNOSTIC_CHARACTERS
        })
    {
        return Err(field_error(
            "diagnostic",
            "Use one line of at most 200 characters",
        ));
    }
    if email_outcome_rule.note.chars().count() > MAXIMUM_NOTE_CHARACTERS {
        return Err(field_error("note", "Use at most 120 characters"));
    }
    Ok(email_outcome_rule)
}
