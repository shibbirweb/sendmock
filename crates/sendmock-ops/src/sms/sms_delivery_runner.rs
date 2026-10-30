use std::time::Duration;

use sendmock_sms::{DeliveryChange, DeliveryStep};
use sendmock_store::{SmsRecord, SmsStatusChangeRecord};
use serde_json::json;

use super::sms_change_operations::apply_status_change;
use super::status_callback::send_status_callback;
use crate::{AppEventType, OperationContext, OperationError, publish_event};

/// A status change already applied, waiting for its callback.
type PendingCallback = (SmsRecord, SmsStatusChangeRecord);

/// Applies the steps due now before answering, so the `instant` profile answers `delivered`,
/// then plays the later steps in the background. Callbacks go out in status order, starting
/// with `queued`, from one background task per message.
pub async fn start_sms_delivery(
    operation_context: &OperationContext,
    sms: SmsRecord,
    delivery_steps: Vec<DeliveryStep>,
) -> Result<SmsRecord, OperationError> {
    let queued_change = SmsStatusChangeRecord {
        status: sms.status.clone(),
        error_code: sms.error_code.clone(),
        at_unix_ms: sms.created_at_unix_ms,
    };
    let mut pending_callbacks = vec![(sms.clone(), queued_change)];
    let mut latest_sms = sms;
    let (due_steps, later_steps): (Vec<_>, Vec<_>) = delivery_steps
        .into_iter()
        .partition(|delivery_step| delivery_step.after_ms == 0);
    for delivery_step in due_steps {
        let Some(applied_change) =
            apply_delivery_change(operation_context, &latest_sms.sms_id, delivery_step.change)
                .await?
        else {
            continue;
        };
        latest_sms = applied_change.0.clone();
        pending_callbacks.push(applied_change);
    }
    if let Some(stored_sms) = operation_context
        .sms_repository
        .find_message(&latest_sms.sms_id)
        .await?
    {
        latest_sms = stored_sms;
    }
    if latest_sms.status_callback_url.is_some() || !later_steps.is_empty() {
        let background_context = operation_context.clone();
        let sms_id = latest_sms.sms_id.clone();
        tokio::spawn(async move {
            if let Err(delivery_error) =
                play_in_background(&background_context, pending_callbacks, &sms_id, later_steps)
                    .await
            {
                tracing::warn!(sms_id, error = %delivery_error, "SMS delivery simulation stopped");
            }
        });
    }
    Ok(latest_sms)
}

async fn play_in_background(
    operation_context: &OperationContext,
    pending_callbacks: Vec<PendingCallback>,
    sms_id: &str,
    later_steps: Vec<DeliveryStep>,
) -> Result<(), OperationError> {
    let started_at = tokio::time::Instant::now();
    for (sms, status_change) in &pending_callbacks {
        send_status_callback(operation_context, sms, status_change).await?;
    }
    for delivery_step in later_steps {
        tokio::time::sleep_until(started_at + Duration::from_millis(delivery_step.after_ms)).await;
        match apply_delivery_change(operation_context, sms_id, delivery_step.change).await {
            Ok(Some((sms, status_change))) => {
                send_status_callback(operation_context, &sms, &status_change).await?;
            }
            Ok(None) => {}
            Err(OperationError::NotFound { .. }) => return Ok(()),
            Err(other_error) => return Err(other_error),
        }
    }
    Ok(())
}

/// A status change that needs a callback, or `None` for a read receipt, which has none.
async fn apply_delivery_change(
    operation_context: &OperationContext,
    sms_id: &str,
    delivery_change: DeliveryChange,
) -> Result<Option<PendingCallback>, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    match delivery_change {
        DeliveryChange::Status { status, error_code } => {
            let status_change = SmsStatusChangeRecord {
                status: status.to_owned(),
                error_code,
                at_unix_ms: now_unix_ms,
            };
            let updated_sms =
                apply_status_change(operation_context, sms_id, status_change.clone()).await?;
            Ok(Some((updated_sms, status_change)))
        }
        DeliveryChange::Read => {
            if operation_context
                .sms_repository
                .record_read_receipt(sms_id, now_unix_ms)
                .await?
            {
                publish_event(
                    operation_context,
                    AppEventType::SmsOpened,
                    json!({ "id": sms_id }),
                );
            }
            Ok(None)
        }
    }
}
