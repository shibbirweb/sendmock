use sendmock_store::ApiRequestFilter;

use super::api_request_log_entry::ApiRequestLogEntry;
use super::log_inputs::{ApiRequestListInput, ApiRequestReference, read_page_size};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, PageOf};

pub struct ListApiRequestsOperation;

impl Operation for ListApiRequestsOperation {
    type Input = ApiRequestListInput;
    type Output = PageOf<ApiRequestLogEntry>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getLogsHttp",
            method: HttpMethod::Get,
            path: "/api/v1/logs/http",
            summary: "Requests to the native and provider APIs, newest first.",
            is_read_only: true,
            cli_usage: "sendmock logs http",
            mcp_tool: "sendmock_logs_http",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ApiRequestListInput,
    ) -> Result<PageOf<ApiRequestLogEntry>, OperationError> {
        let filter = ApiRequestFilter {
            api: input.api.filter(|api| !api.trim().is_empty()),
            status_hundreds: input
                .status_class
                .map(|status_class| status_class.hundreds_digit()),
            path_contains: input.path.filter(|path| !path.trim().is_empty()),
        };
        let page = operation_context
            .api_request_repository
            .list_requests(filter, input.cursor, read_page_size(input.limit))
            .await?;
        Ok(PageOf {
            items: page
                .requests
                .into_iter()
                .map(ApiRequestLogEntry::from)
                .collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetApiRequestOperation;

impl Operation for GetApiRequestOperation {
    type Input = ApiRequestReference;
    type Output = ApiRequestLogEntry;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getLogsHttpByRequestId",
            method: HttpMethod::Get,
            path: "/api/v1/logs/http/{requestId}",
            summary: "One API request with its request and response.",
            is_read_only: true,
            cli_usage: "sendmock logs http show <requestId>",
            mcp_tool: "sendmock_logs_http_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ApiRequestReference,
    ) -> Result<ApiRequestLogEntry, OperationError> {
        operation_context
            .api_request_repository
            .find_request(&input.request_id)
            .await?
            .map(ApiRequestLogEntry::from)
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No API request with id {}", input.request_id),
            })
    }
}
