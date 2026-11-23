use sendmock_mail::{decompress_raw_message, parse_email};
use sendmock_store::{EmailProviderSendRecord, EmailRecord};
use serde_json::{Value, json};

use super::mailgun_routes_api::MAILGUN_PROVIDER_KEY;
use super::mailgun_routes_api::mailgun_json;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse};
use crate::webhooks::split_reply_text;
use crate::{OperationContext, OperationError};

/// `GET <message-url>`: the stored message as Mailgun answers it, or its MIME as `body-mime`
/// when the request accepts `message/rfc822` (WH-12.5).
pub async fn answer_stored_message(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let message_key = request.path.rsplit('/').next().unwrap_or_default();
    let not_found = || mailgun_json(404, &json!({ "message": "Message not found" }));
    if !request.method.eq_ignore_ascii_case("GET") {
        return Ok(mailgun_json(
            405,
            &json!({ "message": "Method not allowed" }),
        ));
    }
    let Some(stored_email) = find_stored_email(operation_context, message_key).await? else {
        return Ok(not_found());
    };
    let email_id = stored_email.email_id.as_str();
    let provider_send = operation_context
        .email_stores
        .sends
        .find_send(email_id)
        .await?;
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
        &describe_stored_message(
            &stored_email,
            &raw_message,
            provider_send.as_ref(),
            &format!(
                "http://{}/api/v1/emails/{email_id}/attachments",
                operation_context.instance_details.http_address
            ),
        ),
    ))
}

/// The email a stored-message key names: SendMock's id, or the id Mailgun's send answered,
/// with or without its angle brackets (EM-26.1).
async fn find_stored_email(
    operation_context: &OperationContext,
    message_key: &str,
) -> Result<Option<EmailRecord>, OperationError> {
    let email_repository = &operation_context.email_repository;
    if let Some(stored_email) = email_repository.find_email(message_key).await? {
        return Ok(Some(stored_email));
    }
    let bare_key = message_key.trim_matches(['<', '>']);
    for provider_message_id in [format!("<{bare_key}>"), bare_key.to_owned()] {
        if let Some(provider_send) = operation_context
            .email_stores
            .sends
            .find_send_by_provider_message_id(MAILGUN_PROVIDER_KEY, &provider_message_id)
            .await?
        {
            return Ok(email_repository.find_email(&provider_send.email_id).await?);
        }
    }
    Ok(None)
}

/// The message's fields as Mailgun's stored-message answer names them, with a template send's
/// name and variables and the user variables as the headers Mailgun adds for them.
fn describe_stored_message(
    stored_email: &EmailRecord,
    raw_message: &[u8],
    provider_send: Option<&EmailProviderSendRecord>,
    attachments_url: &str,
) -> Value {
    let message_headers: Vec<[&str; 2]> = stored_email
        .headers
        .iter()
        .flat_map(|(header_name, header_values)| {
            header_values
                .iter()
                .map(move |header_value| [header_name.as_str(), header_value.as_str()])
        })
        .collect();
    let (attachments, content_id_map) = describe_attachments(raw_message, attachments_url);
    let (stripped_text, stripped_signature) =
        split_reply_text(stored_email.text_body.as_deref().unwrap_or_default());
    let to_addresses: Vec<&str> = stored_email
        .to
        .iter()
        .map(|recipient| recipient.address.as_str())
        .collect();
    let mut stored_message = json!({
        "From": stored_email.from.address,
        "To": to_addresses.join(", "),
        "Subject": stored_email.subject,
        "Mime-Version": "1.0",
        "Content-Type": read_first_header_value(stored_email, "Content-Type"),
        "sender": stored_email.envelope_from,
        "recipients": stored_email.envelope_to.join(","),
        "body-plain": stored_email.text_body.clone().unwrap_or_default(),
        "body-html": stored_email.html_body.clone().unwrap_or_default(),
        "stripped-text": stripped_text,
        "stripped-signature": stripped_signature,
        "stripped-html": stored_email.html_body.clone().unwrap_or_default(),
        "Message-Id": stored_email.message_id.clone().map(|message_id| format!("<{}>", message_id.trim_matches(['<', '>']))),
        "message-headers": message_headers,
        "attachments": attachments,
        "content-id-map": content_id_map,
    });
    if let Some(provider_send) = provider_send {
        add_send_headers(&mut stored_message, provider_send);
    }
    stored_message
}

/// Each file's download URL, name, type and size, as Mailgun lists a stored message's
/// attachments, and each inline part's content id with its field.
fn describe_attachments(
    raw_message: &[u8],
    attachments_url: &str,
) -> (Vec<Value>, serde_json::Map<String, Value>) {
    let parsed_email = parse_email(raw_message);
    let attachments = parsed_email
        .attachments
        .iter()
        .enumerate()
        .map(|(attachment_index, attachment)| {
            json!({
                "url": format!("{attachments_url}/{attachment_index}"),
                "name": attachment.filename,
                "content-type": attachment.content_type,
                "size": attachment.content.len(),
            })
        })
        .collect();
    let content_id_map = parsed_email
        .attachments
        .iter()
        .enumerate()
        .filter_map(|(attachment_index, attachment)| {
            let content_id = attachment.content_id.as_deref()?;
            Some((
                format!("<{}>", content_id.trim_matches(['<', '>'])),
                json!(format!("attachment-{}", attachment_index + 1)),
            ))
        })
        .collect();
    (attachments, content_id_map)
}

/// The headers Mailgun adds for a template send's name and variables and for user variables.
fn add_send_headers(stored_message: &mut Value, provider_send: &EmailProviderSendRecord) {
    if let Some(template_id) = &provider_send.template_id {
        stored_message["X-Mailgun-Template-Name"] = json!(template_id);
        stored_message["X-Mailgun-Template-Variables"] = json!(
            provider_send
                .template_data_json
                .clone()
                .unwrap_or_else(|| "{}".to_owned())
        );
    }
    if let Some(user_variables_json) = &provider_send.user_variables_json {
        stored_message["X-Mailgun-Variables"] = json!(user_variables_json);
    }
}

fn read_first_header_value(stored_email: &EmailRecord, header_name: &str) -> String {
    stored_email
        .headers
        .iter()
        .find(|(stored_name, _)| stored_name.eq_ignore_ascii_case(header_name))
        .and_then(|(_, header_values)| header_values.first().cloned())
        .unwrap_or_else(|| "text/plain".to_owned())
}
