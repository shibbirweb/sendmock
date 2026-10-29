use std::collections::BTreeMap;

use sendmock_core::{StandardTemplateFunctions, TemplateEscape, format_rfc3339, render_template};
use sendmock_store::{SmsRecord, SmsStatusChangeRecord};
use serde_json::{Map, Value, json};

use super::builtin_webhook_templates::{WebhookTemplateDefinition, find_builtin_webhook_template};
use super::callback_template_functions::CallbackTemplateFunctions;
use super::message_provider_definition::MessageProviderDefinition;
use super::provider_runtime::load_sms_provider_definitions;
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
    let template_functions = CallbackTemplateFunctions {
        standard_functions: StandardTemplateFunctions::new(
            operation_context.clock.clone(),
            operation_context.random_source.clone(),
        ),
    };
    let mut template_context = json!({
        "event": { "type": "sms.status", "created_at": format_rfc3339(status_change.at_unix_ms) },
        "data": describe_status_change(provider, sms, status_change),
        "vars": collect_template_vars(provider, sms),
        "endpoint": { "url": callback_url },
    });
    Ok(ProviderCallback::Rendered(render_callback_request(
        &callback_template,
        callback_url,
        &mut template_context,
        &template_functions,
    )))
}

fn render_callback_request(
    callback_template: &WebhookTemplateDefinition,
    callback_url: &str,
    template_context: &mut Value,
    template_functions: &CallbackTemplateFunctions,
) -> RecordedHttpRequest {
    let is_json = callback_template.content_type.contains("json");
    let body_escape = if is_json {
        TemplateEscape::JsonString
    } else {
        TemplateEscape::None
    };
    let body = render_template(
        &callback_template.body_template,
        template_context,
        template_functions,
        body_escape,
    )
    .text;
    if !is_json {
        template_context["body_fields"] = read_form_fields(&body);
    }
    let mut headers = BTreeMap::from([
        (
            "Content-Type".to_owned(),
            callback_template.content_type.clone(),
        ),
        ("User-Agent".to_owned(), "SendMock".to_owned()),
    ]);
    for (header_name, header_template) in &callback_template.header_templates {
        let header_value = render_template(
            header_template,
            template_context,
            template_functions,
            TemplateEscape::None,
        )
        .text;
        headers.insert(header_name.clone(), header_value);
    }
    RecordedHttpRequest {
        method: callback_template.method.clone(),
        url: callback_url.to_owned(),
        headers,
        body,
    }
}

/// The event data callback templates read, with the provider's names for the status.
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
        "error_code": status_change.error_code,
        "channel": sms.channel,
        "segments": sms.segments,
    })
}

fn collect_template_vars(provider: &MessageProviderDefinition, sms: &SmsRecord) -> Value {
    let mut template_vars: Map<String, Value> = provider
        .credentials
        .iter()
        .map(|credential| {
            (
                format!("{}_{}", provider.key, credential.name),
                Value::from(credential.value.clone()),
            )
        })
        .collect();
    if let Some(account) = &sms.account {
        template_vars.insert(
            format!("{}_account_sid", provider.key),
            Value::from(account.clone()),
        );
    }
    Value::Object(template_vars)
}

fn read_form_fields(form_body: &str) -> Value {
    let pairs: Vec<(String, String)> = serde_urlencoded::from_str(form_body).unwrap_or_default();
    let mut form_fields = Map::new();
    for (field_name, field_value) in pairs {
        form_fields.insert(field_name, Value::from(field_value));
    }
    Value::Object(form_fields)
}
