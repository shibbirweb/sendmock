use super::delivery_queue::{DeliveryOrder, DeliveryTrigger, enqueue_webhook_delivery};
use super::rule_event_subject::{is_ruled_event, read_event_subject_id};
use crate::{AppEvent, OperationContext, OperationError, WebhookChoice};

/// Queues one delivery per chosen endpoint, each with its own template and secret, and none
/// for the rule matches (WH-13.4). An endpoint disabled or deleted since the action was
/// checked is skipped. Answers how many were queued.
pub async fn deliver_to_chosen_endpoints(
    operation_context: &OperationContext,
    app_event: &AppEvent,
    webhook_choice: &WebhookChoice,
) -> Result<usize, OperationError> {
    if !is_ruled_event(&app_event.event_type) {
        return Ok(0);
    }
    let subject_id = read_event_subject_id(app_event);
    let mut queued_count = 0;
    for endpoint_id in &webhook_choice.endpoint_ids {
        let Some(stored_endpoint) = operation_context
            .webhook_endpoint_repository
            .find_endpoint(endpoint_id)
            .await?
            .filter(|stored_endpoint| stored_endpoint.is_enabled)
        else {
            continue;
        };
        let delivery_order = DeliveryOrder {
            app_event: app_event.clone(),
            subject_id: subject_id.clone(),
            rule_id: None,
            delivery_trigger: DeliveryTrigger::Chosen,
            send_time_values: serde_json::Map::new(),
        };
        enqueue_webhook_delivery(operation_context, &stored_endpoint, delivery_order).await?;
        queued_count += 1;
    }
    Ok(queued_count)
}
