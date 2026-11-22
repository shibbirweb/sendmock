use sendmock_store::TwilioSubaccountRecord;

use super::twilio_subaccount_inputs::TwilioSubaccountChanges;
use crate::message_providers::mask_secret_value;
use crate::numbers::{field_error, read_optional_url};
use crate::{OperationContext, OperationError};

/// `AC` and 32 lowercase hex digits, as Twilio writes account SIDs.
pub fn is_account_sid(account_sid: &str) -> bool {
    account_sid.strip_prefix("AC").is_some_and(|hex_digits| {
        hex_digits.len() == 32 && hex_digits.chars().all(|digit| digit.is_ascii_hexdigit())
    })
}

/// A new account SID: `AC` and 32 hex digits.
pub fn generate_account_sid(operation_context: &OperationContext) -> String {
    format!("AC{}", generate_hex_32(operation_context))
}

/// A new auth token: 32 hex digits, as Twilio issues them.
pub fn generate_auth_token(operation_context: &OperationContext) -> String {
    generate_hex_32(operation_context)
}

fn generate_hex_32(operation_context: &OperationContext) -> String {
    let random_source = &operation_context.random_source;
    format!(
        "{:016x}{:016x}",
        random_source.next_u64(),
        random_source.next_u64()
    )
}

/// The subaccount as it will be stored. A token sent back empty or masked keeps the stored
/// one, so a form that never revealed it does not overwrite it; a new subaccount without a
/// token gets a generated one.
pub fn build_subaccount(
    operation_context: &OperationContext,
    account_sid: String,
    changes: TwilioSubaccountChanges,
    existing_subaccount: Option<TwilioSubaccountRecord>,
) -> Result<TwilioSubaccountRecord, OperationError> {
    let friendly_name = changes.friendly_name.trim().to_owned();
    if friendly_name.is_empty() {
        return Err(field_error("friendly_name", "Enter a name"));
    }
    let debugger_url = read_optional_url("debugger_url", changes.debugger_url)?;
    let sent_token = changes
        .auth_token
        .map(|auth_token| auth_token.trim().to_owned())
        .filter(|auth_token| !auth_token.is_empty());
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let (auth_token, created_by, created_at_unix_ms) = match existing_subaccount {
        Some(existing_subaccount) => {
            let is_unchanged = sent_token.as_deref().is_none_or(|auth_token| {
                auth_token == mask_secret_value(&existing_subaccount.auth_token)
            });
            (
                if is_unchanged {
                    existing_subaccount.auth_token
                } else {
                    sent_token.unwrap_or_default()
                },
                existing_subaccount.created_by,
                existing_subaccount.created_at_unix_ms,
            )
        }
        None => (
            sent_token.unwrap_or_else(|| generate_auth_token(operation_context)),
            operation_context.request.client.as_str().to_owned(),
            now_unix_ms,
        ),
    };
    Ok(TwilioSubaccountRecord {
        account_sid,
        friendly_name,
        auth_token,
        status: changes.status.as_str().to_owned(),
        debugger_url,
        created_by,
        created_at_unix_ms,
        updated_at_unix_ms: now_unix_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_account_sid_is_ac_and_32_hex_digits() {
        assert!(is_account_sid("AC22222222222222222222222222222222"));
        assert!(!is_account_sid("AC0123"));
        assert!(!is_account_sid("MG0123456789abcdef0123456789abcdef"));
        assert!(!is_account_sid("AC2222222222222222222222222222222g"));
    }
}
