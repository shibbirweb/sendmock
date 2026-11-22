//! What a webhook template reads as `data` for an email: the list fields, the bodies and
//! headers, and each attachment with its download URL and (when small) its content, so
//! inbound formats can carry attachments as their providers do (WH-06.3).

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_mail::{EmailDeliveryEvent, decompress_raw_message, parse_email};
use sendmock_store::EmailRecord;
use serde_json::{Map, Value, json};

use super::email_forward_fields::{
    build_message_url, list_header_pairs, map_content_ids, read_first_header, split_reply_text,
};
use crate::email::{EmailAddress, EmailSummary, build_bounce_data, read_stored_user_variables};
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

/// What the email's provider send kept: the provider's message id, the user variables and
/// the template id; null and empty for mail that did not come through a provider's API.
fn build_provider_send_fields(
    provider_send: Option<&sendmock_store::EmailProviderSendRecord>,
) -> Vec<(String, Value)> {
    vec![
        (
            "provider_message_id".to_owned(),
            json!(provider_send.map(|send| &send.provider_message_id)),
        ),
        (
            "user_variables".to_owned(),
            Value::Object(
                provider_send
                    .map(read_stored_user_variables)
                    .unwrap_or_default(),
            ),
        ),
        (
            "template_id".to_owned(),
            json!(provider_send.and_then(|send| send.template_id.as_ref())),
        ),
    ]
}

/// The reply headers, header pairs, stripped text and inline parts inbound formats read.
fn build_forward_fields(
    stored_email: &EmailRecord,
    attachment_data: &[Value],
) -> Vec<(String, Value)> {
    let (stripped_text, stripped_signature) =
        split_reply_text(stored_email.text_body.as_deref().unwrap_or_default());
    vec![
        (
            "in_reply_to".to_owned(),
            json!(read_first_header(&stored_email.headers, "In-Reply-To")),
        ),
        (
            "references".to_owned(),
            json!(read_first_header(&stored_email.headers, "References")),
        ),
        (
            "header_pairs".to_owned(),
            json!(list_header_pairs(&stored_email.headers)),
        ),
        ("stripped_text".to_owned(), json!(stripped_text)),
        ("stripped_signature".to_owned(), json!(stripped_signature)),
        (
            "content_id_map".to_owned(),
            Value::Object(map_content_ids(attachment_data)),
        ),
    ]
}

/// A bounced email's last bounce from its timeline, under `bounce` and the flat names events
/// have always used, so previews and renders of a bounced email show it; nothing otherwise.
async fn read_stored_bounce_fields(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<Vec<(String, Value)>, OperationError> {
    if stored_email.delivery_status.as_deref() != Some("bounced") {
        return Ok(Vec::new());
    }
    let timeline = operation_context
        .email_repository
        .list_timeline(&stored_email.email_id)
        .await?;
    let Some(bounce) = timeline
        .iter()
        .rev()
        .filter(|timeline_entry| timeline_entry.kind == "bounced")
        .find_map(|timeline_entry| {
            EmailDeliveryEvent::read_described_bounce(&timeline_entry.detail)
        })
    else {
        return Ok(Vec::new());
    };
    let EmailDeliveryEvent::Bounced {
        bounce_type,
        smtp_code,
        diagnostic,
    } = &bounce
    else {
        return Ok(Vec::new());
    };
    Ok(vec![
        ("bounce".to_owned(), json!(build_bounce_data(&bounce))),
        ("bounce_type".to_owned(), json!(bounce_type.as_str())),
        ("smtp_code".to_owned(), json!(smtp_code)),
        ("diagnostic".to_owned(), json!(diagnostic)),
    ])
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
    let provider_send = operation_context
        .email_stores
        .sends
        .find_send(&stored_email.email_id)
        .await?;
    email_data.extend(build_provider_send_fields(provider_send.as_ref()));
    email_data.extend(read_stored_bounce_fields(operation_context, stored_email).await?);
    let attachment_data = build_attachment_data(operation_context, stored_email).await?;
    let sending_domain = provider_send
        .as_ref()
        .and_then(|send| send.sending_domain.clone())
        .unwrap_or_else(|| "inbound".to_owned());
    email_data.extend(build_forward_fields(stored_email, &attachment_data));
    email_data.extend([
        ("message_id".to_owned(), json!(stored_email.message_id)),
        ("cc".to_owned(), json!(cc)),
        ("text_body".to_owned(), json!(stored_email.text_body)),
        ("html_body".to_owned(), json!(stored_email.html_body)),
        ("headers".to_owned(), json!(stored_email.headers)),
        (
            "message_url".to_owned(),
            json!(build_message_url(
                &operation_context.instance_details,
                &sending_domain,
                &stored_email.email_id
            )),
        ),
        ("attachments".to_owned(), Value::Array(attachment_data)),
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
