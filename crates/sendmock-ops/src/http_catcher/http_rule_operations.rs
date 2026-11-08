use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::captured_request_operations::HttpRequestReference;
use super::http_bin_operations::find_bin_or_not_found;
use super::http_catcher_views::present_captured_request;
use super::http_catcher_wire::{HttpBinReference, HttpMockResponse};
use super::http_response_rules::{
    HttpResponseRule, build_response_context, check_response_rule, match_response_rule,
    render_mock_response,
};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpRulesReplacement {
    /// The bin's ID, from `GET /api/v1/http/bins`.
    pub bin_id: String,
    pub rules: Vec<HttpResponseRule>,
}

/// Body of `POST /api/v1/http/bins/{binId}/responses/preview`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpRulePreviewRequest {
    /// The bin's ID, from `GET /api/v1/http/bins`.
    pub bin_id: String,
    /// The rule as edited, saved or not.
    pub rule: HttpResponseRule,
    /// A captured request of the bin to try the rule on.
    pub request_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HttpRulePreviewResult {
    pub is_match: bool,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub mismatch_reason: Option<String>,
    /// The reply the rule would render for the request.
    pub response: HttpMockResponse,
    pub problems: Vec<String>,
}

pub fn read_bin_rules(rules_json: &str) -> Vec<HttpResponseRule> {
    serde_json::from_str(rules_json).unwrap_or_default()
}

pub struct ListHttpResponseRulesOperation;

impl Operation for ListHttpResponseRulesOperation {
    type Input = HttpBinReference;
    type Output = Vec<HttpResponseRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getHttpBinsByBinIdResponses",
            method: HttpMethod::Get,
            path: "/api/v1/http/bins/{binId}/responses",
            summary: "A bin's response rules, checked from top to bottom.",
            is_read_only: true,
            cli_usage: "sendmock http response list <binId>",
            mcp_tool: "sendmock_http_response_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpBinReference,
    ) -> Result<Vec<HttpResponseRule>, OperationError> {
        let stored_bin = find_bin_or_not_found(operation_context, &input.bin_id).await?;
        Ok(read_bin_rules(&stored_bin.rules_json))
    }
}

pub struct ReplaceHttpResponseRulesOperation;

impl Operation for ReplaceHttpResponseRulesOperation {
    type Input = HttpRulesReplacement;
    type Output = Vec<HttpResponseRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "putHttpBinsByBinIdResponses",
            method: HttpMethod::Put,
            path: "/api/v1/http/bins/{binId}/responses",
            summary: "Replace a bin's response rules.",
            cli_usage: "sendmock http response set <binId>",
            mcp_tool: "sendmock_http_response_set",
            array_body_input: Some("rules"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRulesReplacement,
    ) -> Result<Vec<HttpResponseRule>, OperationError> {
        let stored_bin = find_bin_or_not_found(operation_context, &input.bin_id).await?;
        for response_rule in &input.rules {
            check_response_rule(response_rule)?;
        }
        let rules_json = serde_json::to_string(&input.rules)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        operation_context
            .http_catcher_stores
            .bins
            .update_bin_answers(&input.bin_id, stored_bin.default_response_json, rules_json)
            .await?;
        Ok(input.rules)
    }
}

pub struct PreviewHttpResponseRuleOperation;

impl Operation for PreviewHttpResponseRuleOperation {
    type Input = HttpRulePreviewRequest;
    type Output = HttpRulePreviewResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postHttpBinsByBinIdResponsesPreview",
            method: HttpMethod::Post,
            path: "/api/v1/http/bins/{binId}/responses/preview",
            summary: "Which rule a captured request would match, and its answer.",
            is_read_only: true,
            cli_usage: "sendmock http response preview <binId>",
            mcp_tool: "sendmock_http_response_preview",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRulePreviewRequest,
    ) -> Result<HttpRulePreviewResult, OperationError> {
        find_bin_or_not_found(operation_context, &input.bin_id).await?;
        let reference = HttpRequestReference {
            request_id: input.request_id.clone(),
        };
        let captured_request = operation_context
            .http_catcher_stores
            .requests
            .find_request(&reference.request_id)
            .await?
            .map(present_captured_request)
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No captured request with id {}", input.request_id),
            })?;
        let response_context = build_response_context(operation_context, &captured_request).await?;
        let (response, problems) =
            render_mock_response(operation_context, &input.rule.response, &response_context);
        let rule_match = match_response_rule(&input.rule, &captured_request);
        Ok(HttpRulePreviewResult {
            is_match: rule_match.is_ok(),
            mismatch_reason: rule_match.err(),
            response,
            problems,
        })
    }
}
