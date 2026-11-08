//! What a webhook template reads as `data` for an email: the list fields, the bodies and
//! headers, and each attachment with its download URL and (when small) its content, so
//! inbound formats can carry attachments as their providers do (WH-06.3).

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_mail::{decompress_raw_message, parse_email};
use sendmock_store::EmailRecord;
use serde_json::{Map, Value, json};

use crate::email::{EmailAddress, EmailSummary};
use crate::{OperationContext, OperationError};

/// Larger attachments are named and linked but not inlined, so a webhook body stays small.
const LARGEST_INLINE_ATTACHMENT_BYTES: usize = 1024 * 1024;

async fn build_attachment_data(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<Vec<Value>, OperationError> {
    if stored_email.attachments.is_empty() {
        return Ok(Vec::new());
    }
    let compressed_raw_message = operation_context
        .email_repository
        .read_compressed_raw_message(&stored_email.email_id)
        .await?
        .unwrap_or_default();
    let raw_message = decompress_raw_message(&compressed_raw_message)
        .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))?;
    let http_address = &operation_context.instance_details.http_address;
    Ok(parse_email(&raw_message)
        .attachments
        .iter()
        .enumerate()
        .map(|(attachment_index, attachment)| {
            json!({
                "index": attachment_index,
                "filename": attachment.filename,
                "content_type": attachment.content_type,
                "size_bytes": attachment.content.len(),
                "content_id": attachment.content_id,
                "url": format!("http://{http_address}/api/v1/emails/{}/attachments/{attachment_index}", stored_email.email_id),
                "content_base64": (attachment.content.len() <= LARGEST_INLINE_ATTACHMENT_BYTES)
                    .then(|| STANDARD.encode(&attachment.content)),
            })
        })
        .collect())
}

/// The email's list fields with its message id, copies, bodies, headers and attachments.
pub async fn build_email_template_data(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<Value, OperationError> {
    let mut email_data: Map<String, Value> =
        match serde_json::to_value(EmailSummary::from(stored_email)) {
            Ok(Value::Object(summary_fields)) => summary_fields,
            _ => Map::new(),
        };
    let cc: Vec<EmailAddress> = stored_email.cc.iter().map(EmailAddress::from).collect();
    email_data.extend([
        ("message_id".to_owned(), json!(stored_email.message_id)),
        ("cc".to_owned(), json!(cc)),
        ("text_body".to_owned(), json!(stored_email.text_body)),
        ("html_body".to_owned(), json!(stored_email.html_body)),
        ("headers".to_owned(), json!(stored_email.headers)),
        (
            "attachments".to_owned(),
            Value::Array(build_attachment_data(operation_context, stored_email).await?),
        ),
    ]);
    Ok(Value::Object(email_data))
}

/// An email event's data as the template reads it: the stored email in full, with the
/// event's own fields (a bounce's reason, a release's recipients) on top.
pub async fn read_email_event_data(
    operation_context: &OperationContext,
    event_type: &str,
    event_data: &Value,
) -> Result<Option<Value>, OperationError> {
    let Some(email_id) = event_data["id"]
        .as_str()
        .filter(|_| event_type.starts_with("email."))
    else {
        return Ok(None);
    };
    let Some(stored_email) = operation_context
        .email_repository
        .find_email(email_id)
        .await?
    else {
        return Ok(None);
    };
    let mut email_data = build_email_template_data(operation_context, &stored_email).await?;
    if let (Some(email_fields), Some(event_fields)) =
        (email_data.as_object_mut(), event_data.as_object())
    {
        email_fields.extend(event_fields.clone());
    }
    Ok(Some(email_data))
}
