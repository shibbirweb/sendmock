//! A route's request, queued as a webhook delivery so it is retried, logged and replayable
//! like any other (WH-12.4).

use sendmock_store::{InboundRouteRecord, WebhookDeliveryRecord};

use super::mailgun_route_request::{MailgunRouteDetails, build_mailgun_route_request};
use super::route_runner::RoutedEmail;
use crate::webhooks::queue_first_attempt;
use crate::{OperationContext, OperationError};

/// The default endpoint policy: 5xx, timeouts and connection errors are retried, a 4xx (and
/// so Mailgun's `406`, "do not retry") is final.
const ROUTE_RETRY_POLICY_JSON: &str =
    r#"{"max_attempts":5,"backoff_seconds":[1,5,30,120,600],"retry_on_client_errors":false}"#;
/// Signs route requests when no `mailgun_signing_key` variable is set.
const DEFAULT_SIGNING_KEY: &str = "key-sendmock";

/// The global `mailgun_signing_key` variable, which the Mailgun templates sign with too.
async fn read_signing_key(operation_context: &OperationContext) -> Result<String, OperationError> {
    Ok(operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?
        .into_iter()
        .find(|variable| variable.name == "mailgun_signing_key" && variable.endpoint_id.is_none())
        .map_or_else(|| DEFAULT_SIGNING_KEY.to_owned(), |variable| variable.value))
}

/// Where `GET` reads a stored message back, on the provider port when there is one.
fn build_message_url(operation_context: &OperationContext, email_id: &str) -> String {
    let instance_details = &operation_context.instance_details;
    match &instance_details.provider_address {
        Some(provider_address) => {
            format!("http://{provider_address}/v3/domains/inbound/messages/{email_id}")
        }
        None => format!(
            "http://{}/providers/mailgun/v3/domains/inbound/messages/{email_id}",
            instance_details.http_address
        ),
    }
}

pub async fn queue_route_delivery(
    operation_context: &OperationContext,
    routed_email: &RoutedEmail,
    stored_route: &InboundRouteRecord,
    target_url: &str,
    route_match: &sendmock_mail::RouteFilterMatch,
    is_store_notification: bool,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let random_source = &operation_context.random_source;
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let stored_email = &routed_email.stored_email;
    let signing_key = read_signing_key(operation_context).await?;
    let request = build_mailgun_route_request(
        stored_email,
        &MailgunRouteDetails {
            url: target_url,
            recipient: &route_match.matched_value,
            signing_key: &signing_key,
            timestamp_seconds: now_unix_ms / 1_000,
            random_words: [
                random_source.next_u64(),
                random_source.next_u64(),
                random_source.next_u64(),
                random_source.next_u64(),
            ],
            message_url: is_store_notification
                .then(|| build_message_url(operation_context, &stored_email.email_id)),
            raw_message: &routed_email.raw_message,
            attachments: &routed_email.attachments,
            attachment_url_base: format!(
                "http://{}/api/v1/emails/{}/attachments",
                operation_context.instance_details.http_address, stored_email.email_id
            ),
        },
    );
    let route_delivery =
        build_route_delivery(operation_context, routed_email, stored_route, &request)?;
    queue_first_attempt(operation_context, route_delivery).await
}

fn build_route_delivery(
    operation_context: &OperationContext,
    routed_email: &RoutedEmail,
    stored_route: &InboundRouteRecord,
    request: &crate::sms::RecordedHttpRequest,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let route_name = if stored_route.description.is_empty() {
        "untitled"
    } else {
        &stored_route.description
    };
    Ok(WebhookDeliveryRecord {
        delivery_id: operation_context.id_generator.generate_id().to_string(),
        endpoint_id: stored_route.route_id.clone(),
        endpoint_name: format!("Route: {route_name}"),
        rule_id: None,
        event_id: routed_email.inbound_event.id.clone(),
        event_type: routed_email.inbound_event.event_type.clone(),
        event_json: serde_json::to_string(&routed_email.inbound_event).ok(),
        subject_id: Some(routed_email.stored_email.email_id.clone()),
        trigger: "auto".to_owned(),
        attempt: 1,
        status: "pending".to_owned(),
        retry_policy_json: ROUTE_RETRY_POLICY_JSON.to_owned(),
        rendered_request_json: Some(
            serde_json::to_string(request)
                .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        ),
        sent_request_json: None,
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: Some(now_unix_ms),
        created_at_unix_ms: now_unix_ms,
        is_signed: false,
    })
}
