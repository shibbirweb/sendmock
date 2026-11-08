use sendmock_core::format_rfc3339;
use sendmock_store::PaymentProviderObjectRecord;
use serde_json::{Value, json};

use super::paddle_entities::{
    ADJUSTMENT_OBJECT_KIND, PaddleAdjustment, describe_adjustment, describe_transaction,
    read_transaction_id,
};
use crate::payments::{PaymentDetail, list_kept_or_stored_objects};
use crate::{OperationContext, OperationError};

/// The refund an `adjustment.*` event is about: the newest Paddle adjustment, else one
/// standing for the refunds made through Simulate.
async fn describe_latest_adjustment(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    kept_provider_objects: &[PaymentProviderObjectRecord],
    occurred_at: &str,
) -> Result<Value, OperationError> {
    let adjustments: Vec<(String, PaddleAdjustment)> = list_kept_or_stored_objects(
        operation_context,
        kept_provider_objects,
        &payment.summary.id,
        ADJUSTMENT_OBJECT_KIND,
    )
    .await?;
    if let Some((adjustment_id, paddle_adjustment)) = adjustments.last() {
        return Ok(describe_adjustment(
            adjustment_id,
            paddle_adjustment,
            payment,
        ));
    }
    let standing_adjustment = PaddleAdjustment {
        transaction_id: read_transaction_id(payment).to_owned(),
        reason: "Refunded in SendMock".to_owned(),
        amount_minor: payment.summary.refunded_minor,
        is_full: payment.summary.refunded_minor >= payment.summary.amount_minor,
        created_at: occurred_at.to_owned(),
    };
    let adjustment_id = format!(
        "adj_{}",
        read_transaction_id(payment).trim_start_matches("txn_")
    );
    Ok(describe_adjustment(
        &adjustment_id,
        &standing_adjustment,
        payment,
    ))
}

/// A webhook's `occurred_at` and `data`: the adjustment for `adjustment.*` events, else the
/// transaction (`paid` for `transaction.paid`, as Paddle sends it before `completed`).
pub async fn describe_paddle_event_object(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    event_name: &str,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    let occurred_at = format_rfc3339(operation_context.clock.now_unix_ms());
    let data = if event_name.starts_with("adjustment.") {
        describe_latest_adjustment(
            operation_context,
            payment,
            kept_provider_objects,
            &occurred_at,
        )
        .await?
    } else {
        let mut transaction = describe_transaction(payment);
        if event_name == "transaction.paid" {
            transaction["status"] = Value::from("paid");
        }
        transaction
    };
    Ok(json!({ "occurred_at": occurred_at, "data": data }))
}
