//! The body of Template mode: the endpoint's payload template with its extra fields folded in.
//! The shipped native template is sent as the event's own JSON, so a plain native body keeps
//! the envelope's field order.

use std::collections::BTreeMap;

use sendmock_core::TemplateEscape;
use serde_json::Value;

use super::endpoint_body_rendering::RenderedBody;
use super::endpoint_template::EndpointTemplate;
use super::endpoint_template_overrides::fold_endpoint_overrides;
use super::request_part_renderer::{RenderProblem, RequestPartRenderer};
use super::template_request_rendering::render_template_request;
use super::template_view::TemplateDraft;
use crate::{AppEvent, OperationError};

fn internal_error(message: impl ToString) -> OperationError {
    OperationError::Internal(message.to_string())
}

/// The event as JSON, with each extra field rendered as text on its root object.
fn render_native_event_body(
    part_renderer: &mut RequestPartRenderer,
    extra_fields: &BTreeMap<String, String>,
    app_event: &AppEvent,
) -> Result<RenderedBody, OperationError> {
    let body = if extra_fields.is_empty() {
        serde_json::to_string(app_event).map_err(internal_error)?
    } else {
        let mut event_json = serde_json::to_value(app_event).map_err(internal_error)?;
        for (field_name, field_template) in extra_fields {
            let rendered_value =
                part_renderer.render_part(field_template, "body", TemplateEscape::None);
            if let Value::Object(event_fields) = &mut event_json {
                event_fields.insert(field_name.clone(), Value::from(rendered_value));
            }
        }
        serde_json::to_string(&event_json).map_err(internal_error)?
    };
    Ok(RenderedBody {
        content_type: Some("application/json".to_owned()),
        body,
        template_headers: BTreeMap::new(),
    })
}

/// A template's body and headers; the header problems are tagged `body` too, so `header.<n>`
/// keeps pointing at the endpoint's own headers.
fn render_draft_body(
    part_renderer: &mut RequestPartRenderer,
    template_draft: &TemplateDraft,
    extra_fields: &BTreeMap<String, String>,
) -> RenderedBody {
    let folded_draft = fold_endpoint_overrides(template_draft, &BTreeMap::new(), extra_fields);
    let (rendered_request, template_problems) = render_template_request(
        &folded_draft,
        part_renderer.template_context,
        part_renderer.template_functions,
        part_renderer.render_mode,
    );
    part_renderer
        .problems
        .extend(
            template_problems
                .into_iter()
                .map(|template_problem| RenderProblem {
                    source: "body".to_owned(),
                    ..template_problem
                }),
        );
    let template_headers = rendered_request
        .headers
        .into_iter()
        .filter(|(header_name, _)| !header_name.eq_ignore_ascii_case("content-type"))
        .map(|(header_name, header_value)| (header_name.to_ascii_lowercase(), header_value))
        .collect();
    RenderedBody {
        content_type: Some(folded_draft.content_type),
        body: rendered_request.body,
        template_headers,
    }
}

pub fn render_template_body(
    part_renderer: &mut RequestPartRenderer,
    endpoint_template: &EndpointTemplate,
    extra_fields: &BTreeMap<String, String>,
    app_event: &AppEvent,
) -> Result<RenderedBody, OperationError> {
    match endpoint_template {
        EndpointTemplate::NativeEvent => {
            render_native_event_body(part_renderer, extra_fields, app_event)
        }
        EndpointTemplate::Draft(template_draft) => Ok(render_draft_body(
            part_renderer,
            template_draft,
            extra_fields,
        )),
        EndpointTemplate::Missing { template_id } => {
            part_renderer.problems.push(RenderProblem::error(
                format!("No webhook template with id {template_id}"),
                "body",
            ));
            Ok(RenderedBody {
                content_type: None,
                body: String::new(),
                template_headers: BTreeMap::new(),
            })
        }
    }
}
