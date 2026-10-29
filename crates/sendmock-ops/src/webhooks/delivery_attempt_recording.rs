use sendmock_store::{DeliveryAttemptResult, WebhookDeliveryRecord};
use sendmock_webhooks::AttemptDecision;

use super::delivery_view::WebhookDelivery;
use super::webhook_sender::WebhookSendResult;
use crate::{AppEventType, OperationContext, OperationError, RecordedHttpRequest, publish_event};

fn internal_error(message: impl ToString) -> OperationError {
    OperationError::Internal(message.to_string())
}

pub async fn record_attempt(
    operation_context: &OperationContext,
    in_flight_delivery: &WebhookDeliveryRecord,
    sent_request: &RecordedHttpRequest,
    send_result: WebhookSendResult,
    attempt_decision: AttemptDecision,
) -> Result<(), OperationError> {
    let (status, next_attempt_at_unix_ms) = match attempt_decision {
        AttemptDecision::Succeeded => ("succeeded", None),
        AttemptDecision::RetryAt {
            next_attempt_at_unix_ms,
        } => ("failed", Some(next_attempt_at_unix_ms)),
        AttemptDecision::Failed => ("failed", None),
        AttemptDecision::Exhausted => ("exhausted", None),
    };
    let error_message = send_result.error_message.or_else(|| {
        send_result
            .response
            .as_ref()
            .filter(|_| attempt_decision != AttemptDecision::Succeeded)
            .map(|response| format!("Your app answered {}", response.status_code))
    });
    let attempt_result = DeliveryAttemptResult {
        status: status.to_owned(),
        sent_request_json: Some(serde_json::to_string(sent_request).map_err(internal_error)?),
        response_json: send_result
            .response
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(internal_error)?,
        duration_ms: Some(u32::try_from(send_result.duration_ms).unwrap_or(u32::MAX)),
        error_message,
        next_attempt_at_unix_ms,
    };
    operation_context
        .webhook_delivery_repository
        .finish_attempt(&in_flight_delivery.delivery_id, attempt_result)
        .await?;
    publish_delivery_events(
        operation_context,
        &in_flight_delivery.delivery_id,
        attempt_decision,
    )
    .await
}

/// `webhook.delivered` after every attempt, and `webhook.failed` when the delivery ends
/// without success (WH-03.4).
async fn publish_delivery_events(
    operation_context: &OperationContext,
    delivery_id: &str,
    attempt_decision: AttemptDecision,
) -> Result<(), OperationError> {
    let Some(finished_delivery) = operation_context
        .webhook_delivery_repository
        .find_delivery(delivery_id)
        .await?
    else {
        return Ok(());
    };
    let delivery_data =
        serde_json::to_value(WebhookDelivery::from(finished_delivery)).map_err(internal_error)?;
    publish_event(
        operation_context,
        AppEventType::WebhookDelivered,
        delivery_data.clone(),
    );
    if matches!(
        attempt_decision,
        AttemptDecision::Failed | AttemptDecision::Exhausted
    ) {
        publish_event(
            operation_context,
            AppEventType::WebhookFailed,
            delivery_data,
        );
    }
    Ok(())
}

/// A failure before sending (deleted endpoint, unreadable row) ends the attempt as failed.
pub async fn record_unsent_attempt(
    operation_context: &OperationContext,
    in_flight_delivery: &WebhookDeliveryRecord,
    send_error: &OperationError,
) -> Result<(), OperationError> {
    operation_context
        .webhook_delivery_repository
        .finish_attempt(
            &in_flight_delivery.delivery_id,
            DeliveryAttemptResult {
                status: "failed".to_owned(),
                sent_request_json: None,
                response_json: None,
                duration_ms: None,
                error_message: Some(send_error.to_string()),
                next_attempt_at_unix_ms: None,
            },
        )
        .await?;
    publish_delivery_events(
        operation_context,
        &in_flight_delivery.delivery_id,
        AttemptDecision::Failed,
    )
    .await
}
