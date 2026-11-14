//! The requests a simulation would send, shown before it fires (WH-14.1): each endpoint's
//! request rendered for the event as a delivery renders it, with nothing stored or sent.

use sendmock_store::WebhookEndpointRecord;

use super::delivery_queue::DeliveryTrigger;
use super::delivery_request_plan::DeliveryRequestPlan;
use super::delivery_request_rendering::render_delivery_request;
use super::delivery_template_context::DeliveryContextDetails;
use super::rule_match_wire::MatchedWebhookRequest;
use super::secret_value_masking::{load_secret_values, mask_request_secrets};
use super::template_context::{ChosenMessage, build_sample_subject, find_template_subject};
use crate::{AppEvent, OperationContext, OperationError};

/// The message the event is about, by the area of its type; none for the others.
fn choose_subject_message<'message>(
    event_type: &str,
    subject_id: &'message str,
) -> Option<ChosenMessage<'message>> {
    if event_type.starts_with("email.") {
        Some(ChosenMessage {
            email_id: Some(subject_id),
            ..ChosenMessage::default()
        })
    } else if event_type.starts_with("sms.") {
        Some(ChosenMessage {
            sms_id: Some(subject_id),
            ..ChosenMessage::default()
        })
    } else if event_type.starts_with("payment.") || event_type.starts_with("checkout.") {
        Some(ChosenMessage {
            payment_id: Some(subject_id),
            ..ChosenMessage::default()
        })
    } else {
        None
    }
}

/// The event about to fire: the subject's data under the event's type, or the built-in sample
/// of the type for a message that does not exist (yet).
pub async fn build_matched_event(
    operation_context: &OperationContext,
    event_type: &str,
    subject_id: Option<&str>,
) -> Result<AppEvent, OperationError> {
    let chosen_message =
        subject_id.and_then(|subject_id| choose_subject_message(event_type, subject_id));
    let found_subject = match chosen_message {
        Some(chosen_message) => {
            match find_template_subject(operation_context, chosen_message).await {
                Ok(template_subject) => Some(template_subject),
                Err(OperationError::NotFound { .. }) => None,
                Err(other_error) => return Err(other_error),
            }
        }
        None => None,
    };
    let mut matched_event = found_subject
        .unwrap_or_else(|| build_sample_subject(event_type))
        .app_event;
    matched_event.id = format!("evt_{}", operation_context.id_generator.generate_id());
    matched_event.event_type = event_type.to_owned();
    matched_event.created_at = sendmock_core::format_rfc3339(operation_context.clock.now_unix_ms());
    Ok(matched_event)
}

/// One endpoint's request for the event, with secret values masked.
pub async fn render_matched_request(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    matched_event: &AppEvent,
    rule_id: Option<&str>,
) -> Result<MatchedWebhookRequest, OperationError> {
    let request_plan = DeliveryRequestPlan::from_endpoint(stored_endpoint)?;
    let delivery_id = operation_context.id_generator.generate_id().to_string();
    let request_id = operation_context.id_generator.generate_id().to_string();
    let delivery_trigger = if rule_id.is_some() {
        DeliveryTrigger::Automatic
    } else {
        DeliveryTrigger::Chosen
    };
    let rendered_delivery = render_delivery_request(
        operation_context,
        &DeliveryContextDetails {
            app_event: matched_event,
            endpoint_id: Some(&stored_endpoint.endpoint_id),
            endpoint_name: &stored_endpoint.name,
            endpoint_url: &request_plan.url_template,
            delivery_id: &delivery_id,
            delivery_trigger,
            rule_id,
            request_id: &request_id,
            send_time_values: &serde_json::Map::new(),
        },
        &request_plan.request_settings,
        request_plan.detached_template.as_ref(),
        None,
    )
    .await?;
    let shown_request = mask_request_secrets(
        &rendered_delivery.request,
        &load_secret_values(operation_context).await?,
    );
    Ok(MatchedWebhookRequest {
        endpoint_id: stored_endpoint.endpoint_id.clone(),
        endpoint_name: stored_endpoint.name.clone(),
        event_type: matched_event.event_type.clone(),
        method: shown_request.method,
        url: shown_request.url,
        headers: shown_request.headers,
        body: shown_request.body,
        problems: rendered_delivery.problems,
    })
}
