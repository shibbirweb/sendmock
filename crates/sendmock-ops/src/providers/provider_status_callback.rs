use sendmock_core::format_rfc3339;
use sendmock_store::{SmsRecord, SmsStatusChangeRecord};
use serde_json::{Value, json};

use super::builtin_webhook_templates::find_builtin_webhook_template;
use super::message_provider_definition::MessageProviderDefinition;
use super::provider_runtime::load_sms_provider_definitions;
use super::provider_webhook_request::{
    ProviderWebhookTarget, build_callback_template_functions, collect_provider_credential_vars,
    render_provider_webhook_request,
};
use crate::sms::RecordedHttpRequest;
use crate::{OperationContext, OperationError};

/// What a provider message's status change calls back with.
#[derive(Debug, Clone, PartialEq)]
pub enum ProviderCallback {
    /// The provider's callback template, rendered.
    Rendered(RecordedHttpRequest),
    /// The provider reports no such status (Vonage sends no receipt for `queued`).
    NotReported,
    /// Not a provider message, or a provider without a callback template.
    NoTemplate,
}

/// Renders the provider's callback template for a status change: the provider's status name,
/// its credentials as `vars.<key>_<credential>` (the message's account as the account SID), and
/// the form fields as `body_fields` for signatures such as `X-Twilio-Signature`.
pub async fn render_provider_status_callback(
    operation_context: &OperationContext,
    sms: &SmsRecord,
    callback_url: &str,
    status_change: &SmsStatusChangeRecord,
) -> Result<ProviderCallback, OperationError> {
    let providers = load_sms_provider_definitions(operation_context).await?;
    let Some(provider) = providers.iter().find(|provider| provider.key == sms.api) else {
        return Ok(ProviderCallback::NoTemplate);
    };
    let Some(callback_template) = provider
        .callback_template_key
        .as_deref()
        .and_then(find_builtin_webhook_template)
    else {
        return Ok(ProviderCallback::NoTemplate);
    };
    if !provider.status_names.is_empty()
        && !provider.status_names.contains_key(&status_change.status)
    {
        return Ok(ProviderCallback::NotReported);
    }
    let template_functions = build_callback_template_functions(operation_context);
    let mut template_context = json!({
        "event": { "type": "sms.status", "created_at": format_rfc3339(status_change.at_unix_ms) },
        "data": describe_status_change(provider, sms, status_change),
        "vars": collect_template_vars(provider, sms),
        "endpoint": { "url": callback_url },
    });
    Ok(ProviderCallback::Rendered(render_provider_webhook_request(
        &callback_template,
        &ProviderWebhookTarget::to_url(callback_url),
        &mut template_context,
        &template_functions,
    )))
}

/// The event data callback templates read, with the provider's names for the status and the
/// error code.
fn describe_status_change(
    provider: &MessageProviderDefinition,
    sms: &SmsRecord,
    status_change: &SmsStatusChangeRecord,
) -> Value {
    json!({
        "id": sms.sms_id,
        "provider_id": sms.provider_id,
        "from_number": sms.from_number,
        "to_number": sms.to_number,
        "body": sms.body,
        "status": provider.status_name(&status_change.status),
        "error_code": status_change
            .error_code
            .as_deref()
            .map(|error_code| provider.provider_error_code(error_code)),
        "channel": sms.channel,
        "encoding": sms.encoding,
        "segments": sms.segments,
        "messaging_service_sid": sms.messaging_service_sid,
    })
}

fn collect_template_vars(provider: &MessageProviderDefinition, sms: &SmsRecord) -> Value {
    let mut template_vars = collect_provider_credential_vars(std::slice::from_ref(provider));
    if let Some(account) = &sms.account {
        template_vars.insert(
            format!("{}_account_sid", provider.key),
            Value::from(account.clone()),
        );
    }
    Value::Object(template_vars)
}
