use std::collections::BTreeMap;

use sendmock_core::{
    StandardTemplateFunctions, TemplateEscape, TemplateFunctions, render_template,
};
use serde_json::{Map, Value};

use super::builtin_webhook_templates::WebhookTemplateDefinition;
use super::callback_template_functions::CallbackTemplateFunctions;
use super::message_provider_definition::MessageProviderDefinition;
use crate::OperationContext;
use crate::sms::RecordedHttpRequest;
use crate::webhooks::SignedBodyFunctions;

/// Where a provider webhook goes and what a send adds to the template's request.
#[derive(Debug, Clone, Copy)]
pub struct ProviderWebhookTarget<'request> {
    pub url: &'request str,
    /// Replaces the template's method; `GET` moves a form body into the query string.
    pub method: Option<&'request str>,
    pub extra_form_fields: &'request [(String, String)],
}

impl<'request> ProviderWebhookTarget<'request> {
    /// The template's own method and body, to `url`.
    pub fn to_url(url: &'request str) -> Self {
        Self {
            url,
            method: None,
            extra_form_fields: &[],
        }
    }
}

/// The template functions provider webhooks render with: the standard ones plus the provider
/// signature helpers.
pub fn build_callback_template_functions(
    operation_context: &OperationContext,
) -> CallbackTemplateFunctions {
    CallbackTemplateFunctions {
        standard_functions: StandardTemplateFunctions::new(
            operation_context.clock.clone(),
            operation_context.random_source.clone(),
        ),
    }
}

/// Renders a provider webhook template (a status callback or an inbound message) to `url`.
/// The body renders first; a form body's fields become `body_fields`, so a header such as
/// `X-Twilio-Signature` signs what is sent. With `GET` the fields move into the query string
/// and the signature covers the full URL, as Twilio signs `GET` webhooks. `extra_form_fields`
/// are added to a form body (Twilio's `MessageStatus` for a TwiML `action`, for example).
pub fn render_provider_webhook_request(
    webhook_template: &WebhookTemplateDefinition,
    target: &ProviderWebhookTarget<'_>,
    template_context: &mut Value,
    template_functions: &CallbackTemplateFunctions,
) -> RecordedHttpRequest {
    let is_json = webhook_template.content_type.contains("json");
    let rendered_body = render_body(
        webhook_template,
        target,
        template_context,
        template_functions,
    );
    let method = target.method.unwrap_or(&webhook_template.method).to_owned();
    let is_get = method.eq_ignore_ascii_case("GET");
    let (request_url, body) = if is_get {
        (append_query(target.url, &rendered_body), String::new())
    } else {
        (target.url.to_owned(), rendered_body)
    };
    template_context["endpoint"]["url"] = Value::from(request_url.clone());
    template_context["body_fields"] = if is_json || is_get {
        Value::Object(Map::new())
    } else {
        read_form_fields(&body)
    };
    RecordedHttpRequest {
        method,
        url: request_url,
        headers: render_headers(
            webhook_template,
            is_get,
            template_context,
            &SignedBodyFunctions {
                template_functions: template_functions.to_shared(),
                signed_body: body.clone(),
            },
        ),
        body,
    }
}

fn render_body(
    webhook_template: &WebhookTemplateDefinition,
    target: &ProviderWebhookTarget<'_>,
    template_context: &Value,
    template_functions: &CallbackTemplateFunctions,
) -> String {
    let is_json = webhook_template.content_type.contains("json");
    let body_escape = if is_json {
        TemplateEscape::JsonString
    } else {
        TemplateEscape::None
    };
    let rendered_body = render_template(
        &webhook_template.body_template,
        template_context,
        template_functions,
        body_escape,
    )
    .text;
    if is_json || target.extra_form_fields.is_empty() {
        return rendered_body;
    }
    let extra_fields = serde_urlencoded::to_string(target.extra_form_fields).unwrap_or_default();
    append_form_fields(&rendered_body, &extra_fields)
}

/// SendMock's defaults, then the template's headers rendered after the body, so they can
/// sign it (`X-Twilio-Signature` from `body_fields`, `X-Hub-Signature-256` from the body
/// itself). A `GET` has no body, so no `Content-Type`.
fn render_headers(
    webhook_template: &WebhookTemplateDefinition,
    is_get: bool,
    template_context: &Value,
    template_functions: &SignedBodyFunctions,
) -> BTreeMap<String, String> {
    let mut headers = BTreeMap::from([("User-Agent".to_owned(), "SendMock".to_owned())]);
    if !is_get {
        headers.insert(
            "Content-Type".to_owned(),
            webhook_template.content_type.clone(),
        );
    }
    for (header_name, header_template) in &webhook_template.header_templates {
        let header_value = render_template(
            header_template,
            template_context,
            template_functions,
            TemplateEscape::None,
        )
        .text;
        headers.insert(header_name.clone(), header_value);
    }
    headers
}

fn append_form_fields(form_body: &str, extra_fields: &str) -> String {
    if form_body.is_empty() {
        extra_fields.to_owned()
    } else {
        format!("{form_body}&{extra_fields}")
    }
}

/// `url` with `query` added after `?`, or after `&` when it already has a query.
fn append_query(url: &str, query: &str) -> String {
    if query.is_empty() {
        return url.to_owned();
    }
    let separator = if url.contains('?') { '&' } else { '?' };
    format!("{url}{separator}{query}")
}

/// Every provider's credentials as `vars.<key>_<credential>`, the names provider templates read.
pub fn collect_provider_credential_vars(
    providers: &[MessageProviderDefinition],
) -> Map<String, Value> {
    providers
        .iter()
        .flat_map(|provider| {
            provider.credentials.iter().map(|credential| {
                (
                    format!("{}_{}", provider.key, credential.name),
                    Value::from(credential.value.clone()),
                )
            })
        })
        .collect()
}

/// A form body's fields by name; a repeated name keeps its values in order, as a list, which is
/// how `twilio_signature` signs repeated fields.
fn read_form_fields(form_body: &str) -> Value {
    let pairs: Vec<(String, String)> = serde_urlencoded::from_str(form_body).unwrap_or_default();
    let mut form_fields = Map::new();
    for (field_name, field_value) in pairs {
        match form_fields.get_mut(&field_name) {
            Some(Value::Array(field_values)) => field_values.push(Value::from(field_value)),
            Some(first_value) => {
                *first_value = Value::Array(vec![first_value.take(), Value::from(field_value)]);
            }
            None => {
                form_fields.insert(field_name, Value::from(field_value));
            }
        }
    }
    Value::Object(form_fields)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appends_a_query_with_the_right_separator() {
        assert_eq!(
            append_query("http://app.test/sms", "A=1"),
            "http://app.test/sms?A=1"
        );
        assert_eq!(
            append_query("http://app.test/sms?x=2", "A=1"),
            "http://app.test/sms?x=2&A=1"
        );
        assert_eq!(
            append_query("http://app.test/sms", ""),
            "http://app.test/sms"
        );
    }

    #[test]
    fn reads_form_fields_with_a_repeated_name_as_a_list() {
        assert_eq!(
            read_form_fields("Body=Hi+there&To=%2B1555&Body=again"),
            serde_json::json!({ "Body": ["Hi there", "again"], "To": "+1555" })
        );
    }
}
