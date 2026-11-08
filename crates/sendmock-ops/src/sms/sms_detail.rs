use schemars::JsonSchema;
use sendmock_store::SmsRecord;
use serde::Serialize;
use serde_json::Value;

use super::sms_reply_webhook_views::SmsReplyWebhookAttempt;
use super::sms_views::{SmsCallbackAttempt, SmsMessage, SmsStatusChange};
use crate::{OperationContext, OperationError};

/// One message with its status history, the request that created it and its callbacks.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsMessageDetail {
    #[serde(flatten)]
    pub message: SmsMessage,
    pub status_history: Vec<SmsStatusChange>,
    #[schemars(required, schema_with = "crate::nullable_schema::<Value>")]
    pub request_body: Option<Value>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub api_request_id: Option<String>,
    pub callback_attempts: Vec<SmsCallbackAttempt>,
    /// Inbound only, oldest first; every resend adds attempts.
    pub reply_webhook_attempts: Vec<SmsReplyWebhookAttempt>,
}

pub async fn load_sms_detail(
    operation_context: &OperationContext,
    sms: SmsRecord,
) -> Result<SmsMessageDetail, OperationError> {
    let sms_repository = &operation_context.sms_repository;
    let status_history = sms_repository.list_status_history(&sms.sms_id).await?;
    let callback_attempts = operation_context
        .sms_callback_attempt_repository
        .list_sent_attempts(&sms.sms_id)
        .await?;
    let reply_webhook_attempts = operation_context
        .sms_reply_webhook_repository
        .list_attempts(&sms.sms_id)
        .await?;
    Ok(SmsMessageDetail {
        message: SmsMessage::from(&sms),
        status_history: status_history
            .into_iter()
            .map(SmsStatusChange::from)
            .collect(),
        request_body: sms
            .request_body_json
            .as_deref()
            .and_then(|request_body_json| serde_json::from_str(request_body_json).ok()),
        api_request_id: sms.api_request_id.clone(),
        callback_attempts: callback_attempts
            .into_iter()
            .map(SmsCallbackAttempt::from)
            .collect(),
        reply_webhook_attempts: reply_webhook_attempts
            .into_iter()
            .map(SmsReplyWebhookAttempt::from)
            .collect(),
    })
}

/// The message by id, or the contract's not-found error.
pub async fn find_sms_or_not_found(
    operation_context: &OperationContext,
    sms_id: &str,
) -> Result<SmsRecord, OperationError> {
    operation_context
        .sms_repository
        .find_message(sms_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No SMS with id {sms_id}"),
        })
}
