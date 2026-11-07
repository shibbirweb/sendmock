use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::bkash_call::{BKASH_PROVIDER_KEY, BkashCall};
use super::bkash_error::{BkashError, mark_successful};
use super::bkash_payment::{
    describe_bkash_payment, format_bkash_time, read_customer_msisdn, read_payment_id,
};
use crate::payments::{
    PaymentCaptureMethod, PaymentDetail, PaymentStatus, ProviderObjectKey, find_provider_object,
    save_provider_object,
};
use crate::{OperationContext, OperationError};

const EXECUTION_OBJECT_KIND: &str = "execution";

/// When the app executed the payment; bKash refuses a second execute.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BkashExecution {
    pub executed_at_unix_ms: i64,
}

fn execution_key(payment_id: &str) -> ProviderObjectKey<'_> {
    ProviderObjectKey {
        provider: BKASH_PROVIDER_KEY,
        object_kind: EXECUTION_OBJECT_KIND,
        object_id: payment_id,
    }
}

pub async fn find_execution(
    operation_context: &OperationContext,
    payment_id: &str,
) -> Result<Option<BkashExecution>, OperationError> {
    Ok(
        find_provider_object::<BkashExecution>(operation_context, execution_key(payment_id))
            .await?
            .map(|(_, bkash_execution)| bkash_execution),
    )
}

/// Whether the customer finished paying (or authorizing) on the checkout page.
fn has_customer_paid(payment: &PaymentDetail) -> bool {
    matches!(
        payment.summary.status,
        PaymentStatus::Authorized
            | PaymentStatus::Succeeded
            | PaymentStatus::Refunded
            | PaymentStatus::PartiallyRefunded
            | PaymentStatus::Disputed
    )
}

fn read_executed_status(payment: &PaymentDetail) -> &'static str {
    if payment.capture_method == PaymentCaptureMethod::Manual
        && payment.summary.status == PaymentStatus::Authorized
    {
        "Authorized"
    } else {
        "Completed"
    }
}

/// `trxID` and the payer, once the payment is executed.
fn describe_executed_payment(payment: &PaymentDetail, bkash_execution: &BkashExecution) -> Value {
    let mut executed = describe_bkash_payment(payment);
    let executed_fields = [
        (
            "paymentExecuteTime",
            format_bkash_time(bkash_execution.executed_at_unix_ms),
        ),
        (
            "trxID",
            payment
                .provider_ids
                .get("trx_id")
                .cloned()
                .unwrap_or_default(),
        ),
        (
            "transactionStatus",
            read_executed_status(payment).to_owned(),
        ),
        ("customerMsisdn", read_customer_msisdn(payment)),
        ("payerAccount", read_customer_msisdn(payment)),
        ("payerType", "Customer".to_owned()),
    ];
    for (field_name, field_value) in executed_fields {
        executed.insert(field_name.to_owned(), Value::from(field_value));
    }
    mark_successful(Value::Object(executed))
}

/// Why a payment the customer has not paid cannot be executed.
fn refuse_unpaid(payment: &PaymentDetail) -> Value {
    let is_short_of_balance = payment.summary.status == PaymentStatus::Failed
        && payment.summary.failure_code.as_deref() == Some("insufficient_funds");
    if is_short_of_balance {
        BkashError::INSUFFICIENT_BALANCE.describe()
    } else {
        BkashError::INVALID_PAYMENT_STATE.describe()
    }
}

async fn read_named_payment(
    bkash_call: &BkashCall<'_>,
) -> Result<Result<PaymentDetail, BkashError>, OperationError> {
    if let Err(header_error) = bkash_call.check_payment_headers() {
        return Ok(Err(header_error));
    }
    let Some(payment_id) = bkash_call.read_field("paymentID") else {
        return Ok(Err(BkashError::INVALID_PAYMENT_ID));
    };
    Ok(bkash_call
        .find_payment(&payment_id)
        .await?
        .ok_or(BkashError::INVALID_PAYMENT_ID))
}

/// `POST /tokenized/checkout/execute`: completes a payment the customer paid on the
/// checkout page, once.
pub async fn execute_payment(bkash_call: &BkashCall<'_>) -> Result<Value, OperationError> {
    let payment = match read_named_payment(bkash_call).await? {
        Ok(payment) => payment,
        Err(bkash_error) => return Ok(bkash_error.describe()),
    };
    if !has_customer_paid(&payment) {
        return Ok(refuse_unpaid(&payment));
    }
    let operation_context = bkash_call.operation_context;
    let payment_id = read_payment_id(&payment).to_owned();
    if find_execution(operation_context, &payment_id)
        .await?
        .is_some()
    {
        return Ok(BkashError::ALREADY_COMPLETED.describe());
    }
    let bkash_execution = BkashExecution {
        executed_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    save_provider_object(
        operation_context,
        execution_key(&payment_id),
        &payment.summary.id,
        &bkash_execution,
    )
    .await?;
    Ok(describe_executed_payment(&payment, &bkash_execution))
}

fn read_waiting_status(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::Failed => "Failed",
        PaymentStatus::Canceled => "Cancelled",
        _ => "Initiated",
    }
}

/// `POST /tokenized/checkout/payment/status`: the payment as it stands.
pub async fn query_payment(bkash_call: &BkashCall<'_>) -> Result<Value, OperationError> {
    let payment = match read_named_payment(bkash_call).await? {
        Ok(payment) => payment,
        Err(bkash_error) => return Ok(bkash_error.describe()),
    };
    let execution = find_execution(bkash_call.operation_context, read_payment_id(&payment)).await?;
    if let Some(bkash_execution) = execution.filter(|_| has_customer_paid(&payment)) {
        return Ok(describe_executed_payment(&payment, &bkash_execution));
    }
    let mut waiting = describe_bkash_payment(&payment);
    waiting.insert(
        "transactionStatus".to_owned(),
        Value::from(read_waiting_status(&payment)),
    );
    Ok(mark_successful(Value::Object(waiting)))
}
