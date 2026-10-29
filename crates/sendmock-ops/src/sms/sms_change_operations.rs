use sendmock_store::SmsStatusChangeRecord;
use serde_json::json;

use super::sms_detail::{SmsMessageDetail, load_sms_detail};
use super::sms_inputs::{SmsReference, SmsStatusUpdate};
use super::sms_views::SmsMessage;
use super::status_callback::send_status_callback;
use crate::{
    AppEventType, HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus, publish_event,
};

/// Every status a message can have, as the contract lists them.
const SMS_STATUSES: [&str; 6] = [
    "queued",
    "sent",
    "delivered",
    "undelivered",
    "failed",
    "received",
];

pub struct DeleteSmsOperation;

impl Operation for DeleteSmsOperation {
    type Input = SmsReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteSmsBySmsId",
            method: HttpMethod::Delete,
            path: "/api/v1/sms/{smsId}",
            summary: "Delete one message.",
            is_destructive: true,
            cli_usage: "sendmock sms delete <smsId>",
            mcp_tool: "sendmock_sms_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a message that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsReference,
    ) -> Result<NoContent, OperationError> {
        if operation_context
            .sms_repository
            .delete_message(&input.sms_id)
            .await?
        {
            publish_event(
                operation_context,
                AppEventType::SmsStatus,
                json!({ "id": input.sms_id, "status": "deleted" }),
            );
        }
        Ok(NoContent)
    }
}

pub struct DeleteAllSmsOperation;

impl Operation for DeleteAllSmsOperation {
    type Input = NoInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteSms",
            method: HttpMethod::Delete,
            path: "/api/v1/sms",
            summary: "Delete every message.",
            is_destructive: true,
            cli_usage: "sendmock sms delete-all --yes",
            mcp_tool: "sendmock_sms_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        if operation_context
            .sms_repository
            .delete_all_messages()
            .await?
            > 0
        {
            publish_event(
                operation_context,
                AppEventType::SmsStatus,
                json!({ "id": null, "status": "deleted" }),
            );
        }
        Ok(NoContent)
    }
}

pub struct SetSmsStatusOperation;

impl Operation for SetSmsStatusOperation {
    type Input = SmsStatusUpdate;
    type Output = SmsMessageDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSmsBySmsIdStatus",
            method: HttpMethod::Post,
            path: "/api/v1/sms/{smsId}/status",
            summary: "Set a delivery status by hand and fire its callback.",
            cli_usage: "sendmock sms status <smsId> <status>",
            mcp_tool: "sendmock_sms_set_status",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsStatusUpdate,
    ) -> Result<SmsMessageDetail, OperationError> {
        if !SMS_STATUSES.contains(&input.status.as_str()) {
            return Err(OperationError::InvalidInput {
                message: format!("status must be one of {}", SMS_STATUSES.join(", ")),
                field: Some("status".to_owned()),
            });
        }
        let status_change = SmsStatusChangeRecord {
            status: input.status,
            error_code: input
                .error_code
                .filter(|error_code| !error_code.trim().is_empty()),
            at_unix_ms: operation_context.clock.now_unix_ms(),
        };
        let updated_sms =
            apply_status_change(operation_context, &input.sms_id, status_change.clone()).await?;
        let background_context = operation_context.clone();
        let sms_for_callback = updated_sms.clone();
        tokio::spawn(async move {
            if let Err(callback_error) =
                send_status_callback(&background_context, &sms_for_callback, &status_change).await
            {
                tracing::warn!(error = %callback_error, "could not record the status callback");
            }
        });
        load_sms_detail(operation_context, updated_sms).await
    }
}

/// Records a status change and publishes `sms.status`; callers send the status callback, so
/// callbacks for one message keep their order.
pub async fn apply_status_change(
    operation_context: &OperationContext,
    sms_id: &str,
    status_change: SmsStatusChangeRecord,
) -> Result<sendmock_store::SmsRecord, OperationError> {
    let updated_sms = operation_context
        .sms_repository
        .record_status_change(sms_id, status_change)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No SMS with id {sms_id}"),
        })?;
    publish_event(
        operation_context,
        AppEventType::SmsStatus,
        serde_json::to_value(SmsMessage::from(&updated_sms)).unwrap_or_default(),
    );
    Ok(updated_sms)
}
