use schemars::JsonSchema;
use serde::Deserialize;

use super::captured_request_operations::HttpRequestReference;
use super::http_catcher_views::present_captured_request;
use super::http_catcher_wire::CapturedHttpRequest;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

/// `PATCH /api/v1/http/requests/{requestId}`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpRequestUpdateInput {
    /// The captured request's ID, from `GET /api/v1/http/requests`.
    pub request_id: String,
    /// Marks the request read (true) or unread (false).
    pub is_read: bool,
}

fn request_not_found(request_id: &str) -> OperationError {
    OperationError::NotFound {
        message: format!("No captured request with id {request_id}"),
    }
}

pub struct UpdateHttpRequestOperation;

impl Operation for UpdateHttpRequestOperation {
    type Input = HttpRequestUpdateInput;
    type Output = CapturedHttpRequest;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchHttpRequestsByRequestId",
            method: HttpMethod::Patch,
            path: "/api/v1/http/requests/{requestId}",
            summary: "Mark a captured request read or unread.",
            cli_usage: "sendmock http update <requestId>",
            mcp_tool: "sendmock_http_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRequestUpdateInput,
    ) -> Result<CapturedHttpRequest, OperationError> {
        let request_store = &operation_context.http_catcher_stores.requests;
        if !request_store
            .mark_request_read(&input.request_id, input.is_read)
            .await?
        {
            return Err(request_not_found(&input.request_id));
        }
        request_store
            .find_request(&input.request_id)
            .await?
            .map(present_captured_request)
            .ok_or_else(|| request_not_found(&input.request_id))
    }
}

pub struct DeleteHttpRequestOperation;

impl Operation for DeleteHttpRequestOperation {
    type Input = HttpRequestReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteHttpRequestsByRequestId",
            method: HttpMethod::Delete,
            path: "/api/v1/http/requests/{requestId}",
            summary: "Delete one captured request with its uploaded files.",
            is_destructive: true,
            cli_usage: "sendmock http delete <requestId>",
            mcp_tool: "sendmock_http_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a request that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRequestReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .http_catcher_stores
            .requests
            .delete_request(&input.request_id)
            .await?;
        Ok(NoContent)
    }
}
