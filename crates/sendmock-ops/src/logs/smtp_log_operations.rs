use sendmock_store::SmtpSessionFilter;

use super::log_inputs::{SmtpSessionListInput, SmtpSessionReference, read_page_size};
use super::smtp_session_log_entry::SmtpSessionLogEntry;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, PageOf};

pub struct ListSmtpSessionsOperation;

impl Operation for ListSmtpSessionsOperation {
    type Input = SmtpSessionListInput;
    type Output = PageOf<SmtpSessionLogEntry>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getLogsSmtp",
            method: HttpMethod::Get,
            path: "/api/v1/logs/smtp",
            summary: "SMTP sessions, newest first, including rejected ones.",
            is_read_only: true,
            cli_usage: "sendmock logs smtp",
            mcp_tool: "sendmock_logs_smtp",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmtpSessionListInput,
    ) -> Result<PageOf<SmtpSessionLogEntry>, OperationError> {
        let is_failed = match input.result.as_deref() {
            None => None,
            Some("delivered") => Some(false),
            Some("failed") => Some(true),
            Some(other_result) => {
                return Err(OperationError::InvalidInput {
                    message: format!("result must be delivered or failed, not {other_result}"),
                    field: Some("result".to_owned()),
                });
            }
        };
        let filter = SmtpSessionFilter {
            is_failed,
            search_text: input.query.filter(|query| !query.trim().is_empty()),
        };
        let page = operation_context
            .smtp_session_repository
            .list_sessions(filter, input.cursor, read_page_size(input.limit))
            .await?;
        Ok(PageOf {
            items: page
                .sessions
                .into_iter()
                .map(SmtpSessionLogEntry::from)
                .collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetSmtpSessionOperation;

impl Operation for GetSmtpSessionOperation {
    type Input = SmtpSessionReference;
    type Output = SmtpSessionLogEntry;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getLogsSmtpBySessionId",
            method: HttpMethod::Get,
            path: "/api/v1/logs/smtp/{sessionId}",
            summary: "One SMTP session with its transcript.",
            is_read_only: true,
            cli_usage: "sendmock logs smtp show <sessionId>",
            mcp_tool: "sendmock_logs_smtp_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmtpSessionReference,
    ) -> Result<SmtpSessionLogEntry, OperationError> {
        operation_context
            .smtp_session_repository
            .find_session(&input.session_id)
            .await?
            .map(SmtpSessionLogEntry::from)
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No SMTP session with id {}", input.session_id),
            })
    }
}
