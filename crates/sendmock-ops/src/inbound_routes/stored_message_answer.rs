use sendmock_mail::{decompress_raw_message, parse_email};
use sendmock_store::EmailRecord;
use serde_json::{Value, json};

use super::mailgun_routes_api::mailgun_json;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse};
use crate::{OperationContext, OperationError};

/// `GET <message-url>`: the stored message as Mailgun answers it, or its MIME as `body-mime`
/// when the request accepts `message/rfc822` (WH-12.5).
pub async fn answer_stored_message(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let email_id = request.path.rsplit('/').next().unwrap_or_default();
    let not_found = || mailgun_json(404, &json!({ "message": "Message not found" }));
    if !request.method.eq_ignore_ascii_case("GET") {
        return Ok(mailgun_json(
            405,
            &json!({ "message": "Method not allowed" }),
        ));
    }
    let Some(stored_email) = operation_context
        .email_repository
        .find_email(email_id)
        .await?
    else {
        return Ok(not_found());
    };
    let compressed_raw_message = operation_context
        .email_repository
        .read_compressed_raw_message(email_id)
        .await?
        .unwrap_or_default();
    let raw_message = decompress_raw_message(&compressed_raw_message)
        .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))?;
    if request
        .header("accept")
        .is_some_and(|accept| accept.contains("message/rfc822"))
    {
        return Ok(mailgun_json(
            200,
            &json!({ "body-mime": String::from_utf8_lossy(&raw_message) }),
        ));
    }
    Ok(mailgun_json(
        200,
        &describe_stored_message(&stored_email, &raw_message),
    ))
}

/// The message's fields as Mailgun's stored-message answer names them.
fn describe_stored_message(stored_email: &EmailRecord, raw_message: &[u8]) -> Value {
    let message_headers: Vec<[&str; 2]> = stored_email
        .headers
        .iter()
        .flat_map(|(header_name, header_values)| {
            header_values
                .iter()
                .map(move |header_value| [header_name.as_str(), header_value.as_str()])
        })
        .collect();
    let attachments: Vec<Value> = parse_email(raw_message)
        .attachments
        .iter()
        .map(|attachment| {
            json!({ "filename": attachment.filename, "content-type": attachment.content_type, "size": attachment.content.len() })
        })
        .collect();
    json!({
        "From": stored_email.from.address,
        "Subject": stored_email.subject,
        "sender": stored_email.envelope_from,
        "recipients": stored_email.envelope_to.join(","),
        "body-plain": stored_email.text_body.clone().unwrap_or_default(),
        "body-html": stored_email.html_body.clone().unwrap_or_default(),
        "Message-Id": stored_email.message_id.clone().map(|message_id| format!("<{message_id}>")),
        "message-headers": message_headers,
        "attachments": attachments,
    })
}
