use sendmock_core::format_rfc3339;
use sendmock_payments::parse_major_amount;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::sslcommerz_call::{SSLCOMMERZ_PROVIDER_KEY, SslcommerzCall};
use super::sslcommerz_transaction::{format_dhaka_time, read_bank_tran_id};
use crate::OperationError;
use crate::payments::{
    PaymentChange, PaymentDetail, PaymentStatus, ProviderObjectKey, find_provider_object,
    keep_provider_object, read_refundable_minor,
};

const REFUND_OBJECT_KIND: &str = "refund";
const REFUND_FIELDS: [&str; 3] = ["bank_tran_id", "refund_amount", "refund_remarks"];

/// A refund as SSLCommerz keeps it, by its `refund_ref_id`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct SslcommerzRefund {
    bank_tran_id: String,
    tran_id: String,
    amount_minor: u64,
    refund_remarks: String,
    refe_id: Option<String>,
    initiated_on: String,
}

fn refund_key(refund_ref_id: &str) -> ProviderObjectKey<'_> {
    ProviderObjectKey {
        provider: SSLCOMMERZ_PROVIDER_KEY,
        object_kind: REFUND_OBJECT_KIND,
        object_id: refund_ref_id,
    }
}

fn describe_refused_refund(bank_tran_id: &str, error_reason: &str) -> Value {
    json!({
        "APIConnect": "DONE",
        "bank_tran_id": bank_tran_id,
        "trans_id": "",
        "refund_ref_id": "",
        "status": "failed",
        "errorReason": error_reason,
    })
}

/// The amount SSLCommerz would refund, or why it refuses.
fn check_refund(payment: &PaymentDetail, refund_amount: &str) -> Result<u64, &'static str> {
    let is_refundable = matches!(
        payment.summary.status,
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded
    );
    if !is_refundable {
        return Err("The transaction is not refundable");
    }
    match parse_major_amount(refund_amount, &payment.summary.currency) {
        Some(refund_minor) if refund_minor > read_refundable_minor(payment) => {
            Err("Refund amount exceeds the refundable amount")
        }
        Some(refund_minor) if refund_minor > 0 => Ok(refund_minor),
        _ => Err("Invalid refund amount"),
    }
}

fn make_refund_ref_id(sslcommerz_call: &SslcommerzCall<'_>) -> String {
    let random_hex = format!(
        "{:016x}",
        sslcommerz_call.operation_context.random_source.next_u64()
    );
    random_hex.chars().take(13).collect()
}

/// A refund of part or all of a paid transaction, named by its `bank_tran_id`: SSLCommerz's
/// `refund_ref_id`, or its refusal.
pub async fn refund_transaction(
    sslcommerz_call: &SslcommerzCall<'_>,
) -> Result<Value, OperationError> {
    if REFUND_FIELDS
        .iter()
        .any(|field_name| sslcommerz_call.read_field(field_name).is_none())
    {
        return Ok(json!({"APIConnect": "INVALID_REQUEST"}));
    }
    let read_text = |field_name: &str| {
        sslcommerz_call
            .read_field(field_name)
            .unwrap_or_default()
            .to_owned()
    };
    let bank_tran_id = read_text("bank_tran_id");
    let Some(payment) = sslcommerz_call
        .find_payment("bank_tran_id", &bank_tran_id)
        .await?
    else {
        return Ok(describe_refused_refund(
            &bank_tran_id,
            "Invalid bank_tran_id",
        ));
    };
    let refund_minor = match check_refund(&payment, &read_text("refund_amount")) {
        Ok(refund_minor) => refund_minor,
        Err(error_reason) => return Ok(describe_refused_refund(&bank_tran_id, error_reason)),
    };
    save_refund(sslcommerz_call, payment, refund_minor).await
}

/// Refunds the payment and keeps the refund under a new `refund_ref_id`.
async fn save_refund(
    sslcommerz_call: &SslcommerzCall<'_>,
    payment: PaymentDetail,
    refund_minor: u64,
) -> Result<Value, OperationError> {
    let operation_context = sslcommerz_call.operation_context;
    let refund_ref_id = make_refund_ref_id(sslcommerz_call);
    let sslcommerz_refund = SslcommerzRefund {
        bank_tran_id: read_bank_tran_id(&payment),
        tran_id: payment.summary.provider_reference.clone(),
        amount_minor: refund_minor,
        refund_remarks: sslcommerz_call
            .read_field("refund_remarks")
            .unwrap_or_default()
            .to_owned(),
        refe_id: sslcommerz_call.read_field("refe_id").map(str::to_owned),
        initiated_on: format_dhaka_time(&format_rfc3339(operation_context.clock.now_unix_ms())),
    };
    let mut payment_change = PaymentChange::start(operation_context, payment, Vec::new()).await;
    payment_change.refund(refund_minor);
    keep_provider_object(
        &mut payment_change,
        refund_key(&refund_ref_id),
        &sslcommerz_refund,
    )?;
    payment_change.save().await?;
    Ok(json!({
        "APIConnect": "DONE",
        "bank_tran_id": sslcommerz_refund.bank_tran_id,
        "trans_id": sslcommerz_refund.tran_id,
        "refund_ref_id": refund_ref_id,
        "status": "success",
        "errorReason": "",
    }))
}

/// A refund's status by its `refund_ref_id`: `refunded`, or `failed` for one SSLCommerz
/// does not know.
pub async fn query_refund(
    sslcommerz_call: &SslcommerzCall<'_>,
    refund_ref_id: &str,
) -> Result<Value, OperationError> {
    let stored_refund = find_provider_object::<SslcommerzRefund>(
        sslcommerz_call.operation_context,
        refund_key(refund_ref_id),
    )
    .await?;
    let Some((_, sslcommerz_refund)) = stored_refund else {
        return Ok(json!({
            "APIConnect": "DONE",
            "refund_ref_id": refund_ref_id,
            "status": "failed",
            "errorReason": "Invalid refund_ref_id",
        }));
    };
    Ok(json!({
        "APIConnect": "DONE",
        "bank_tran_id": sslcommerz_refund.bank_tran_id,
        "tran_id": sslcommerz_refund.tran_id,
        "refund_ref_id": refund_ref_id,
        "initiated_on": sslcommerz_refund.initiated_on,
        "refunded_on": sslcommerz_refund.initiated_on,
        "status": "refunded",
        "errorReason": "",
    }))
}
