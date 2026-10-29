use std::collections::BTreeMap;

use sendmock_store::{WebhookDeliveryRecord, WebhookEndpointRecord};

use super::endpoint_view::read_request_settings;
use crate::{AppEvent, OperationContext, OperationError, RecordedHttpRequest};

/// Why a delivery was made.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryTrigger {
    /// A rule matched an event.
    Automatic,
    /// Sent by hand: Send test, Send to webhook, the composer.
    Manual,
    Replay,
}

impl DeliveryTrigger {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Automatic => "auto",
            Self::Manual => "manual",
            Self::Replay => "replay",
        }
    }
}

/// What a delivery carries and why it was made.
#[derive(Debug, Clone, PartialEq)]
pub struct DeliveryOrder {
    pub app_event: AppEvent,
    /// The email or SMS that caused the event.
    pub subject_id: Option<String>,
    pub rule_id: Option<String>,
    pub delivery_trigger: DeliveryTrigger,
}

/// The native Standard Webhooks request: the event envelope as JSON, sent with the endpoint's
/// method and static headers. Templates, variables, query params and body modes render here
/// from W4 and W5 on.
fn render_native_request(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    app_event: &AppEvent,
) -> Result<RecordedHttpRequest, OperationError> {
    let request_settings = read_request_settings(stored_endpoint)?;
    let mut headers: BTreeMap<String, String> = BTreeMap::from([
        ("content-type".to_owned(), "application/json".to_owned()),
        (
            "user-agent".to_owned(),
            format!("sendmock/{}", operation_context.instance_details.version),
        ),
    ]);
    headers.extend(
        request_settings
            .headers
            .into_iter()
            .map(|(header_name, header_value)| (header_name.to_ascii_lowercase(), header_value)),
    );
    let method = serde_json::to_value(request_settings.method)
        .ok()
        .and_then(|method| method.as_str().map(str::to_owned))
        .unwrap_or_else(|| "POST".to_owned());
    Ok(RecordedHttpRequest {
        method,
        url: stored_endpoint.url.clone(),
        headers,
        body: serde_json::to_string(app_event)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
    })
}

/// Queues the first attempt of a delivery, due at once, and wakes the dispatcher. Never waits
/// for the send, so ingest stays fast (WH-03.1).
pub async fn enqueue_webhook_delivery(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    delivery_order: DeliveryOrder,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let request_settings = read_request_settings(stored_endpoint)?;
    let rendered_request = render_native_request(
        operation_context,
        stored_endpoint,
        &delivery_order.app_event,
    )?;
    let new_delivery = WebhookDeliveryRecord {
        delivery_id: operation_context.id_generator.generate_id().to_string(),
        endpoint_id: stored_endpoint.endpoint_id.clone(),
        endpoint_name: stored_endpoint.name.clone(),
        rule_id: delivery_order.rule_id,
        event_id: delivery_order.app_event.id.clone(),
        event_type: delivery_order.app_event.event_type.clone(),
        subject_id: delivery_order.subject_id,
        trigger: delivery_order.delivery_trigger.as_str().to_owned(),
        attempt: 1,
        status: "pending".to_owned(),
        retry_policy_json: serde_json::to_string(&request_settings.retry_policy)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        rendered_request_json: Some(
            serde_json::to_string(&rendered_request)
                .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        ),
        sent_request_json: None,
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: Some(now_unix_ms),
        created_at_unix_ms: now_unix_ms,
    };
    operation_context
        .webhook_delivery_repository
        .insert_delivery(new_delivery.clone())
        .await?;
    operation_context.webhook_dispatch_signal.notify_one();
    Ok(new_delivery)
}
