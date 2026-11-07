use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::{MessageOpenRecord, TimelineRecord};
use serde::Deserialize;
use serde_json::json;

use super::email_access::find_email_or_not_found;
use super::email_inputs::EmailReference;
use super::email_summary::EmailSummary;
use crate::opens::{add_open_fields, build_open_record, choose_open_recording};
use crate::{
    AppEventType, HttpMethod, NoContent, OpenRecord, OpenSource, Operation, OperationContext,
    OperationDefinition, OperationError, SuccessStatus, publish_event,
};

/// Body of `POST /api/v1/emails/{emailId}/open`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailOpenRequest {
    pub email_id: String,
    /// Who opened it; `api` when not given.
    pub source: Option<OpenSource>,
    /// The browser or client that opened it, kept in the open history.
    pub user_agent: Option<String>,
}

pub struct RecordEmailOpenOperation;

impl Operation for RecordEmailOpenOperation {
    type Input = EmailOpenRequest;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdOpen",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/open",
            summary: "Record an open and fire email.opened.",
            cli_usage: "sendmock email open <emailId>",
            mcp_tool: "sendmock_email_open",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// A view the settings leave out is answered the same way, so the UI never has to ask.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailOpenRequest,
    ) -> Result<NoContent, OperationError> {
        find_email_or_not_found(operation_context, &input.email_id).await?;
        let open_source = input.source.unwrap_or_default();
        let email_open = build_open_record(operation_context, open_source, input.user_agent)?;
        let app_settings = operation_context.settings_store.current().await?;
        let Some(open_recording) = choose_open_recording(open_source, &app_settings) else {
            return Ok(NoContent);
        };
        let timeline_entry = TimelineRecord {
            kind: "opened".to_owned(),
            happened_at_unix_ms: email_open.opened_at_unix_ms,
            detail: open_source.describe_open().to_owned(),
        };
        let recorded_open_count = operation_context
            .email_repository
            .record_open(
                &input.email_id,
                email_open.clone(),
                timeline_entry,
                open_recording,
            )
            .await?;
        if let Some(open_count) = recorded_open_count {
            publish_email_opened(operation_context, &input.email_id, &email_open, open_count)
                .await?;
        }
        Ok(NoContent)
    }
}

/// `email.opened`, carrying the email as the list shows it with its first open time and the
/// open's fields; nothing when the email was deleted meanwhile.
async fn publish_email_opened(
    operation_context: &OperationContext,
    email_id: &str,
    email_open: &MessageOpenRecord,
    open_count: u64,
) -> Result<(), OperationError> {
    let Some(stored_email) = operation_context
        .email_repository
        .find_email(email_id)
        .await?
    else {
        return Ok(());
    };
    let mut event_data =
        serde_json::to_value(EmailSummary::from(&stored_email)).unwrap_or_default();
    event_data["opened_at"] = json!(stored_email.opened_at_unix_ms.map(format_rfc3339));
    publish_event(
        operation_context,
        AppEventType::EmailOpened,
        add_open_fields(event_data, email_open, open_count),
    );
    Ok(())
}

pub struct ListEmailOpensOperation;

impl Operation for ListEmailOpensOperation {
    type Input = EmailReference;
    type Output = Vec<OpenRecord>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getEmailsByEmailIdOpens",
            method: HttpMethod::Get,
            path: "/api/v1/emails/{emailId}/opens",
            summary: "Every recorded open of the email, oldest first.",
            is_read_only: true,
            cli_usage: "sendmock email opens <emailId>",
            mcp_tool: "sendmock_email_opens",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<Vec<OpenRecord>, OperationError> {
        find_email_or_not_found(operation_context, &input.email_id).await?;
        let email_opens = operation_context
            .email_repository
            .list_opens(&input.email_id)
            .await?;
        Ok(email_opens.into_iter().map(OpenRecord::from).collect())
    }
}
