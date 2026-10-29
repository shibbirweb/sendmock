//! A template rendered against a message or the sample, for the template preview and the
//! check before saving (WH-08.4, WH-09.5, WH-09.7).

use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_core::{StandardTemplateFunctions, TemplateRenderMode};
use serde::Serialize;
use serde_json::Map;

use super::delivery_queue::DeliveryTrigger;
use super::delivery_template_context::{DeliveryContextDetails, build_delivery_template_context};
use super::endpoint_settings::WebhookHttpMethod;
use super::request_part_renderer::{RenderProblem, RenderProblemSeverity};
use super::template_context::{ChosenMessage, find_template_subject};
use super::template_request_rendering::render_template_request;
use super::template_view::TemplateDraft;
use super::webhook_template_functions::WebhookTemplateFunctions;
use crate::{OperationContext, OperationError};

const PREVIEW_ENDPOINT_NAME: &str = "Preview";
const PREVIEW_ENDPOINT_URL: &str = "http://localhost:8000/webhooks/preview";
const TEMPLATE_METHODS: [WebhookHttpMethod; 4] = [
    WebhookHttpMethod::Post,
    WebhookHttpMethod::Put,
    WebhookHttpMethod::Patch,
    WebhookHttpMethod::Get,
];

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct TemplateRenderResult {
    /// What it was rendered against, e.g. "Built-in sample" or an email subject.
    pub rendered_against: String,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    /// Undefined variables; they render empty.
    pub warnings: Vec<String>,
    /// Problems that stop the template from being saved: unknown functions or filters,
    /// unbalanced braces.
    pub errors: Vec<String>,
    /// The same problems with where they are, for markers in the code editor.
    pub problems: Vec<RenderProblem>,
}

fn is_valid_header_name(header_name: &str) -> bool {
    !header_name.is_empty()
        && header_name.chars().all(|character| {
            character.is_ascii_alphanumeric() || "!#$%&'*+.^_`|~-".contains(character)
        })
}

/// The first shape problem of a draft, as the template editor words it.
pub fn find_draft_shape_problem(template_draft: &TemplateDraft) -> Option<String> {
    if !TEMPLATE_METHODS.contains(&template_draft.method) {
        return Some("Pick POST, PUT, PATCH or GET".to_owned());
    }
    if template_draft.content_type.trim().is_empty() {
        return Some("Enter a content type, e.g. application/json".to_owned());
    }
    if let Some(invalid_name) = template_draft
        .header_templates
        .keys()
        .find(|header_name| !is_valid_header_name(header_name))
    {
        return Some(format!("\"{invalid_name}\" is not a valid header name"));
    }
    if template_draft.method != WebhookHttpMethod::Get
        && template_draft.body_template.trim().is_empty()
    {
        return Some("Enter a body, or use GET for a request without one".to_owned());
    }
    None
}

fn messages_of(problems: &[RenderProblem], severity: RenderProblemSeverity) -> Vec<String> {
    let mut messages: Vec<String> = Vec::new();
    for problem in problems
        .iter()
        .filter(|problem| problem.severity == severity)
    {
        if !messages.contains(&problem.message) {
            messages.push(problem.message.clone());
        }
    }
    messages
}

/// Renders a draft leniently against the chosen message, or the sample of `sample_event_type`.
pub async fn render_template_draft(
    operation_context: &OperationContext,
    template_draft: &TemplateDraft,
    chosen_message: ChosenMessage<'_>,
) -> Result<TemplateRenderResult, OperationError> {
    let template_subject = find_template_subject(operation_context, chosen_message).await?;
    let template_functions = WebhookTemplateFunctions {
        standard_functions: StandardTemplateFunctions::new(
            operation_context.clock.clone(),
            operation_context.random_source.clone(),
        ),
    };
    let preview_delivery_id = operation_context.id_generator.generate_id().to_string();
    let preview_request_id = operation_context.id_generator.generate_id().to_string();
    let delivery_context = build_delivery_template_context(
        operation_context,
        &DeliveryContextDetails {
            app_event: &template_subject.app_event,
            endpoint_id: None,
            endpoint_name: PREVIEW_ENDPOINT_NAME,
            endpoint_url: PREVIEW_ENDPOINT_URL,
            delivery_id: &preview_delivery_id,
            delivery_trigger: DeliveryTrigger::Manual,
            rule_id: None,
            request_id: &preview_request_id,
            send_time_values: &Map::new(),
        },
        &template_functions,
        TemplateRenderMode::Lenient,
    )
    .await?;
    let (rendered_request, mut problems) = render_template_request(
        template_draft,
        &delivery_context.template_context,
        &template_functions,
        TemplateRenderMode::Lenient,
    );
    problems.extend(delivery_context.variable_problems);
    Ok(TemplateRenderResult {
        rendered_against: template_subject.rendered_against,
        headers: rendered_request.headers,
        body: rendered_request.body,
        warnings: messages_of(&problems, RenderProblemSeverity::Warning),
        errors: messages_of(&problems, RenderProblemSeverity::Error),
        problems,
    })
}

/// Refuses a draft that has the wrong shape or does not render against the sample of its
/// first event (422, WH-09.5).
pub async fn check_draft_can_be_saved(
    operation_context: &OperationContext,
    template_draft: &TemplateDraft,
    events: &[String],
) -> Result<(), OperationError> {
    let template_problem = match find_draft_shape_problem(template_draft) {
        Some(shape_problem) => Some(shape_problem),
        None => {
            let sample_render = render_template_draft(
                operation_context,
                template_draft,
                ChosenMessage {
                    sample_event_type: events.first().map(String::as_str),
                    ..ChosenMessage::default()
                },
            )
            .await?;
            sample_render.errors.into_iter().next()
        }
    };
    match template_problem {
        Some(message) => Err(OperationError::Unprocessable {
            code: "template_invalid",
            message,
        }),
        None => Ok(()),
    }
}
