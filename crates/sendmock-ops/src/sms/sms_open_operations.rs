use schemars::JsonSchema;
use sendmock_store::{MessageOpenRecord, SmsRecord};
use serde::Deserialize;

use super::sms_detail::find_sms_or_not_found;
use super::sms_inputs::SmsReference;
use super::sms_views::SmsMessage;
use crate::opens::{add_open_fields, build_open_record, choose_open_recording};
use crate::{
    AppEventType, HttpMethod, NoContent, OpenRecord, OpenSource, Operation, OperationContext,
    OperationDefinition, OperationError, SuccessStatus, publish_event,
};

/// Body of `POST /api/v1/sms/{smsId}/open`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsOpenRequest {
    /// The SMS's ID, from `GET /api/v1/sms`.
    pub sms_id: String,
    /// Who read it; `api` when not given.
    pub source: Option<OpenSource>,
    /// The browser or client that read it, kept in the open history.
    pub user_agent: Option<String>,
}

/// Only a message your app sent can be read by its recipient (SM-10.2).
async fn find_outbound_sms(
    operation_context: &OperationContext,
    sms_id: &str,
) -> Result<SmsRecord, OperationError> {
    let stored_sms = find_sms_or_not_found(operation_context, sms_id).await?;
    if stored_sms.direction != "outbound" {
        return Err(OperationError::Conflict {
            code: "inbound_sms",
            message: "Inbound SMS cannot be opened; only messages your app sent are read"
                .to_owned(),
        });
    }
    Ok(stored_sms)
}

pub struct RecordSmsOpenOperation;

impl Operation for RecordSmsOpenOperation {
    type Input = SmsOpenRequest;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSmsBySmsIdOpen",
            method: HttpMethod::Post,
            path: "/api/v1/sms/{smsId}/open",
            summary: "Record a read and fire sms.opened.",
            cli_usage: "sendmock sms open <smsId>",
            mcp_tool: "sendmock_sms_open",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// A view the settings leave out is answered the same way, so the UI never has to ask.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsOpenRequest,
    ) -> Result<NoContent, OperationError> {
        find_outbound_sms(operation_context, &input.sms_id).await?;
        let open_source = input.source.unwrap_or_default();
        let sms_open = build_open_record(operation_context, open_source, input.user_agent)?;
        let app_settings = operation_context.settings_store.current().await?;
        let Some(open_recording) = choose_open_recording(open_source, &app_settings) else {
            return Ok(NoContent);
        };
        let recorded_open_count = operation_context
            .sms_repository
            .record_open(&input.sms_id, sms_open.clone(), open_recording)
            .await?;
        if let Some(open_count) = recorded_open_count {
            publish_sms_opened(operation_context, &input.sms_id, &sms_open, open_count).await?;
        }
        Ok(NoContent)
    }
}

/// `sms.opened`, carrying the message as the list shows it and the open's fields; nothing
/// when the message was deleted meanwhile.
async fn publish_sms_opened(
    operation_context: &OperationContext,
    sms_id: &str,
    sms_open: &MessageOpenRecord,
    open_count: u64,
) -> Result<(), OperationError> {
    let Some(stored_sms) = operation_context
        .sms_repository
        .find_message(sms_id)
        .await?
    else {
        return Ok(());
    };
    let event_data = serde_json::to_value(SmsMessage::from(&stored_sms)).unwrap_or_default();
    publish_event(
        operation_context,
        AppEventType::SmsOpened,
        add_open_fields(event_data, sms_open, open_count),
    );
    Ok(())
}

pub struct ListSmsOpensOperation;

impl Operation for ListSmsOpensOperation {
    type Input = SmsReference;
    type Output = Vec<OpenRecord>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getSmsBySmsIdOpens",
            method: HttpMethod::Get,
            path: "/api/v1/sms/{smsId}/opens",
            summary: "Every recorded read of an outbound message, oldest first.",
            is_read_only: true,
            cli_usage: "sendmock sms opens <smsId>",
            mcp_tool: "sendmock_sms_opens",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsReference,
    ) -> Result<Vec<OpenRecord>, OperationError> {
        find_sms_or_not_found(operation_context, &input.sms_id).await?;
        let sms_opens = operation_context
            .sms_repository
            .list_opens(&input.sms_id)
            .await?;
        Ok(sms_opens.into_iter().map(OpenRecord::from).collect())
    }
}
