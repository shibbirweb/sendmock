use std::collections::BTreeMap;

use sendmock_core::{TemplateEscape, format_rfc5322, render_template};
use sendmock_mail::{EmailEnvelope, IncomingEmail, build_raw_message};
use serde_json::{Value, json};

use super::created_message::CreatedMessage;
use super::provider_call::ProviderCall;
use super::request_checks::{ProviderFailure, find_rule_failure};
use super::send_operation_kind::ProviderAnswer;
use crate::email::{
    NativeSendAttachment, NativeSendRequest, complete_email_intake, read_bare_address,
};
use crate::{OperationContext, OperationError, read_ingest_options};

/// Where providers keep each attachment field: SendGrid and Resend in lowercase, Postmark in
/// Pascal case, Mailgun's file parts as SendMock reads them.
const ATTACHMENT_NAME_KEYS: [&str; 3] = ["filename", "Name", "name"];
const ATTACHMENT_CONTENT_KEYS: [&str; 2] = ["content", "Content"];
const ATTACHMENT_TYPE_KEYS: [&str; 3] = ["type", "ContentType", "content_type"];
const ATTACHMENT_ID_KEYS: [&str; 2] = ["content_id", "ContentID"];

/// Stores one email as the provider's HTTP API received it and answers in the provider's
/// shape: the definition's checks first, then the message built as the native send builds it.
pub async fn answer_email_send(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    let part_values = provider_call.read_part_values();
    if let Some(failure) = find_rule_failure(provider_call.provider, &part_values) {
        return Ok(refuse(provider_call, &failure));
    }
    let send_request = build_send_request(&part_values);
    let native_message = match send_request.to_native_message() {
        Ok(native_message) => native_message,
        Err(OperationError::InvalidInput { message, field }) => {
            let failed_part = field.unwrap_or_else(|| "body".to_owned());
            let failure = ProviderFailure::new("invalid_value", &failed_part, message);
            return Ok(refuse(provider_call, &failure));
        }
        Err(other_error) => return Err(other_error),
    };
    let message_id = format!(
        "{}@sendmock.local",
        operation_context.id_generator.generate_id()
    );
    let raw_message = build_raw_message(
        &native_message,
        &message_id,
        &format_rfc5322(operation_context.clock.now_unix_ms()),
    );
    let envelope = EmailEnvelope {
        mail_from: read_bare_address(&send_request.from),
        recipients: send_request.envelope_recipients(),
    };
    let mut incoming_email =
        IncomingEmail::sent_by_app(raw_message, envelope, &provider_call.provider.key);
    incoming_email.extra_tags = send_request.tags.clone().unwrap_or_default();
    let stored_email = operation_context
        .email_ingest_service
        .ingest(
            incoming_email,
            &read_ingest_options(operation_context).await?,
        )
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
    complete_email_intake(operation_context, &stored_email).await?;
    let answered_message =
        describe_sent_email(provider_call, &send_request, &stored_email.email_id);
    Ok(ProviderAnswer {
        response: provider_call.render_success(&answered_message),
        created_message: Some(CreatedMessage::email(stored_email.email_id)),
    })
}

fn refuse(provider_call: &ProviderCall<'_>, failure: &ProviderFailure) -> ProviderAnswer {
    ProviderAnswer::without_message(provider_call.render_failure(failure))
}

/// The email as the success template reads it, with the provider's own message id.
fn describe_sent_email(
    provider_call: &ProviderCall<'_>,
    send_request: &NativeSendRequest,
    email_id: &str,
) -> Value {
    let id_context = provider_call.build_template_context(&json!({}), None);
    let provider_id = render_template(
        &provider_call.provider.message_id_template,
        &id_context,
        provider_call.template_functions,
        TemplateEscape::None,
    )
    .text;
    json!({
        "id": email_id,
        "provider_id": provider_id,
        "from": send_request.from,
        "to": send_request.to.join(", "),
        "subject": send_request.subject,
        "status": provider_call.provider.status_name("queued"),
    })
}

/// Splits `"Doe, Jane" <jane@x.test>, sam@x.test` into its addresses, as Postmark's `To` and
/// Mailgun's `to` carry several in one field; commas inside quotes or `<...>` do not split.
fn split_address_list(address_list: &str) -> Vec<String> {
    let mut addresses = Vec::new();
    let mut current_address = String::new();
    let (mut is_quoted, mut is_bracketed) = (false, false);
    for character in address_list.chars() {
        match character {
            '"' => is_quoted = !is_quoted,
            '<' => is_bracketed = true,
            '>' => is_bracketed = false,
            ',' if !is_quoted && !is_bracketed => {
                addresses.push(std::mem::take(&mut current_address));
                continue;
            }
            _ => {}
        }
        current_address.push(character);
    }
    addresses.push(current_address);
    addresses
        .into_iter()
        .map(|address| address.trim().to_owned())
        .filter(|address| !address.is_empty())
        .collect()
}

fn build_send_request(part_values: &BTreeMap<String, Vec<String>>) -> NativeSendRequest {
    let read_values = |part: &str| part_values.get(part).cloned().unwrap_or_default();
    let read_first = |part: &str| read_values(part).into_iter().next();
    let read_optional_list =
        |part: &str| Some(read_values(part)).filter(|values| !values.is_empty());
    let read_addresses = |part: &str| {
        read_values(part)
            .iter()
            .flat_map(|address_list| split_address_list(address_list))
            .collect::<Vec<_>>()
    };
    NativeSendRequest {
        from: read_first("from").unwrap_or_default(),
        to: read_addresses("to"),
        cc: Some(read_addresses("cc")).filter(|addresses| !addresses.is_empty()),
        bcc: Some(read_addresses("bcc")).filter(|addresses| !addresses.is_empty()),
        subject: read_first("subject").unwrap_or_default(),
        text: read_first("text"),
        html: read_first("html"),
        headers: Some(read_headers(
            &read_values("headers"),
            read_first("reply_to"),
        ))
        .filter(|headers| !headers.is_empty()),
        tags: read_optional_list("tags"),
        attachments: Some(read_values("attachments"))
            .filter(|attachments| !attachments.is_empty())
            .map(|attachments| {
                attachments
                    .iter()
                    .map(|text| read_attachment(text))
                    .collect()
            }),
    }
}

/// `name: value` pairs as the mapping reads `h:*` or a headers object's entries, plus
/// `Reply-To` when the provider sends it as its own field.
fn read_headers(header_texts: &[String], reply_to: Option<String>) -> BTreeMap<String, String> {
    let mut headers: BTreeMap<String, String> = header_texts
        .iter()
        .filter_map(|header_text| {
            if let Ok(Value::Object(header_object)) = serde_json::from_str::<Value>(header_text) {
                return Some(
                    header_object
                        .into_iter()
                        .map(|(name, value)| (name, read_text(&value)))
                        .collect::<Vec<_>>(),
                );
            }
            let (header_name, header_value) = header_text.split_once(':')?;
            let header_name = header_name.trim().trim_start_matches("h:").to_owned();
            Some(vec![(header_name, header_value.trim().to_owned())])
        })
        .flatten()
        .collect();
    if let Some(reply_to) = reply_to {
        headers.insert("Reply-To".to_owned(), reply_to);
    }
    headers
}

fn read_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other_value => other_value.to_string(),
    }
}

/// One attachment from the provider's own shape; a missing field fails the native checks,
/// which name it.
fn read_attachment(attachment_text: &str) -> NativeSendAttachment {
    let attachment = serde_json::from_str::<Value>(attachment_text).unwrap_or(Value::Null);
    let read_first_key = |keys: &[&str]| {
        keys.iter()
            .find_map(|key| attachment.get(*key).and_then(Value::as_str))
            .map(str::to_owned)
    };
    NativeSendAttachment {
        filename: read_first_key(&ATTACHMENT_NAME_KEYS).unwrap_or_default(),
        content: read_first_key(&ATTACHMENT_CONTENT_KEYS).unwrap_or_default(),
        content_type: read_first_key(&ATTACHMENT_TYPE_KEYS),
        content_id: read_first_key(&ATTACHMENT_ID_KEYS),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_lists_split_on_commas_outside_quotes_and_brackets() {
        assert_eq!(
            split_address_list("\"Doe, Jane\" <jane@shop.test>, sam@shop.test,  "),
            vec!["\"Doe, Jane\" <jane@shop.test>", "sam@shop.test"]
        );
    }

    #[test]
    fn attachments_are_read_from_each_providers_own_keys() {
        let postmark_attachment = read_attachment(
            r#"{"Name": "a.txt", "Content": "aGk=", "ContentType": "text/plain", "ContentID": "cid1"}"#,
        );
        let sendgrid_attachment = read_attachment(
            r#"{"filename": "b.pdf", "content": "JVBE", "type": "application/pdf"}"#,
        );

        assert_eq!(
            (
                postmark_attachment.filename.as_str(),
                postmark_attachment.content_id.as_deref()
            ),
            ("a.txt", Some("cid1"))
        );
        assert_eq!(
            sendgrid_attachment.content_type.as_deref(),
            Some("application/pdf")
        );
    }

    #[test]
    fn mailgun_headers_and_a_reply_to_field_become_headers() {
        let headers = read_headers(
            &["h:X-Campaign: spring".to_owned()],
            Some("support@shop.test".to_owned()),
        );

        assert_eq!(
            headers.get("X-Campaign").map(String::as_str),
            Some("spring")
        );
        assert_eq!(
            headers.get("Reply-To").map(String::as_str),
            Some("support@shop.test")
        );
    }
}
