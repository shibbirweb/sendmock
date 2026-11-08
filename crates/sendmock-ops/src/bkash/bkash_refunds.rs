use sendmock_payments::{format_major_amount, parse_major_amount};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::bkash_call::{BKASH_PROVIDER_KEY, BkashCall};
use super::bkash_error::{BkashError, mark_successful};
use super::bkash_execution::find_execution;
use super::bkash_payment::{format_bkash_time, read_payment_id};
use crate::OperationError;
use crate::payments::{
    PaymentChange, PaymentDetail, PaymentStatus, ProviderObjectKey, keep_provider_object,
    list_payment_provider_objects, read_refundable_minor,
};

const REFUND_OBJECT_KIND: &str = "refund";

/// A refund as bKash keeps it, by its `refundTrxID`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct BkashRefund {
    original_trx_id: String,
    amount_minor: u64,
    sku: String,
    reason: String,
    completed_at_unix_ms: i64,
}

fn describe_refund(refund_trx_id: &str, bkash_refund: &BkashRefund, currency: &str) -> Value {
    mark_successful(json!({
        "completedTime": format_bkash_time(bkash_refund.completed_at_unix_ms),
        "transactionStatus": "Completed",
        "originalTrxID": bkash_refund.original_trx_id,
        "refundTrxID": refund_trx_id,
        "amount": format_major_amount(bkash_refund.amount_minor, currency),
        "currency": currency,
        "charge": "0.00",
    }))
}

fn read_trx_id(payment: &PaymentDetail) -> String {
    payment
        .provider_ids
        .get("trx_id")
        .cloned()
        .unwrap_or_default()
}

/// The executed payment the call names by `paymentID` and `trxID`.
async fn find_refundable_payment(
    bkash_call: &BkashCall<'_>,
) -> Result<Result<PaymentDetail, BkashError>, OperationError> {
    if let Err(header_error) = bkash_call.check_payment_headers() {
        return Ok(Err(header_error));
    }
    let named_payment = match bkash_call.read_field("paymentID") {
        Some(payment_id) => bkash_call.find_payment(&payment_id).await?,
        None => None,
    };
    let Some(payment) = named_payment
        .filter(|payment| bkash_call.read_field("trxID") == Some(read_trx_id(payment)))
    else {
        return Ok(Err(BkashError::INVALID_PAYMENT_ID));
    };
    let is_executed = find_execution(bkash_call.operation_context, read_payment_id(&payment))
        .await?
        .is_some();
    if !is_executed {
        return Ok(Err(BkashError::INVALID_PAYMENT_STATE));
    }
    Ok(Ok(payment))
}

fn check_refund_amount(payment: &PaymentDetail, amount_text: &str) -> Result<u64, BkashError> {
    let is_refundable = matches!(
        payment.summary.status,
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded
    );
    if !is_refundable {
        return Err(BkashError::INVALID_PAYMENT_STATE);
    }
    match parse_major_amount(amount_text, &payment.summary.currency) {
        Some(refund_minor) if refund_minor > read_refundable_minor(payment) => {
            Err(BkashError::REFUND_EXCEEDS)
        }
        Some(refund_minor) if refund_minor > 0 => Ok(refund_minor),
        _ => Err(BkashError::INVALID_AMOUNT),
    }
}

/// `POST /tokenized/checkout/payment/refund` with `amount`: refunds part or all of an executed
/// payment; without `amount`, the payment's latest refund.
pub async fn refund_payment(bkash_call: &BkashCall<'_>) -> Result<Value, OperationError> {
    let payment = match find_refundable_payment(bkash_call).await? {
        Ok(payment) => payment,
        Err(bkash_error) => return Ok(bkash_error.describe()),
    };
    let Some(amount_text) = bkash_call.read_field("amount") else {
        return query_latest_refund(bkash_call, &payment).await;
    };
    let refund_minor = match check_refund_amount(&payment, &amount_text) {
        Ok(refund_minor) => refund_minor,
        Err(bkash_error) => return Ok(bkash_error.describe()),
    };
    let operation_context = bkash_call.operation_context;
    let refund_trx_id = format!(
        "{:010X}",
        operation_context.random_source.next_u64() % 0xFF_FFFF_FFFF
    );
    let bkash_refund = BkashRefund {
        original_trx_id: read_trx_id(&payment),
        amount_minor: refund_minor,
        sku: bkash_call.read_field("sku").unwrap_or_default(),
        reason: bkash_call.read_field("reason").unwrap_or_default(),
        completed_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    let currency = payment.summary.currency.clone();
    let mut payment_change = PaymentChange::start(operation_context, payment, Vec::new()).await;
    payment_change.refund(refund_minor);
    let refund_key = ProviderObjectKey {
        provider: BKASH_PROVIDER_KEY,
        object_kind: REFUND_OBJECT_KIND,
        object_id: &refund_trx_id,
    };
    keep_provider_object(&mut payment_change, refund_key, &bkash_refund)?;
    payment_change.save().await?;
    Ok(describe_refund(&refund_trx_id, &bkash_refund, &currency))
}

async fn query_latest_refund(
    bkash_call: &BkashCall<'_>,
    payment: &PaymentDetail,
) -> Result<Value, OperationError> {
    let refunds: Vec<(String, BkashRefund)> = list_payment_provider_objects(
        bkash_call.operation_context,
        &payment.summary.id,
        REFUND_OBJECT_KIND,
    )
    .await?;
    Ok(match refunds.last() {
        Some((refund_trx_id, bkash_refund)) => {
            describe_refund(refund_trx_id, bkash_refund, &payment.summary.currency)
        }
        None => BkashError::INVALID_PAYMENT_STATE.describe(),
    })
}
