//! Sending a captured email on to real inboxes through the relay, for release and
//! auto-forward rules.

use sendmock_core::matches_wildcard_pattern;
use sendmock_mail::decompress_raw_message;
use sendmock_store::{EmailRecord, TimelineRecord};
use serde_json::json;

use super::email_relay::RelayMessage;
use super::email_summary::EmailSummary;
use crate::settings::mask_url_password;
use crate::{AppEventType, OperationContext, OperationError, publish_event};

/// What the relay answered for one release.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReleaseResult {
    pub is_sent: bool,
    /// The relay's last reply, or why nothing was sent.
    pub relay_reply: String,
}

/// The relay URL and the allowlist, when both are set; release stays off otherwise.
async fn read_relay_settings(
    operation_context: &OperationContext,
) -> Result<(String, Vec<String>), OperationError> {
    let app_settings = operation_context.settings_store.current().await?;
    match app_settings.relay_smtp_url {
        Some(relay_url)
            if !app_settings.relay_recipient_allowlist.is_empty()
                && operation_context.email_network_clients.relay.is_some() =>
        {
            Ok((relay_url, app_settings.relay_recipient_allowlist))
        }
        _ => Err(OperationError::Conflict {
            code: "release_off",
            message: "Release is off: set a relay SMTP URL and at least one allowlist pattern in Settings > Email".to_owned(),
        }),
    }
}

/// Allowlist patterns are globs that ignore case.
pub fn is_on_allowlist(allowlist: &[String], recipient_address: &str) -> bool {
    let recipient_address = recipient_address.to_lowercase();
    allowlist.iter().any(|allowed_pattern| {
        matches_wildcard_pattern(&allowed_pattern.to_lowercase(), &recipient_address)
    })
}

/// Sends the stored message as it arrived to `recipients`, every one of which must be on the
/// allowlist, then logs the result on the timeline and fires `email.released`.
pub async fn release_email(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
    recipients: &[String],
    released_by: &str,
) -> Result<ReleaseResult, OperationError> {
    let (relay_url, allowlist) = read_relay_settings(operation_context).await?;
    let refused_recipients: Vec<&str> = recipients
        .iter()
        .filter(|recipient| !is_on_allowlist(&allowlist, recipient))
        .map(String::as_str)
        .collect();
    if !refused_recipients.is_empty() {
        return Err(OperationError::InvalidInput {
            message: format!(
                "Not on the relay allowlist: {}",
                refused_recipients.join(", ")
            ),
            field: Some("to".to_owned()),
        });
    }
    let raw_message = read_raw_message(operation_context, &stored_email.email_id).await?;
    let relayed = match &operation_context.email_network_clients.relay {
        Some(email_relay) => {
            email_relay
                .relay_message(RelayMessage {
                    relay_url: &relay_url,
                    mail_from: &stored_email.envelope_from,
                    recipients,
                    raw_message: &raw_message,
                })
                .await
        }
        None => Err("no relay client in this build".to_owned()),
    };
    let release_result = ReleaseResult {
        is_sent: relayed.is_ok(),
        relay_reply: relayed.unwrap_or_else(|relay_error| relay_error),
    };
    record_release(
        operation_context,
        stored_email,
        recipients,
        &release_result,
        &format!("{released_by} through {}", mask_url_password(&relay_url)),
    )
    .await?;
    Ok(release_result)
}

async fn read_raw_message(
    operation_context: &OperationContext,
    email_id: &str,
) -> Result<Vec<u8>, OperationError> {
    let compressed_raw_message = operation_context
        .email_repository
        .read_compressed_raw_message(email_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No email with id {email_id}"),
        })?;
    decompress_raw_message(&compressed_raw_message)
        .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))
}

/// A `released` timeline entry with the relay's answer, and `email.released` with the email
/// as the list shows it, the recipients and whether the relay took it.
async fn record_release(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
    recipients: &[String],
    release_result: &ReleaseResult,
    released_through: &str,
) -> Result<(), OperationError> {
    let recipient_list = recipients.join(", ");
    let detail = if release_result.is_sent {
        format!(
            "Released to {recipient_list} by {released_through}: {}",
            release_result.relay_reply
        )
    } else {
        format!(
            "Release to {recipient_list} by {released_through} failed: {}",
            release_result.relay_reply
        )
    };
    operation_context
        .email_repository
        .add_timeline_entry(
            &stored_email.email_id,
            TimelineRecord {
                kind: "released".to_owned(),
                happened_at_unix_ms: operation_context.clock.now_unix_ms(),
                detail,
            },
        )
        .await?;
    let mut event_data = serde_json::to_value(EmailSummary::from(stored_email)).unwrap_or_default();
    if let Some(data_fields) = event_data.as_object_mut() {
        data_fields.extend([
            ("released_to".to_owned(), json!(recipients)),
            ("is_sent".to_owned(), json!(release_result.is_sent)),
            ("relay_reply".to_owned(), json!(release_result.relay_reply)),
        ]);
    }
    publish_event(operation_context, AppEventType::EmailReleased, event_data);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_allowlist_matches_globs_without_case() {
        let allowlist = vec![
            "*@QA.example.test".to_owned(),
            "lead@example.test".to_owned(),
        ];

        assert!(is_on_allowlist(&allowlist, "sam@qa.example.test"));
        assert!(is_on_allowlist(&allowlist, "Lead@Example.test"));
        assert!(!is_on_allowlist(&allowlist, "sam@example.test"));
    }
}
