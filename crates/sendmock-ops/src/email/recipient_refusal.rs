use sendmock_mail::{AddressOutcomeSource, RecipientRefusal, resolve_address_outcome};

use crate::{OperationContext, OperationError, load_email_outcome_rules};

/// The refusal a `reject` custom rule gives this recipient, if the first enabled rule that
/// matches it is one. SMTP answers `RCPT` with it; the HTTP sends turn it into an error.
pub async fn find_recipient_refusal(
    operation_context: &OperationContext,
    recipient_address: &str,
) -> Result<Option<RecipientRefusal>, OperationError> {
    let custom_rules = load_email_outcome_rules(operation_context).await?;
    let outcome_source = resolve_address_outcome(recipient_address, &custom_rules, false);
    Ok(match outcome_source {
        AddressOutcomeSource::CustomRule(custom_rule) => custom_rule.refusal(),
        AddressOutcomeSource::MagicAddress(_) | AddressOutcomeSource::Profile => None,
    })
}

/// Fails the send, as the mock does, when a `reject` rule refuses any recipient, so nothing
/// is stored; the error names the recipient and the SMTP reply it got.
pub async fn refuse_rejected_recipients(
    operation_context: &OperationContext,
    recipient_addresses: &[String],
) -> Result<(), OperationError> {
    for recipient_address in recipient_addresses {
        if let Some(refusal) = find_recipient_refusal(operation_context, recipient_address).await? {
            return Err(OperationError::InvalidInput {
                message: format!(
                    "{recipient_address} rejected with {} {} (custom rule {})",
                    refusal.reply_code, refusal.reply_text, refusal.rule_position
                ),
                field: Some("to".to_owned()),
            });
        }
    }
    Ok(())
}
