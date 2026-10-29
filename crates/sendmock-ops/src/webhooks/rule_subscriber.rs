use sendmock_store::WebhookRuleRecord;
use sendmock_webhooks::{FilterExpression, RuleMessage};
use tokio::sync::broadcast::error::RecvError;

use super::delivery_queue::{DeliveryOrder, DeliveryTrigger, enqueue_webhook_delivery};
use super::rule_messages::{build_email_rule_message, build_sms_rule_message};
use super::rule_view::{read_rule_events, read_rule_filter};
use crate::{AppEvent, OperationContext, OperationError};

/// Drives the live deliveries log only; a rule on it would loop.
const UNRULED_EVENT_TYPE: &str = "webhook.delivered";

/// The email or SMS an event is about, with the fields filters read. Events about something
/// else, or about a message that is gone, have no fields, so only filterless rules fire.
async fn load_event_subject(
    operation_context: &OperationContext,
    app_event: &AppEvent,
) -> Result<(Option<String>, RuleMessage), OperationError> {
    let Some(subject_id) = app_event.data["id"].as_str().map(str::to_owned) else {
        return Ok((None, RuleMessage::default()));
    };
    if app_event.event_type.starts_with("email.") {
        let stored_email = operation_context
            .email_repository
            .find_email(&subject_id)
            .await?;
        return Ok((
            Some(subject_id),
            stored_email
                .as_ref()
                .map(build_email_rule_message)
                .unwrap_or_default(),
        ));
    }
    if app_event.event_type.starts_with("sms.") {
        let stored_sms = operation_context
            .sms_repository
            .find_message(&subject_id)
            .await?;
        return Ok((
            Some(subject_id),
            stored_sms
                .as_ref()
                .map(build_sms_rule_message)
                .unwrap_or_default(),
        ));
    }
    Ok((None, RuleMessage::default()))
}

/// Whether an enabled rule listens to the event and its filter passes the message.
fn does_rule_fire(
    stored_rule: &WebhookRuleRecord,
    event_type: &str,
    rule_message: &RuleMessage,
) -> Result<bool, OperationError> {
    if !stored_rule.is_enabled
        || !read_rule_events(stored_rule)?
            .iter()
            .any(|rule_event| rule_event == event_type)
    {
        return Ok(false);
    }
    Ok(read_rule_filter(stored_rule)?
        .as_ref()
        .map(FilterExpression::from)
        .is_none_or(|filter_expression| filter_expression.matches(rule_message)))
}

/// Queues one delivery per enabled rule that fires, in rule order, to enabled endpoints
/// (WH-02.1, WH-02.4). Answers how many were queued.
pub async fn fire_matching_rules(
    operation_context: &OperationContext,
    app_event: &AppEvent,
) -> Result<usize, OperationError> {
    if app_event.event_type == UNRULED_EVENT_TYPE {
        return Ok(0);
    }
    let stored_rules = operation_context
        .webhook_rule_repository
        .list_rules()
        .await?;
    if !stored_rules
        .iter()
        .any(|stored_rule| stored_rule.is_enabled)
    {
        return Ok(0);
    }
    let (subject_id, rule_message) = load_event_subject(operation_context, app_event).await?;
    let mut queued_count = 0;
    for stored_rule in stored_rules {
        if !does_rule_fire(&stored_rule, &app_event.event_type, &rule_message)? {
            continue;
        }
        let Some(stored_endpoint) = operation_context
            .webhook_endpoint_repository
            .find_endpoint(&stored_rule.endpoint_id)
            .await?
            .filter(|stored_endpoint| stored_endpoint.is_enabled)
        else {
            continue;
        };
        let delivery_order = DeliveryOrder {
            app_event: app_event.clone(),
            subject_id: subject_id.clone(),
            rule_id: Some(stored_rule.rule_id),
            delivery_trigger: DeliveryTrigger::Automatic,
        };
        enqueue_webhook_delivery(operation_context, &stored_endpoint, delivery_order).await?;
        queued_count += 1;
    }
    Ok(queued_count)
}

/// Listens to the event bus until it closes, firing rules for each event. Ingest only
/// publishes, so it never waits for rules or deliveries (WH-03.1).
pub async fn run_webhook_rule_subscriber(operation_context: OperationContext) {
    let mut event_receiver = operation_context.event_bus.subscribe();
    loop {
        match event_receiver.recv().await {
            Ok(recorded_event) => {
                if let Err(rule_error) =
                    fire_matching_rules(&operation_context, &recorded_event.app_event).await
                {
                    tracing::warn!(error = %rule_error, "could not fire webhook rules");
                }
            }
            Err(RecvError::Lagged(skipped_count)) => {
                tracing::warn!(
                    skipped_count,
                    "webhook rules fell behind and skipped events"
                );
            }
            Err(RecvError::Closed) => return,
        }
    }
}
