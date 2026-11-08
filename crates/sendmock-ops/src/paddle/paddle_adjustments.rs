use sendmock_core::format_rfc3339;
use serde_json::Value;

use super::paddle_call::{PADDLE_PROVIDER_KEY, PaddleCall};
use super::paddle_entities::{
    ADJUSTMENT_OBJECT_KIND, PaddleAdjustment, describe_adjustment, read_transaction_id,
};
use super::paddle_error::{PaddleAnswer, PaddleError};
use crate::OperationError;
use crate::payments::{
    PaymentChange, PaymentDetail, PaymentStatus, ProviderObjectKey, keep_provider_object,
    read_refundable_minor,
};

/// The amount a refund asks for: everything left for `type: full`, else the items' amounts.
fn read_refund_amount(
    paddle_call: &PaddleCall<'_>,
    payment: &PaymentDetail,
) -> Result<(u64, bool), PaddleError> {
    let refundable_minor = read_refundable_minor(payment);
    if paddle_call.read_text("type").as_deref() == Some("full") {
        return Ok((refundable_minor, true));
    }
    let items = paddle_call
        .body_fields
        .get("items")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| PaddleError::invalid_field("items is required unless type is full"))?;
    let mut refund_minor = 0_u64;
    for item in items {
        let item_minor = match item["type"].as_str() {
            Some("full") => payment.summary.amount_minor,
            _ => item["amount"]
                .as_str()
                .and_then(|amount_text| amount_text.parse::<u64>().ok())
                .ok_or_else(|| {
                    PaddleError::invalid_field("items.amount must be a string of a whole number")
                })?,
        };
        refund_minor = refund_minor.saturating_add(item_minor);
    }
    if refund_minor == 0 || refund_minor > refundable_minor {
        return Err(PaddleError::new(
            400,
            "adjustment_amount_above_remaining_allowed",
            "The adjustment amount is more than what is left to refund on the transaction",
        ));
    }
    Ok((refund_minor, refund_minor == refundable_minor))
}

async fn find_refundable_transaction(
    paddle_call: &PaddleCall<'_>,
) -> Result<Result<PaymentDetail, PaddleError>, OperationError> {
    if paddle_call.read_text("action").as_deref() != Some("refund") {
        return Ok(Err(PaddleError::invalid_field(
            "action: SendMock makes refund adjustments only",
        )));
    }
    if paddle_call.read_text("reason").is_none() {
        return Ok(Err(PaddleError::invalid_field("reason is required")));
    }
    let transaction_id = paddle_call.read_text("transaction_id").unwrap_or_default();
    let Some(payment) = paddle_call.find_transaction(&transaction_id).await? else {
        return Ok(Err(PaddleError::not_found(&transaction_id)));
    };
    let is_completed = matches!(
        payment.summary.status,
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded
    );
    if !is_completed {
        return Ok(Err(PaddleError::new(
            400,
            "adjustment_transaction_invalid_status_for_refund",
            "Only completed transactions can be refunded",
        )));
    }
    Ok(Ok(payment))
}

/// `POST /adjustments` with `action: refund`: refunds part or all of a completed transaction.
pub async fn create_adjustment(
    paddle_call: &PaddleCall<'_>,
) -> Result<PaddleAnswer, OperationError> {
    let payment = match find_refundable_transaction(paddle_call).await? {
        Ok(payment) => payment,
        Err(paddle_error) => return Ok(Err(paddle_error)),
    };
    let (refund_minor, is_full) = match read_refund_amount(paddle_call, &payment) {
        Ok(refund_amount) => refund_amount,
        Err(paddle_error) => return Ok(Err(paddle_error)),
    };
    let operation_context = paddle_call.operation_context;
    let adjustment_id = format!(
        "adj_{}",
        operation_context
            .id_generator
            .generate_id()
            .to_string()
            .to_ascii_lowercase()
    );
    let paddle_adjustment = PaddleAdjustment {
        transaction_id: read_transaction_id(&payment).to_owned(),
        reason: paddle_call.read_text("reason").unwrap_or_default(),
        amount_minor: refund_minor,
        is_full,
        created_at: format_rfc3339(operation_context.clock.now_unix_ms()),
    };
    let mut payment_change = PaymentChange::start(operation_context, payment, Vec::new()).await;
    let adjustment_key = ProviderObjectKey {
        provider: PADDLE_PROVIDER_KEY,
        object_kind: ADJUSTMENT_OBJECT_KIND,
        object_id: &adjustment_id,
    };
    keep_provider_object(&mut payment_change, adjustment_key, &paddle_adjustment)?;
    payment_change.refund(refund_minor);
    let payment = payment_change.save().await?;
    Ok(Ok((
        201,
        describe_adjustment(&adjustment_id, &paddle_adjustment, &payment),
    )))
}
