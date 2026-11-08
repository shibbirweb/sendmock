use serde_json::{Value, json};

use super::paypal_call::{PayPalAnswer, PayPalCall, PayPalReply};
use super::paypal_error::{PayPalApi, PayPalError};
use crate::{OperationError, RecordedHttpRequest};

const NOTIFICATIONS: PayPalApi = PayPalApi::Notifications;
const REQUIRED_FIELDS: [&str; 7] = [
    "auth_algo",
    "cert_url",
    "transmission_id",
    "transmission_sig",
    "transmission_time",
    "webhook_id",
    "webhook_event",
];
/// Each transmission header with the request field that must repeat it.
const TRANSMISSION_HEADERS: [(&str, &str); 4] = [
    ("paypal-transmission-time", "transmission_time"),
    ("paypal-transmission-sig", "transmission_sig"),
    ("paypal-cert-url", "cert_url"),
    ("paypal-auth-algo", "auth_algo"),
];
/// A transmission id is a UUID, so more than a few deliveries carrying it means replays.
const MAXIMUM_CANDIDATES: u32 = 20;

fn is_missing(field_value: Option<&Value>) -> bool {
    match field_value {
        None | Some(Value::Null) => true,
        Some(Value::String(field_text)) => field_text.trim().is_empty(),
        Some(_) => false,
    }
}

fn read_header<'request>(
    rendered_request: &'request RecordedHttpRequest,
    header_name: &str,
) -> Option<&'request str> {
    rendered_request
        .headers
        .iter()
        .find(|(stored_name, _)| stored_name.eq_ignore_ascii_case(header_name))
        .map(|(_, header_value)| header_value.as_str())
}

/// Whether the delivery is the one the app describes: its transmission headers, its endpoint
/// as the webhook and its body as the event, compared as JSON because SDKs serialize it again.
fn is_described_delivery(
    endpoint_id: &str,
    rendered_request: &RecordedHttpRequest,
    verification_request: &Value,
) -> bool {
    let read_field = |field_name: &str| verification_request[field_name].as_str();
    let has_same_headers = read_header(rendered_request, "paypal-transmission-id")
        == read_field("transmission_id")
        && TRANSMISSION_HEADERS
            .iter()
            .all(|(header_name, field_name)| {
                read_header(rendered_request, header_name) == read_field(field_name)
            });
    let delivered_event = serde_json::from_str::<Value>(&rendered_request.body).ok();
    has_same_headers
        && read_field("webhook_id") == Some(endpoint_id)
        && delivered_event.as_ref() == Some(&verification_request["webhook_event"])
}

/// `POST /v1/notifications/verify-webhook-signature`: `SUCCESS` when SendMock sent exactly
/// this event with these headers to this webhook, as PayPal checks its own signature.
pub async fn verify_webhook_signature(paypal_call: &PayPalCall<'_>) -> PayPalAnswer {
    let verification_request = paypal_call.read_body(NOTIFICATIONS)?;
    if let Some(missing_field) = REQUIRED_FIELDS
        .iter()
        .find(|field_name| is_missing(verification_request.get(**field_name)))
    {
        return Err(PayPalError::missing_field(
            NOTIFICATIONS,
            &format!("/{missing_field}"),
        ));
    }
    let transmission_id = verification_request["transmission_id"]
        .as_str()
        .unwrap_or_default();
    let candidate_deliveries = paypal_call
        .operation_context
        .webhook_delivery_repository
        .list_first_attempts_containing(transmission_id, MAXIMUM_CANDIDATES)
        .await
        .map_err(OperationError::from)?;
    let is_genuine = candidate_deliveries.iter().any(|candidate_delivery| {
        candidate_delivery
            .rendered_request_json
            .as_deref()
            .and_then(|request_json| serde_json::from_str(request_json).ok())
            .is_some_and(|rendered_request| {
                is_described_delivery(
                    &candidate_delivery.endpoint_id,
                    &rendered_request,
                    verification_request,
                )
            })
    });
    Ok(PayPalReply {
        status: 200,
        body: json!({"verification_status": if is_genuine { "SUCCESS" } else { "FAILURE" }}),
    })
}
