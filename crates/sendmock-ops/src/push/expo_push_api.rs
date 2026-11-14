//! Expo's push API, as `expo-server-sdk` 8 calls it: `POST /--/api/v2/push/send` with one
//! message or a list, answered with a ticket per recipient, and `POST
//! /--/api/v2/push/getReceipts` with `{ ids }`, answered with a receipt per known ticket.

use sendmock_core::template::generate_uuid_v4;
use serde_json::{Map, Value, json};

use super::magic_push_tokens::{PushTokenFailure, read_push_token_failure};
use super::push_store::{NewPushNotification, store_push_notification};
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, answer_json};
use crate::{OperationContext, OperationError};

const EXPO_SEND_PATH: &str = "/--/api/v2/push/send";
const EXPO_RECEIPTS_PATH: &str = "/--/api/v2/push/getReceipts";

/// Expo's request-level error, which the SDK turns into a thrown error with `code`.
fn answer_expo_validation_error(message: &str) -> ProviderHttpResponse {
    answer_json(
        400,
        json!({
            "errors": [{
                "code": "VALIDATION_ERROR",
                "message": message,
                "isTransient": false,
            }]
        }),
    )
}

fn read_text(message: &Value, pointer: &str) -> Option<String> {
    message
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::to_owned)
}

/// Each recipient of a message: one token, or each token of a list.
fn read_recipients(message: &Value) -> Option<Vec<String>> {
    match &message["to"] {
        Value::String(push_token) => Some(vec![push_token.clone()]),
        Value::Array(push_tokens) if !push_tokens.is_empty() => push_tokens
            .iter()
            .map(|push_token| push_token.as_str().map(str::to_owned))
            .collect(),
        _ => None,
    }
}

/// The messages of the request, or the validation message for the first one Expo would refuse.
fn read_messages(request_body: &Value) -> Result<Vec<(Value, Vec<String>)>, String> {
    let messages = match request_body {
        Value::Array(messages) => messages.clone(),
        Value::Object(_) => vec![request_body.clone()],
        _ => return Err("\"value\" must be an object or an array.".to_owned()),
    };
    messages
        .into_iter()
        .enumerate()
        .map(|(message_index, message)| match read_recipients(&message) {
            Some(recipients) => Ok((message, recipients)),
            None => Err(format!("\"[{message_index}].to\" is required.")),
        })
        .collect()
}

fn build_expo_notification(message: &Value, push_token: String) -> NewPushNotification {
    NewPushNotification {
        provider: "expo",
        device_token: push_token,
        title: read_text(message, "/title"),
        body: read_text(message, "/body"),
        image_url: read_text(message, "/richContent/image"),
        data: message.get("data").cloned().unwrap_or_else(|| json!({})),
        request: message.clone(),
        response_status: 200,
        ..NewPushNotification::default()
    }
}

/// The error ticket Expo gives a magic token's recipient: its error code and the ticket.
fn build_error_ticket(push_token: &str, token_failure: PushTokenFailure) -> (&'static str, Value) {
    let (error_code, message) = match token_failure {
        PushTokenFailure::Unregistered => (
            "DeviceNotRegistered",
            format!("\"{push_token}\" is not a registered push notification recipient"),
        ),
        PushTokenFailure::Invalid => (
            "DeviceNotRegistered",
            format!("\"{push_token}\" is not a valid Expo push token"),
        ),
        PushTokenFailure::Throttled => (
            "MessageRateExceeded",
            format!("\"{push_token}\" is receiving too many notifications"),
        ),
    };
    let ticket = json!({
        "status": "error",
        "message": message,
        "details": { "error": error_code, "expoPushToken": push_token },
    });
    (error_code, ticket)
}

/// One recipient's ticket and the notification stored for it.
async fn issue_ticket(
    operation_context: &OperationContext,
    message: &Value,
    push_token: String,
) -> Result<Value, OperationError> {
    let (provider_message_id, error_reason, ticket) = match read_push_token_failure(&push_token) {
        Some(token_failure) => {
            let (error_code, ticket) = build_error_ticket(&push_token, token_failure);
            (String::new(), Some(error_code.to_owned()), ticket)
        }
        None => {
            let ticket_id = generate_uuid_v4(operation_context.random_source.as_ref());
            let ticket = json!({ "status": "ok", "id": ticket_id });
            (ticket_id, None, ticket)
        }
    };
    let expo_notification = NewPushNotification {
        provider_message_id,
        error_reason,
        response: ticket.clone(),
        ..build_expo_notification(message, push_token)
    };
    store_push_notification(operation_context, expo_notification).await?;
    Ok(ticket)
}

/// Answers a send: every recipient gets a ticket, in order, and a stored notification.
async fn answer_expo_send(
    operation_context: &OperationContext,
    request_body: &Value,
) -> Result<ProviderHttpResponse, OperationError> {
    let messages = match read_messages(request_body) {
        Ok(messages) => messages,
        Err(validation_message) => return Ok(answer_expo_validation_error(&validation_message)),
    };
    let mut tickets = Vec::new();
    for (message, recipients) in messages {
        for push_token in recipients {
            tickets.push(issue_ticket(operation_context, &message, push_token).await?);
        }
    }
    let is_single_ticket = request_body.is_object() && tickets.len() == 1;
    let ticket_data = if is_single_ticket {
        tickets.remove(0)
    } else {
        Value::Array(tickets)
    };
    Ok(answer_json(200, json!({ "data": ticket_data })))
}

/// The receipt of a stored ticket: `ok`, or the ticket's own error when it failed.
fn build_receipt(stored_ticket: &Value) -> Value {
    match stored_ticket["status"].as_str() {
        Some("error") => stored_ticket.clone(),
        _ => json!({ "status": "ok" }),
    }
}

/// Answers receipts for the tickets SendMock issued; unknown ids are left out, as Expo does.
async fn answer_expo_receipts(
    operation_context: &OperationContext,
    request_body: &Value,
) -> Result<ProviderHttpResponse, OperationError> {
    let Some(ticket_ids) = request_body["ids"].as_array() else {
        return Ok(answer_expo_validation_error("\"ids\" is required."));
    };
    let mut receipts = Map::new();
    for ticket_id in ticket_ids.iter().filter_map(Value::as_str) {
        let stored_notification = operation_context
            .push_notifications
            .find_by_provider_message_id("expo", ticket_id)
            .await?;
        if let Some(stored_notification) = stored_notification {
            let stored_ticket: Value =
                serde_json::from_str(&stored_notification.response_json).unwrap_or(Value::Null);
            receipts.insert(ticket_id.to_owned(), build_receipt(&stored_ticket));
        }
    }
    Ok(answer_json(200, json!({ "data": receipts })))
}

/// Answers an Expo push request, or `None` when the request is not one.
pub async fn answer_expo_push(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    if request.method != "POST" {
        return Ok(None);
    }
    let request_body: Value = serde_json::from_slice(&request.body).unwrap_or(Value::Null);
    match request.path.as_str() {
        EXPO_SEND_PATH => Ok(Some(
            answer_expo_send(operation_context, &request_body).await?,
        )),
        EXPO_RECEIPTS_PATH => Ok(Some(
            answer_expo_receipts(operation_context, &request_body).await?,
        )),
        _ => Ok(None),
    }
}
