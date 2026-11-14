use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{Map, Value, json};

use super::template_context::build_sample_subject;
use super::template_operations::template_definition;
use super::template_reference::{
    TemplateReference, TemplateReferenceField, TemplateValueType, build_reference_field,
    load_reference_catalogue,
};
use super::variable_inputs::VariableKind;
use super::variable_view::build_variable_view;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// `GET /api/v1/webhooks/template-reference`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateReferenceRequest {
    /// Comma-separated event types.
    pub events: Option<String>,
}

fn read_event_types(events_text: Option<&str>) -> Vec<String> {
    events_text
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|event_type| !event_type.is_empty())
        .map(str::to_owned)
        .collect()
}

/// The sample `data` of an email, an SMS and a webhook failure among the events, merged.
fn build_merged_sample_data(event_types: &[String]) -> Value {
    let default_event_types = ["email.received".to_owned()];
    let sample_event_types = if event_types.is_empty() {
        &default_event_types[..]
    } else {
        event_types
    };
    let representative_event_types = [
        sample_event_types
            .iter()
            .find(|event_type| event_type.starts_with("email.")),
        sample_event_types
            .iter()
            .find(|event_type| event_type.starts_with("sms.")),
        sample_event_types
            .iter()
            .find(|event_type| *event_type == "webhook.failed"),
    ];
    let mut merged_data = Map::new();
    for event_type in representative_event_types.into_iter().flatten() {
        if let Value::Object(sample_data) = build_sample_subject(event_type).app_event.data {
            merged_data.extend(sample_data);
        }
    }
    Value::Object(merged_data)
}

/// `vars` with each global variable; secret values come masked.
async fn build_variables_field(
    operation_context: &OperationContext,
) -> Result<TemplateReferenceField, OperationError> {
    let stored_variables = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?;
    let mut variable_fields = Vec::new();
    for stored_variable in stored_variables {
        if stored_variable.endpoint_id.is_some() {
            continue;
        }
        let variable = build_variable_view(stored_variable)?;
        variable_fields.push(TemplateReferenceField {
            path: format!("vars.{}", variable.name),
            name: variable.name,
            value_type: match variable.kind {
                VariableKind::Number => TemplateValueType::Number,
                VariableKind::Boolean => TemplateValueType::Boolean,
                _ => TemplateValueType::String,
            },
            description: format!(
                "{} variable. {}",
                variable.kind.as_str(),
                variable.description
            )
            .trim()
            .to_owned(),
            example: Some(variable.value),
            children: Vec::new(),
        });
    }
    Ok(TemplateReferenceField {
        path: "vars".to_owned(),
        name: "vars".to_owned(),
        value_type: TemplateValueType::Object,
        description: String::new(),
        example: None,
        children: variable_fields,
    })
}

/// The rest of the context a delivery renders against, with example values.
fn build_delivery_context_sample(
    operation_context: &OperationContext,
) -> [(&'static str, Value); 5] {
    let instance_details = &operation_context.instance_details;
    [
        (
            "endpoint",
            json!({ "name": "Laravel inbound mail", "url": "http://localhost:8000/webhooks/inbound-mail" }),
        ),
        (
            "delivery",
            json!({ "id": "01JB7T9Q2RDELIVERY0000000", "attempt": 1, "trigger": "auto" }),
        ),
        (
            "rule",
            json!({ "id": "01JB7T9Q2RRULE000000000000", "name": "Support inbox to Laravel" }),
        ),
        (
            "sendmock",
            json!({
                "version": instance_details.version,
                "http_url": format!("http://{}", instance_details.http_address),
            }),
        ),
        ("request_id", json!("01JB7T9Q2RREQUEST00000000")),
    ]
}

pub struct GetWebhookTemplateReferenceOperation;

impl Operation for GetWebhookTemplateReferenceOperation {
    type Input = TemplateReferenceRequest;
    type Output = TemplateReference;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..template_definition(
                "getWebhooksTemplateReference",
                HttpMethod::Get,
                "/api/v1/webhooks/template-reference",
                "Every value a template can read for the chosen events.",
                "sendmock webhook template reference",
                "sendmock_webhook_template_reference",
            )
        }
    }

    /// `event`, `data`, `vars`, then the delivery's own context, as the editor's tree shows them.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateReferenceRequest,
    ) -> Result<TemplateReference, OperationError> {
        let reference_catalogue = load_reference_catalogue();
        let descriptions: &BTreeMap<String, String> = &reference_catalogue.field_descriptions;
        let event_types = read_event_types(input.events.as_deref());
        let event_sample = json!({
            "id": "evt_01JB7T9Q2R",
            "type": event_types.first().map_or("email.received", String::as_str),
            "created_at": "2026-10-25T09:30:00.000Z",
        });
        let mut fields = vec![
            build_reference_field("event", "event", &event_sample, descriptions),
            build_reference_field(
                "data",
                "data",
                &build_merged_sample_data(&event_types),
                descriptions,
            ),
            build_variables_field(operation_context).await?,
        ];
        fields.extend(build_delivery_context_sample(operation_context).iter().map(
            |(field_name, sample_value)| {
                build_reference_field(field_name, field_name, sample_value, descriptions)
            },
        ));
        Ok(TemplateReference {
            fields,
            functions: reference_catalogue.functions,
            filters: reference_catalogue.filters,
        })
    }
}
