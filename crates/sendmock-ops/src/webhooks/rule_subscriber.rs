use sendmock_store::{WebhookEndpointRecord, WebhookRuleRecord};
use sendmock_webhooks::{FilterExpression, RuleMessage};
use tokio::sync::broadcast::error::RecvError;

use super::chosen_delivery::deliver_to_chosen_endpoints;
use super::delivery_queue::{DeliveryOrder, DeliveryTrigger, enqueue_webhook_delivery};
use super::rule_event_subject::{is_ruled_event, load_event_rule_message, read_event_subject_id};
use super::rule_messages::with_engagement_event_fields;
use super::rule_view::{read_rule_events, read_rule_filter};
use crate::{AppEvent, OperationContext, OperationError, RecordedEvent};

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

/// Each enabled rule on the event whose filter passes the message, with its enabled endpoint,
/// in rule order. Dispatch and the match preview both read this (WH-02.1, EM-22.2).
pub async fn find_firing_rules(
    operation_context: &OperationContext,
    stored_rules: Vec<WebhookRuleRecord>,
    event_type: &str,
    rule_message: &RuleMessage,
) -> Result<Vec<(WebhookRuleRecord, WebhookEndpointRecord)>, OperationError> {
    let mut firing_rules = Vec::new();
    for stored_rule in stored_rules {
        if !does_rule_fire(&stored_rule, event_type, rule_message)? {
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
        firing_rules.push((stored_rule, stored_endpoint));
    }
    Ok(firing_rules)
}

/// Queues one delivery per enabled rule that fires, in rule order, to enabled endpoints
/// (WH-02.1, WH-02.4). Answers how many were queued.
pub async fn fire_matching_rules(
    operation_context: &OperationContext,
    app_event: &AppEvent,
) -> Result<usize, OperationError> {
    if !is_ruled_event(&app_event.event_type) {
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
    let subject_id = read_event_subject_id(app_event);
    let stored_message = load_event_rule_message(operation_context, app_event).await?;
    let rule_message = with_engagement_event_fields(stored_message, app_event);
    let firing_rules = find_firing_rules(
        operation_context,
        stored_rules,
        &app_event.event_type,
        &rule_message,
    )
    .await?;
    let queued_count = firing_rules.len();
    for (stored_rule, stored_endpoint) in firing_rules {
        let delivery_order = DeliveryOrder {
            app_event: app_event.clone(),
            subject_id: subject_id.clone(),
            rule_id: Some(stored_rule.rule_id),
            delivery_trigger: DeliveryTrigger::Automatic,
            send_time_values: serde_json::Map::new(),
        };
        enqueue_webhook_delivery(operation_context, &stored_endpoint, delivery_order).await?;
    }
    Ok(queued_count)
}

/// Sends an event to the endpoints its action chose, or else to the rule matches.
pub async fn deliver_recorded_event(
    operation_context: &OperationContext,
    recorded_event: &RecordedEvent,
) -> Result<usize, OperationError> {
    match &recorded_event.webhook_choice {
        Some(webhook_choice) => {
            deliver_to_chosen_endpoints(
                operation_context,
                &recorded_event.app_event,
                webhook_choice,
            )
            .await
        }
        None => fire_matching_rules(operation_context, &recorded_event.app_event).await,
    }
}

/// Listens to the event bus until it closes, firing rules for each event. Ingest only
/// publishes, so it never waits for rules or deliveries (WH-03.1).
pub async fn run_webhook_rule_subscriber(operation_context: OperationContext) {
    let mut event_receiver = operation_context.event_bus.subscribe();
    loop {
        match event_receiver.recv().await {
            Ok(recorded_event) => {
                if let Err(rule_error) =
                    deliver_recorded_event(&operation_context, &recorded_event).await
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
