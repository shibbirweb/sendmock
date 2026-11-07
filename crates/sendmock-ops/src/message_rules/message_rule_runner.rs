//! Tag and forward rules on each arriving email, in position order (EM-12.3, EM-14.3).

use sendmock_store::{EmailRecord, MessageRuleRecord, TimelineRecord};
use sendmock_webhooks::{FilterExpression, RuleMessage};

use crate::email::{is_on_allowlist, release_email};
use crate::webhooks::{RuleFilter, build_email_rule_message};
use crate::{OperationContext, OperationError};

/// An enabled rule whose filter passes the email; no filter passes every email.
fn does_rule_match(rule_record: &MessageRuleRecord, rule_message: &RuleMessage) -> bool {
    rule_record.is_enabled
        && match &rule_record.filter_json {
            None => true,
            Some(filter_json) => serde_json::from_str::<RuleFilter>(filter_json)
                .ok()
                .is_some_and(|rule_filter| {
                    FilterExpression::from(&rule_filter).matches(rule_message)
                }),
        }
}

/// Adds each matching tag rule's tag once; answers the email with its new tags when a rule
/// added one, so `email.received` already carries them.
pub async fn apply_tag_rules(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<Option<EmailRecord>, OperationError> {
    let tag_rules = operation_context
        .email_stores
        .tag_rules
        .list_rules()
        .await?;
    let rule_message = build_email_rule_message(stored_email);
    let mut tags = stored_email.tags.clone();
    for tag_rule in tag_rules
        .iter()
        .filter(|tag_rule| does_rule_match(tag_rule, &rule_message))
    {
        if !tags.contains(&tag_rule.action) {
            tags.push(tag_rule.action.clone());
        }
    }
    if tags == stored_email.tags {
        return Ok(None);
    }
    Ok(operation_context
        .email_repository
        .update_read_and_tags(&stored_email.email_id, None, Some(tags))
        .await?)
}

/// Releases the email by each matching forward rule, in a background task so a slow relay
/// never holds up the SMTP session or the send that stored it.
pub async fn start_forward_rules(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<(), OperationError> {
    let rule_message = build_email_rule_message(stored_email);
    let matching_rules: Vec<MessageRuleRecord> = operation_context
        .email_stores
        .forward_rules
        .list_rules()
        .await?
        .into_iter()
        .filter(|forward_rule| does_rule_match(forward_rule, &rule_message))
        .collect();
    if matching_rules.is_empty() {
        return Ok(());
    }
    let operation_context = operation_context.clone();
    let stored_email = stored_email.clone();
    tokio::spawn(async move {
        for forward_rule in matching_rules {
            if let Err(forward_error) =
                forward_by_rule(&operation_context, &stored_email, &forward_rule).await
            {
                tracing::warn!(error = %forward_error, rule = %forward_rule.name, "auto-forward failed");
            }
        }
    });
    Ok(())
}

/// Sends to the rule's allowlisted addresses; with no relay or none of them allowed, the
/// timeline says why nothing was sent.
async fn forward_by_rule(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
    forward_rule: &MessageRuleRecord,
) -> Result<(), OperationError> {
    let app_settings = operation_context.settings_store.current().await?;
    let rule_addresses: Vec<String> =
        serde_json::from_str(&forward_rule.action).unwrap_or_default();
    let allowed_addresses: Vec<String> = rule_addresses
        .into_iter()
        .filter(|address| is_on_allowlist(&app_settings.relay_recipient_allowlist, address))
        .collect();
    let is_release_on = app_settings.relay_smtp_url.is_some()
        && operation_context.email_network_clients.relay.is_some();
    if allowed_addresses.is_empty() || !is_release_on {
        operation_context
            .email_repository
            .add_timeline_entry(
                &stored_email.email_id,
                TimelineRecord {
                    kind: "released".to_owned(),
                    happened_at_unix_ms: operation_context.clock.now_unix_ms(),
                    detail: format!(
                        "Not forwarded by rule {}: no relay, or no address on the allowlist",
                        forward_rule.name
                    ),
                },
            )
            .await?;
        return Ok(());
    }
    release_email(
        operation_context,
        stored_email,
        &allowed_addresses,
        &format!("rule {}", forward_rule.name),
    )
    .await
    .map(|_| ())
}
