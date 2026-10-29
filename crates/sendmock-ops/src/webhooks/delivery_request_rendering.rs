use sendmock_core::StandardTemplateFunctions;

use super::delivery_template_context::{DeliveryContextDetails, build_delivery_template_context};
use super::endpoint_request_rendering::{render_endpoint_request, to_template_render_mode};
use super::endpoint_settings::EndpointRequestSettings;
use super::request_part_renderer::{RenderProblem, RenderProblemSeverity, RequestPartRenderer};
use super::webhook_template_functions::WebhookTemplateFunctions;
use crate::{OperationContext, OperationError, RecordedHttpRequest};

pub struct RenderedDeliveryRequest {
    pub request: RecordedHttpRequest,
    pub problems: Vec<RenderProblem>,
}

impl RenderedDeliveryRequest {
    pub fn has_errors(&self) -> bool {
        self.problems
            .iter()
            .any(|problem| problem.severity == RenderProblemSeverity::Error)
    }

    /// The problems of one severity as one line, e.g. for a `render_failed` delivery.
    pub fn describe_problems(&self, severity: RenderProblemSeverity) -> String {
        self.problems
            .iter()
            .filter(|problem| problem.severity == severity)
            .map(|problem| {
                if problem.source == "vars" {
                    problem.message.clone()
                } else {
                    format!("{}: {}", problem.source, problem.message)
                }
            })
            .collect::<Vec<_>>()
            .join("; ")
    }
}

/// Renders an endpoint's request for one event, as a queued delivery or the preview does.
pub async fn render_delivery_request(
    operation_context: &OperationContext,
    details: &DeliveryContextDetails<'_>,
    request_settings: &EndpointRequestSettings,
) -> Result<RenderedDeliveryRequest, OperationError> {
    let render_mode = to_template_render_mode(request_settings.render_mode);
    let template_functions = WebhookTemplateFunctions {
        standard_functions: StandardTemplateFunctions::new(
            operation_context.clock.clone(),
            operation_context.random_source.clone(),
        ),
    };
    let delivery_context = build_delivery_template_context(
        operation_context,
        details,
        &template_functions,
        render_mode,
    )
    .await?;
    let mut part_renderer = RequestPartRenderer {
        template_context: &delivery_context.template_context,
        template_functions: &template_functions,
        render_mode,
        problems: delivery_context.variable_problems,
    };
    let request = render_endpoint_request(
        &mut part_renderer,
        details.endpoint_url,
        request_settings,
        details.app_event,
        operation_context.instance_details.version,
    )?;
    Ok(RenderedDeliveryRequest {
        request,
        problems: part_renderer.problems,
    })
}
