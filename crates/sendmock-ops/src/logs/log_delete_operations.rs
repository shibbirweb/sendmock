use sendmock_store::{ApiRequestFilter, SmtpSessionFilter};

use super::log_inputs::{
    ApiRequestFilterQuery, ApiRequestReference, SmtpSessionFilterQuery, SmtpSessionReference,
};
use super::smtp_log_operations::read_failed_filter;
use crate::events::publish_traffic_cleared;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

fn log_delete_definition(
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method: HttpMethod::Delete,
        path,
        summary,
        is_destructive: true,
        cli_usage,
        mcp_tool,
        success_status: SuccessStatus::NoContent,
        ..OperationDefinition::DEFAULTS
    }
}

pub struct DeleteSmtpSessionOperation;

impl Operation for DeleteSmtpSessionOperation {
    type Input = SmtpSessionReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        log_delete_definition(
            "deleteLogsSmtpBySessionId",
            "/api/v1/logs/smtp/{sessionId}",
            "Delete one SMTP session.",
            "sendmock logs smtp delete <sessionId>",
            "sendmock_logs_smtp_delete",
        )
    }

    /// Deleting a session that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmtpSessionReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .logs
            .smtp_sessions
            .delete_session(&input.session_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeleteSmtpSessionsOperation;

impl Operation for DeleteSmtpSessionsOperation {
    type Input = SmtpSessionFilterQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        log_delete_definition(
            "deleteLogsSmtp",
            "/api/v1/logs/smtp",
            "Delete every SMTP session, or those the filters match.",
            "sendmock logs smtp delete-all --yes",
            "sendmock_logs_smtp_delete_all",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmtpSessionFilterQuery,
    ) -> Result<NoContent, OperationError> {
        let deleted_count = operation_context
            .logs
            .smtp_sessions
            .delete_matching_sessions(SmtpSessionFilter {
                is_failed: read_failed_filter(input.result.as_deref())?,
                search_text: input.query.filter(|query| !query.trim().is_empty()),
            })
            .await?;
        publish_traffic_cleared(operation_context, &["smtp_session"], None, deleted_count);
        Ok(NoContent)
    }
}

pub struct DeleteApiRequestOperation;

impl Operation for DeleteApiRequestOperation {
    type Input = ApiRequestReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        log_delete_definition(
            "deleteLogsHttpByRequestId",
            "/api/v1/logs/http/{requestId}",
            "Delete one API request log entry.",
            "sendmock logs http delete <requestId>",
            "sendmock_logs_http_delete",
        )
    }

    /// Deleting an entry that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ApiRequestReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .logs
            .api_requests
            .delete_request(&input.request_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeleteApiRequestsOperation;

impl Operation for DeleteApiRequestsOperation {
    type Input = ApiRequestFilterQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        log_delete_definition(
            "deleteLogsHttp",
            "/api/v1/logs/http",
            "Delete every API request log entry, or those the filters match.",
            "sendmock logs http delete-all --yes",
            "sendmock_logs_http_delete_all",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ApiRequestFilterQuery,
    ) -> Result<NoContent, OperationError> {
        let deleted_count = operation_context
            .logs
            .api_requests
            .delete_matching_requests(ApiRequestFilter {
                api: input.api.filter(|api| !api.trim().is_empty()),
                status_hundreds: input
                    .status_class
                    .map(|status_class| status_class.hundreds_digit()),
                path_contains: input.path.filter(|path| !path.trim().is_empty()),
            })
            .await?;
        publish_traffic_cleared(operation_context, &["api_request"], None, deleted_count);
        Ok(NoContent)
    }
}
