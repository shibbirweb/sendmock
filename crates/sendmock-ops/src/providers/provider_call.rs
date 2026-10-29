use std::collections::BTreeMap;

use sendmock_core::{TemplateEscape, TemplateFunctions, format_rfc3339, render_template};
use sendmock_store::SmsRecord;
use serde_json::{Value, json};

use super::message_provider_definition::{
    MessageProviderDefinition, ProviderOperation, ProviderResponseTemplate,
};
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::request_checks::ProviderFailure;
use super::request_reader::read_source_values;

/// One request matched to a provider operation, with its fields read.
pub struct ProviderCall<'call> {
    pub provider: &'call MessageProviderDefinition,
    pub operation: &'call ProviderOperation,
    pub path_params: BTreeMap<String, String>,
    pub request: &'call ProviderHttpRequest,
    pub request_fields: Value,
    pub template_functions: &'call dyn TemplateFunctions,
}

impl ProviderCall<'_> {
    /// Every message part the field mapping reads, by part name.
    pub fn read_part_values(&self) -> BTreeMap<String, Vec<String>> {
        self.provider
            .field_mapping
            .iter()
            .map(|field_mapping| {
                (
                    field_mapping.part.clone(),
                    read_source_values(&self.request_fields, &field_mapping.source),
                )
            })
            .filter(|(_, values)| !values.is_empty())
            .collect()
    }

    /// The request fields without the provider's secret credentials, as stored on a message.
    pub fn describe_request_without_secrets(&self) -> String {
        let mut request_fields = self.request_fields.clone();
        if let Value::Object(fields) = &mut request_fields {
            for credential in self
                .provider
                .credentials
                .iter()
                .filter(|credential| credential.is_secret)
            {
                fields.remove(&credential.name);
            }
        }
        request_fields.to_string()
    }

    /// The answer a success template gives for a message.
    pub fn render_success(&self, message: &Value) -> ProviderHttpResponse {
        self.render_response(&self.provider.success_response, message, None)
    }

    /// The provider's answer for a failure, or SendMock's own when it has none for that kind.
    pub fn render_failure(&self, failure: &ProviderFailure) -> ProviderHttpResponse {
        match self.provider.find_error_response(&failure.kind) {
            Some(error_response) => self.render_response(
                &error_response.as_response_template(),
                &json!({}),
                Some(failure),
            ),
            None => ProviderHttpResponse {
                status: if failure.kind == "not_found" {
                    404
                } else {
                    400
                },
                headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
                body: json!({ "error": { "code": failure.kind, "message": failure.reason } })
                    .to_string(),
            },
        }
    }

    fn render_response(
        &self,
        response_template: &ProviderResponseTemplate,
        message: &Value,
        failure: Option<&ProviderFailure>,
    ) -> ProviderHttpResponse {
        let template_context = self.build_template_context(message, failure);
        let headers: Vec<(String, String)> = response_template
            .headers
            .iter()
            .map(|header_template| {
                let rendered = render_template(
                    &header_template.template,
                    &template_context,
                    self.template_functions,
                    TemplateEscape::None,
                );
                (header_template.name.clone(), rendered.text)
            })
            .collect();
        let is_json_body = headers.iter().any(|(header_name, header_value)| {
            header_name.eq_ignore_ascii_case("content-type") && header_value.contains("json")
        });
        let body_escape = if is_json_body {
            TemplateEscape::JsonString
        } else {
            TemplateEscape::None
        };
        let body = render_template(
            &response_template.body,
            &template_context,
            self.template_functions,
            body_escape,
        );
        ProviderHttpResponse {
            status: response_template.status,
            headers,
            body: body.text,
        }
    }

    /// `request`, `message`, `error` and `credentials`, as the template reference lists them.
    fn build_template_context(&self, message: &Value, failure: Option<&ProviderFailure>) -> Value {
        let credentials: serde_json::Map<String, Value> = self
            .provider
            .credentials
            .iter()
            .map(|credential| {
                (
                    credential.name.clone(),
                    Value::from(credential.value.clone()),
                )
            })
            .collect();
        let error = failure.map_or_else(
            || json!({ "kind": "", "part": "", "reason": "" }),
            |failure| {
                json!({
                    "kind": failure.kind,
                    "part": failure.part,
                    "reason": failure.provider_message.clone().unwrap_or_default(),
                    "code": failure.code,
                })
            },
        );
        json!({
            "request": {
                "method": self.request.method,
                "path": self.request.path,
                "path_params": self.path_params,
                "headers": self.request.headers,
                "query": self.request.query_string,
                "body": self.request_fields,
            },
            "message": message,
            "error": error,
            "credentials": credentials,
        })
    }
}

/// A stored message as templates read it, with the provider's status names.
pub fn describe_message(provider: &MessageProviderDefinition, sms: &SmsRecord) -> Value {
    let with_channel = |number: &str| {
        if sms.channel == "whatsapp" {
            format!("whatsapp:{number}")
        } else {
            number.to_owned()
        }
    };
    json!({
        "id": sms.sms_id,
        "provider_id": sms.provider_id,
        "from": with_channel(&sms.from_number),
        "to": with_channel(&sms.to_number),
        "subject": "",
        "body": sms.body,
        "status": provider.status_name(&sms.status),
        "segments": sms.segments.to_string(),
        "num_media": sms.media.len().to_string(),
        "error_code": sms.error_code,
        "messaging_service_sid": sms.messaging_service_sid,
        "created_at": format_rfc3339(sms.created_at_unix_ms),
        "updated_at": format_rfc3339(sms.updated_at_unix_ms),
    })
}
