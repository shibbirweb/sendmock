use sendmock_webhooks::{FilterExpression, find_first_filter_error};

use super::rule_filter_wire::RuleFilter;
use crate::{OperationContext, OperationError};

/// The events a rule may listen to; `webhook.delivered` drives the live log only, so a rule on
/// it could loop.
pub const RULE_EVENT_TYPES: [&str; 31] = [
    "email.received",
    "email.inbound",
    "email.opened",
    "email.delivered",
    "email.deferred",
    "email.bounced",
    "email.complained",
    "email.unsubscribed",
    "email.released",
    "email.deleted",
    "sms.sent",
    "sms.status",
    "sms.opened",
    "sms.inbound",
    "verify.started",
    "verify.checked",
    "verify.expired",
    "http.captured",
    "payment.created",
    "payment.authorized",
    "payment.succeeded",
    "payment.failed",
    "payment.canceled",
    "payment.refunded",
    "payment.partially_refunded",
    "payment.dispute_opened",
    "payment.dispute_closed",
    "checkout.completed",
    "checkout.expired",
    "webhook.failed",
    "test.ping",
];

fn field_error(field_name: &str, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field_name.to_owned()),
    }
}

pub fn validate_rule_events(events: &[String]) -> Result<(), OperationError> {
    if events.is_empty() {
        return Err(field_error("events", "Pick at least one event".to_owned()));
    }
    match events
        .iter()
        .find(|event_type| !RULE_EVENT_TYPES.contains(&event_type.as_str()))
    {
        Some(unknown_event) => Err(field_error(
            "events",
            format!("{unknown_event} is not an event a rule can listen to"),
        )),
        None => Ok(()),
    }
}

pub fn validate_rule_filter(rule_filter: Option<&RuleFilter>) -> Result<(), OperationError> {
    match rule_filter
        .map(FilterExpression::from)
        .as_ref()
        .and_then(find_first_filter_error)
    {
        Some(filter_problem) => Err(field_error("filter", filter_problem)),
        None => Ok(()),
    }
}

/// The same checks as the rule editor (WH-02.5): a name, an existing endpoint, at least one
/// event a rule can listen to, and complete conditions.
pub async fn validate_rule(
    operation_context: &OperationContext,
    rule_name: &str,
    endpoint_id: &str,
    events: &[String],
    rule_filter: Option<&RuleFilter>,
) -> Result<(), OperationError> {
    if rule_name.trim().is_empty() {
        return Err(field_error("name", "Enter a name".to_owned()));
    }
    let endpoint_exists = operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?
        .is_some();
    if !endpoint_exists {
        return Err(field_error("endpoint_id", "Pick an endpoint".to_owned()));
    }
    validate_rule_events(events)?;
    validate_rule_filter(rule_filter)
}
