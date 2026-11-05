use schemars::JsonSchema;
use serde::Deserialize;

use super::http_catcher_views::present_captured_request;
use super::http_catcher_wire::CapturedHttpRequest;
use crate::{
    AnswerKind, FileAnswer, HttpMethod, NoContent, Operation, OperationContext,
    OperationDefinition, OperationError, PageOf, SuccessStatus,
};

const DEFAULT_PAGE_SIZE: u32 = 50;
const LARGEST_PAGE_SIZE: u32 = 200;

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct HttpRequestListQuery {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    /// Items per page, 1 to 200 (default 50).
    pub limit: Option<u32>,
    /// Only this bin.
    pub bin_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct HttpRequestsDeleteQuery {
    /// Only this bin.
    pub bin_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpRequestReference {
    /// The captured request's ID, from `GET /api/v1/http/requests`.
    pub request_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpFileReference {
    /// The captured request's ID, from `GET /api/v1/http/requests`.
    pub request_id: String,
    /// The file's position, from the request's `files`.
    pub file_index: u32,
}

pub struct ListHttpRequestsOperation;

impl Operation for ListHttpRequestsOperation {
    type Input = HttpRequestListQuery;
    type Output = PageOf<CapturedHttpRequest>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getHttpRequests",
            method: HttpMethod::Get,
            path: "/api/v1/http/requests",
            summary: "Captured requests, newest first.",
            is_read_only: true,
            cli_usage: "sendmock http list",
            mcp_tool: "sendmock_http_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRequestListQuery,
    ) -> Result<PageOf<CapturedHttpRequest>, OperationError> {
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, LARGEST_PAGE_SIZE);
        let captured_requests = &operation_context.http_catcher_stores.requests;
        let mut page_requests = captured_requests
            .list_requests(input.bin_id.clone(), input.cursor, page_size + 1)
            .await?;
        let has_more = page_requests.len() > usize::try_from(page_size).unwrap_or(usize::MAX);
        page_requests.truncate(usize::try_from(page_size).unwrap_or(usize::MAX));
        let next_cursor = has_more
            .then(|| {
                page_requests
                    .last()
                    .map(|last_request| last_request.request_id.clone())
            })
            .flatten();
        Ok(PageOf {
            total_count: captured_requests.count_requests(input.bin_id).await?,
            items: page_requests
                .into_iter()
                .map(present_captured_request)
                .collect(),
            next_cursor,
        })
    }
}

pub struct DeleteHttpRequestsOperation;

impl Operation for DeleteHttpRequestsOperation {
    type Input = HttpRequestsDeleteQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteHttpRequests",
            method: HttpMethod::Delete,
            path: "/api/v1/http/requests",
            summary: "Delete captured requests, all or one bin's.",
            is_destructive: true,
            cli_usage: "sendmock http clear",
            mcp_tool: "sendmock_http_clear",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRequestsDeleteQuery,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .http_catcher_stores
            .requests
            .delete_requests(input.bin_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct GetHttpRequestOperation;

impl Operation for GetHttpRequestOperation {
    type Input = HttpRequestReference;
    type Output = CapturedHttpRequest;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getHttpRequestsByRequestId",
            method: HttpMethod::Get,
            path: "/api/v1/http/requests/{requestId}",
            summary: "One captured request and what SendMock answered.",
            is_read_only: true,
            cli_usage: "sendmock http show <requestId>",
            mcp_tool: "sendmock_http_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpRequestReference,
    ) -> Result<CapturedHttpRequest, OperationError> {
        operation_context
            .http_catcher_stores
            .requests
            .find_request(&input.request_id)
            .await?
            .map(present_captured_request)
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No captured request with id {}", input.request_id),
            })
    }
}

pub struct DownloadHttpRequestFileOperation;

impl Operation for DownloadHttpRequestFileOperation {
    type Input = HttpFileReference;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getHttpRequestsByRequestIdFilesByFileIndex",
            method: HttpMethod::Get,
            path: "/api/v1/http/requests/{requestId}/files/{fileIndex}",
            summary: "Download a file uploaded in a captured request.",
            is_read_only: true,
            cli_usage: "sendmock http file <requestId> <fileIndex>",
            mcp_tool: "sendmock://http/requests/{requestId}/files/{fileIndex}",
            answer_kind: AnswerKind::File {
                content_type: "application/octet-stream",
            },
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpFileReference,
    ) -> Result<FileAnswer, OperationError> {
        let captured_file = operation_context
            .http_catcher_stores
            .requests
            .read_file(&input.request_id, input.file_index)
            .await?
            .ok_or_else(|| OperationError::NotFound {
                message: format!(
                    "No file {} in request {}",
                    input.file_index, input.request_id
                ),
            })?;
        Ok(FileAnswer {
            content_type: captured_file.content_type,
            file_name: Some(captured_file.filename),
            bytes: captured_file.content,
        })
    }
}
