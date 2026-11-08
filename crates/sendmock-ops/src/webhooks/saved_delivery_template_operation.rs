use std::collections::BTreeMap;

use super::delivery_replay_operation::{is_signature_header, parse_json};
use super::endpoint_settings::WebhookHttpMethod;
use super::saved_delivery_inputs::SaveAsTemplateRequest;
use super::saved_delivery_operations::find_stored_saved_delivery;
use super::template_operations::read_template_name;
use super::template_store::create_custom_template;
use super::template_view::{TemplateDraft, TemplateMetadata, WebhookTemplateSummary};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    RecordedHttpRequest, SuccessStatus,
};

const CONTENT_TYPE_HEADER: &str = "content-type";
const DEFAULT_CONTENT_TYPE: &str = "application/json";
const CUSTOM_SERVICE: &str = "Custom";

/// A stored method outside the template editor's choices is sent as POST.
fn read_template_method(stored_method: &str) -> WebhookHttpMethod {
    serde_json::from_value(serde_json::Value::String(
        stored_method.to_ascii_uppercase(),
    ))
    .unwrap_or(WebhookHttpMethod::Post)
}

/// The stored request as a template draft: its content type set apart, and no signature
/// headers, since the sender makes them fresh on every send.
fn build_template_draft(saved_request: RecordedHttpRequest) -> TemplateDraft {
    let mut content_type = DEFAULT_CONTENT_TYPE.to_owned();
    let mut header_templates = BTreeMap::new();
    for (header_name, header_value) in saved_request.headers {
        if header_name.eq_ignore_ascii_case(CONTENT_TYPE_HEADER) {
            content_type = header_value;
        } else if !is_signature_header(&header_name) {
            header_templates.insert(header_name, header_value);
        }
    }
    TemplateDraft {
        method: read_template_method(&saved_request.method),
        content_type,
        header_templates,
        body_template: saved_request.body,
    }
}

pub struct SaveSavedWebhookDeliveryAsTemplateOperation;

impl Operation for SaveSavedWebhookDeliveryAsTemplateOperation {
    type Input = SaveAsTemplateRequest;
    type Output = WebhookTemplateSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksSavedBySavedIdTemplate",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/saved/{savedId}/template",
            summary: "Turn a saved request into a custom template.",
            cli_usage: "sendmock webhook saved save-as-template <savedId>",
            mcp_tool: "sendmock_webhook_saved_save_as_template",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// A custom template with the saved request's method, headers and body, listening to the
    /// saved event (WH-10.2).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SaveAsTemplateRequest,
    ) -> Result<WebhookTemplateSummary, OperationError> {
        let saved_delivery = find_stored_saved_delivery(operation_context, &input.saved_id).await?;
        let template_name = read_template_name(&input.name)?;
        let saved_request: RecordedHttpRequest = parse_json(&saved_delivery.request_json)?;
        let metadata = TemplateMetadata {
            name: template_name,
            description: format!("Made from the saved delivery \"{}\".", saved_delivery.name),
            events: saved_delivery.event_type.into_iter().collect(),
            required_variables: Vec::new(),
        };
        create_custom_template(
            operation_context,
            metadata,
            CUSTOM_SERVICE.to_owned(),
            build_template_draft(saved_request),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn saved_request(method: &str, headers: &[(&str, &str)]) -> RecordedHttpRequest {
        RecordedHttpRequest {
            method: method.to_owned(),
            url: "http://127.0.0.1:3000/hooks".to_owned(),
            headers: headers
                .iter()
                .map(|(header_name, header_value)| {
                    ((*header_name).to_owned(), (*header_value).to_owned())
                })
                .collect(),
            body: "{\"ok\":true}".to_owned(),
        }
    }

    // AC: WH-10.2
    #[test]
    fn the_draft_keeps_the_content_type_apart_and_drops_signature_headers() {
        let draft = build_template_draft(saved_request(
            "PUT",
            &[
                ("Content-Type", "application/x-www-form-urlencoded"),
                ("Webhook-Signature", "v1,abc"),
                ("x-team", "orders"),
            ],
        ));

        assert_eq!(draft.method, WebhookHttpMethod::Put);
        assert_eq!(draft.content_type, "application/x-www-form-urlencoded");
        assert_eq!(
            draft.header_templates,
            BTreeMap::from([("x-team".to_owned(), "orders".to_owned())])
        );
        assert_eq!(draft.body_template, "{\"ok\":true}");
    }

    #[test]
    fn a_draft_without_a_content_type_or_known_method_is_json_over_post() {
        let draft = build_template_draft(saved_request("HEAD", &[]));

        assert_eq!(draft.method, WebhookHttpMethod::Post);
        assert_eq!(draft.content_type, DEFAULT_CONTENT_TYPE);
    }
}
