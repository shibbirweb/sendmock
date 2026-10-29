use sendmock_core::{TemplateProblem, TemplateProblemSeverity};
use serde_json::Value;

use super::provider_views::{PreviewResponse, ProviderDefinitionProblem};
use crate::providers::{ProviderCall, ProviderFailure};

/// The success answer, the error kind's answer, or SendMock's own when the provider has none.
pub fn render_preview_response(
    provider_call: &ProviderCall<'_>,
    message: &Value,
    failure: Option<&ProviderFailure>,
    problems: &mut Vec<ProviderDefinitionProblem>,
) -> PreviewResponse {
    let provider = provider_call.provider;
    let (part_name, response_template) = match failure {
        None => (
            "Success response".to_owned(),
            Some(provider.success_response.clone()),
        ),
        Some(failure) => (
            format!("{} response", failure.kind),
            provider
                .find_error_response(&failure.kind)
                .map(|error_response| error_response.as_response_template()),
        ),
    };
    let response = match (response_template, failure) {
        (Some(response_template), _) => {
            let rendered = provider_call.render_response(&response_template, message, failure);
            for (template_part, template_problem) in rendered.problems {
                collect_problems(
                    problems,
                    &format!("{part_name} {template_part}"),
                    vec![template_problem],
                );
            }
            rendered.response
        }
        (None, Some(failure)) => provider_call.render_failure(failure),
        (None, None) => provider_call.render_success(message),
    };
    PreviewResponse {
        status: response.status,
        headers: response.headers.into_iter().collect(),
        body: response.body,
    }
}

pub fn collect_problems(
    problems: &mut Vec<ProviderDefinitionProblem>,
    part: &str,
    template_problems: Vec<TemplateProblem>,
) {
    problems.extend(template_problems.into_iter().map(|template_problem| {
        ProviderDefinitionProblem {
            part: part.to_owned(),
            message: template_problem.message,
            severity: match template_problem.severity {
                TemplateProblemSeverity::Error => "error",
                TemplateProblemSeverity::Warning => "warning",
            }
            .to_owned(),
        }
    }));
}
