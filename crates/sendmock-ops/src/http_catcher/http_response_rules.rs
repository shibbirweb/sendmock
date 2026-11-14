//! A bin's response rules: which one answers a request, and the reply it renders (HC-02).

use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_core::{StandardTemplateFunctions, TemplateEscape, render_template};
use sendmock_webhooks::{FilterExpression, RuleMessage, RuleOperator};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::http_catcher_wire::{CapturedHttpRequest, HttpMockResponse};
use crate::webhooks::RuleFilter;
use crate::{OperationContext, OperationError};

const LONGEST_DELAY_MS: u32 = 30_000;

/// A reply for the requests that match its method, path glob and conditions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct HttpResponseRule {
    pub id: String,
    pub name: String,
    pub is_enabled: bool,
    /// `GET`, `POST`, ...; null matches any method.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub method: Option<String>,
    /// A glob on the path inside the bin, e.g. `/v1/*`; empty matches every path.
    pub path_glob: String,
    /// Header and body conditions; null matches every request.
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    pub response: HttpMockResponse,
    pub delay_min_ms: u32,
    pub delay_max_ms: u32,
    /// How often, out of 100, the rule answers `failure_status_code` instead.
    pub failure_rate_percent: u32,
    pub failure_status_code: u16,
}

/// `/catch/slack/v1/send` in bin `slack` is `/v1/send`; the bin root is `/`.
pub fn read_path_in_bin(captured_path: &str, bin_name: &str) -> String {
    let bin_prefix = format!("/catch/{bin_name}");
    let path_in_bin = captured_path
        .strip_prefix(&bin_prefix)
        .unwrap_or(captured_path);
    if path_in_bin.is_empty() {
        "/".to_owned()
    } else {
        path_in_bin.to_owned()
    }
}

/// Whether the rule answers the request, or why not.
pub fn match_response_rule(
    response_rule: &HttpResponseRule,
    request: &CapturedHttpRequest,
) -> Result<(), String> {
    let path_in_bin = read_path_in_bin(&request.path, &request.bin_name);
    if let Some(method) = response_rule
        .method
        .as_deref()
        .filter(|method| !method.eq_ignore_ascii_case(&request.method))
    {
        return Err(format!("Method is {}, not {method}", request.method));
    }
    let path_glob = response_rule.path_glob.trim();
    if !path_glob.is_empty() && !RuleOperator::Matches.test_value(&path_in_bin, path_glob) {
        return Err(format!("Path {path_in_bin} does not match {path_glob}"));
    }
    let rule_message = RuleMessage::default()
        .with_field("body", vec![request.body.clone()])
        .with_headers(
            request
                .headers
                .iter()
                .map(|(name, value)| (name.clone(), vec![value.clone()]))
                .collect(),
        );
    let passes_filter = response_rule
        .filter
        .as_ref()
        .map(FilterExpression::from)
        .is_none_or(|filter_expression| filter_expression.matches(&rule_message));
    if passes_filter {
        Ok(())
    } else {
        Err("The header and body conditions do not match".to_owned())
    }
}

/// The first enabled rule that matches, or `None` for the default reply.
pub fn find_answering_rule<'rules>(
    rules: &'rules [HttpResponseRule],
    request: &CapturedHttpRequest,
) -> Option<&'rules HttpResponseRule> {
    rules.iter().find(|response_rule| {
        response_rule.is_enabled && match_response_rule(response_rule, request).is_ok()
    })
}

/// What a reply template reads: `request.*`, the global `vars` and `sendmock` (HC-02.2).
pub async fn build_response_context(
    operation_context: &OperationContext,
    request: &CapturedHttpRequest,
) -> Result<Value, OperationError> {
    let global_variables: BTreeMap<String, String> = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?
        .into_iter()
        .filter(|variable| variable.endpoint_id.is_none())
        .map(|variable| (variable.name, variable.value))
        .collect();
    let instance_details = &operation_context.instance_details;
    Ok(json!({
        "request": {
            "method": request.method,
            "url": request.url,
            "path": request.path,
            "query": request.query,
            "headers": request.headers,
            "body": request.body,
            "json": serde_json::from_str::<Value>(&request.body).unwrap_or(Value::Null),
        },
        "vars": global_variables,
        "sendmock": { "version": instance_details.version, "http_url": format!("http://{}", instance_details.http_address) },
    }))
}

/// The reply with its header and body templates rendered, and the problems found.
pub fn render_mock_response(
    operation_context: &OperationContext,
    mock_response: &HttpMockResponse,
    response_context: &Value,
) -> (HttpMockResponse, Vec<String>) {
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    let mut problems: Vec<String> = Vec::new();
    let mut render_part = |template_text: &str| {
        let rendered = render_template(
            template_text,
            response_context,
            &template_functions,
            TemplateEscape::None,
        );
        problems.extend(rendered.problems.into_iter().map(|problem| problem.message));
        rendered.text
    };
    let headers = mock_response
        .headers
        .iter()
        .map(|(header_name, header_template)| (header_name.clone(), render_part(header_template)))
        .collect();
    let body = render_part(&mock_response.body);
    problems.dedup();
    (
        HttpMockResponse {
            status_code: mock_response.status_code,
            headers,
            body,
        },
        problems,
    )
}

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// The editor's rules (HC-02.4).
pub fn check_response_rule(response_rule: &HttpResponseRule) -> Result<(), OperationError> {
    let is_status_code = |status_code: u16| (100..=599).contains(&status_code);
    if response_rule.name.trim().is_empty() {
        return Err(field_error("name", "Enter a name"));
    }
    let path_glob = response_rule.path_glob.trim();
    if !path_glob.is_empty() && !path_glob.starts_with('/') {
        return Err(field_error(
            "path_glob",
            "Start the path with /, e.g. /v1/*",
        ));
    }
    crate::webhooks::validate_rule_filter(response_rule.filter.as_ref())?;
    if !is_status_code(response_rule.response.status_code) {
        return Err(field_error(
            "status_code",
            "Use a status code from 100 to 599",
        ));
    }
    if response_rule.delay_min_ms > response_rule.delay_max_ms
        || response_rule.delay_max_ms > LONGEST_DELAY_MS
    {
        return Err(field_error(
            "delay",
            "Use 0 to 30,000 ms, the shortest first",
        ));
    }
    if response_rule.failure_rate_percent > 100
        || !is_status_code(response_rule.failure_status_code)
    {
        return Err(field_error(
            "failure",
            "Use 0 to 100% and a status code from 100 to 599",
        ));
    }
    Ok(())
}
