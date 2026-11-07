//! The Cloud API's read receipt: `{ status: "read", message_id }` on the messages path.

use sendmock_store::SmsListFilter;
use serde_json::{Value, json};

use super::provider_http::ProviderHttpResponse;
use super::twilio_answers::answer_json;
use super::whatsapp_graph_errors::answer_invalid_parameter;
use crate::{OperationContext, OperationError};

/// Marks the message (and the conversation before it) read, as Meta's blue ticks do.
pub async fn answer_read_receipt(
    operation_context: &OperationContext,
    message: &Value,
) -> Result<ProviderHttpResponse, OperationError> {
    let Some(message_id) = message["message_id"].as_str() else {
        return Ok(answer_invalid_parameter(
            operation_context,
            "The parameter message_id is required.",
        ));
    };
    let found_page = operation_context
        .sms_repository
        .list_messages(
            SmsListFilter {
                provider_id: Some(message_id.to_owned()),
                ..SmsListFilter::default()
            },
            None,
            1,
        )
        .await?;
    let Some(read_message) = found_page.messages.first() else {
        let reason = format!("Message {message_id} was not found.");
        return Ok(answer_invalid_parameter(operation_context, &reason));
    };
    operation_context
        .sms_repository
        .mark_thread_read(&read_message.thread_id)
        .await?;
    Ok(answer_json(200, json!({ "success": true })))
}
