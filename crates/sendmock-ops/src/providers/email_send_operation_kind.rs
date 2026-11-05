use sendmock_core::{TemplateEscape, format_rfc5322, render_template};
use sendmock_mail::{EmailEnvelope, IncomingEmail, build_raw_message};
use sendmock_store::EmailProviderSendRecord;
use serde_json::{Value, json};

use super::created_message::CreatedMessage;
use super::email_send_parts::build_send_request;
use super::provider_call::ProviderCall;
use super::request_checks::{ProviderFailure, find_rule_failure};
use super::send_operation_kind::ProviderAnswer;
use crate::email::{NativeSendRequest, complete_email_intake, read_bare_address};
use crate::{OperationContext, OperationError, read_ingest_options};

/// An email a provider request stored, as its success template reads it.
pub struct SentEmail {
    pub email_id: String,
    pub described_email: Value,
}

/// Stores one email as the provider's HTTP API received it and answers in the provider's
/// shape: the definition's checks first, then the message built as the native send builds it.
pub async fn answer_email_send(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    match send_one_email(
        operation_context,
        provider_call,
        &provider_call.request_fields,
    )
    .await?
    {
        Ok(sent_email) => Ok(ProviderAnswer {
            response: provider_call.render_success(&sent_email.described_email),
            created_message: Some(CreatedMessage::email(sent_email.email_id)),
        }),
        Err(failure) => Ok(ProviderAnswer::without_message(
            provider_call.render_failure(&failure),
        )),
    }
}

/// Checks and stores one message read from `message_fields` (the whole request, or one item of
/// a batch); a failure is the provider's to answer.
pub async fn send_one_email(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
    message_fields: &Value,
) -> Result<Result<SentEmail, ProviderFailure>, OperationError> {
    let part_values = provider_call.read_part_values_from(message_fields);
    if let Some(failure) = find_rule_failure(provider_call.provider, &part_values) {
        return Ok(Err(failure));
    }
    let send_request = build_send_request(&part_values);
    let native_message = match send_request.to_native_message() {
        Ok(native_message) => native_message,
        Err(OperationError::InvalidInput { message, field }) => {
            let failed_part = field.unwrap_or_else(|| "body".to_owned());
            return Ok(Err(ProviderFailure::new(
                "invalid_value",
                &failed_part,
                message,
            )));
        }
        Err(other_error) => return Err(other_error),
    };
    let stored_email = store_provider_email(
        operation_context,
        provider_call,
        &send_request,
        native_message,
    )
    .await?;
    let provider_message_id = render_provider_message_id(provider_call);
    save_provider_send(
        operation_context,
        provider_call,
        &part_values,
        &stored_email.email_id,
        &provider_message_id,
    )
    .await?;
    complete_email_intake(operation_context, &stored_email).await?;
    Ok(Ok(SentEmail {
        described_email: describe_sent_email(
            provider_call,
            &send_request,
            &stored_email.email_id,
            &provider_message_id,
        ),
        email_id: stored_email.email_id,
    }))
}

/// Builds the message as the native send does and stores it as sent through the provider.
async fn store_provider_email(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
    send_request: &NativeSendRequest,
    native_message: sendmock_mail::NativeMessage,
) -> Result<sendmock_store::EmailRecord, OperationError> {
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
    operation_context
        .email_ingest_service
        .ingest(
            incoming_email,
            &read_ingest_options(operation_context).await?,
        )
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))
}

fn render_provider_message_id(provider_call: &ProviderCall<'_>) -> String {
    let id_context = provider_call.build_template_context(&json!({}), None);
    render_template(
        &provider_call.provider.message_id_template,
        &id_context,
        provider_call.template_functions,
        TemplateEscape::None,
    )
    .text
}

/// Keeps the provider's own message id and a template send's id and data with the email.
async fn save_provider_send(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
    part_values: &std::collections::BTreeMap<String, Vec<String>>,
    email_id: &str,
    provider_message_id: &str,
) -> Result<(), OperationError> {
    let read_first = |part: &str| {
        part_values
            .get(part)
            .and_then(|values| values.first())
            .cloned()
    };
    operation_context
        .email_provider_send_repository
        .save_send(EmailProviderSendRecord {
            email_id: email_id.to_owned(),
            provider_key: provider_call.provider.key.clone(),
            provider_message_id: provider_message_id.to_owned(),
            template_id: read_first("template_id"),
            template_data_json: read_first("template_data"),
        })
        .await?;
    Ok(())
}

/// The email as the success template reads it, with the provider's own message id.
fn describe_sent_email(
    provider_call: &ProviderCall<'_>,
    send_request: &NativeSendRequest,
    email_id: &str,
    provider_message_id: &str,
) -> Value {
    json!({
        "id": email_id,
        "provider_id": provider_message_id,
        "from": send_request.from,
        "to": send_request.to.join(", "),
        "subject": send_request.subject,
        "status": provider_call.provider.status_name("queued"),
    })
}
