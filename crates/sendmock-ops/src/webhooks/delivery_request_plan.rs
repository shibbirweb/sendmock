use sendmock_store::WebhookEndpointRecord;

use super::delivery_request_rendering::RenderedDeliveryRequest;
use super::endpoint_settings::EndpointRequestSettings;
use super::endpoint_template::read_detached_template;
use super::endpoint_view::read_request_settings;
use super::template_view::TemplateDraft;
use crate::OperationError;

/// How one delivery builds its request: the endpoint's own settings, or what a manual send
/// changes for that send only.
#[derive(Debug, Clone)]
pub struct DeliveryRequestPlan {
    pub url_template: String,
    pub request_settings: EndpointRequestSettings,
    /// The endpoint's own copy of its template, used while detached.
    pub detached_template: Option<TemplateDraft>,
    /// A body typed for this send, sent as written instead of the rendered one (WH-05.6).
    pub edited_body: Option<String>,
}

impl DeliveryRequestPlan {
    /// The endpoint's request as it is saved.
    pub fn from_endpoint(stored_endpoint: &WebhookEndpointRecord) -> Result<Self, OperationError> {
        Ok(Self {
            url_template: stored_endpoint.url.clone(),
            request_settings: read_request_settings(stored_endpoint)?,
            detached_template: read_detached_template(stored_endpoint)?,
            edited_body: None,
        })
    }

    /// Puts the edited body in place of the rendered one; problems of the body it replaces no
    /// longer count, while URL, query and header problems still do.
    pub fn apply_edited_body(&self, rendered_delivery: &mut RenderedDeliveryRequest) {
        let Some(edited_body) = &self.edited_body else {
            return;
        };
        rendered_delivery.request.body = edited_body.clone();
        rendered_delivery
            .problems
            .retain(|render_problem| !is_body_problem_source(&render_problem.source));
    }
}

/// Every source but the URL, query parameters and headers belongs to the body, as the send
/// dialog groups them.
fn is_body_problem_source(problem_source: &str) -> bool {
    !(problem_source == "url"
        || problem_source.starts_with("query.")
        || problem_source.starts_with("header."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_query_and_header_problems_are_not_body_problems() {
        let body_flags: Vec<bool> = ["url", "query.0", "header.2", "body", "field.1", "vars"]
            .into_iter()
            .map(is_body_problem_source)
            .collect();

        assert_eq!(body_flags, [false, false, false, true, true, true]);
    }
}
