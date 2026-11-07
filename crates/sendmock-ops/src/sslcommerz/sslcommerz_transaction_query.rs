use serde_json::{Map, Value, json};

use super::sslcommerz_call::SslcommerzCall;
use super::sslcommerz_transaction::{describe_sslcommerz_transaction, is_paid, read_provider_id};
use super::sslcommerz_validation::find_order_validation;
use crate::OperationError;
use crate::payments::{PaymentDetail, PaymentStatus};

/// The transaction as SSLCommerz's query answers it, with its status in the query's words:
/// `PENDING`, `VALID` or `VALIDATED`, `FAILED`, `CANCELLED` or `EXPIRED`.
async fn describe_queried_transaction(
    sslcommerz_call: &SslcommerzCall<'_>,
    payment: &PaymentDetail,
) -> Result<Map<String, Value>, OperationError> {
    let val_id = read_provider_id(payment, "val_id");
    let order_validation = if is_paid(payment) {
        find_order_validation(sslcommerz_call.operation_context, &val_id).await?
    } else {
        None
    };
    let transaction_status = match payment.summary.status {
        _ if is_paid(payment) && order_validation.is_some() => "VALIDATED",
        _ if is_paid(payment) => "VALID",
        PaymentStatus::Failed => "FAILED",
        PaymentStatus::Canceled if payment.summary.failure_code.as_deref() == Some("expired") => {
            "EXPIRED"
        }
        PaymentStatus::Canceled => "CANCELLED",
        _ => "PENDING",
    };
    let mut queried_transaction = describe_sslcommerz_transaction(payment, transaction_status);
    queried_transaction.remove("verify_key");
    let validated_on = order_validation
        .map(|order_validation| order_validation.validated_on)
        .unwrap_or_default();
    queried_transaction.insert("validated_on".to_owned(), Value::from(validated_on));
    queried_transaction.insert("gw_version".to_owned(), Value::from(""));
    Ok(queried_transaction)
}

/// The transaction a checkout session made, by its `sessionkey`.
pub async fn query_by_session_key(
    sslcommerz_call: &SslcommerzCall<'_>,
    session_key: &str,
) -> Result<Value, OperationError> {
    let Some(payment) = sslcommerz_call
        .find_payment("sessionkey", session_key)
        .await?
    else {
        return Ok(json!({
            "APIConnect": "DONE",
            "sessionkey": session_key,
            "status": "INVALID_TRANSACTION",
        }));
    };
    let mut queried_transaction = describe_queried_transaction(sslcommerz_call, &payment).await?;
    queried_transaction.insert("sessionkey".to_owned(), Value::from(session_key));
    queried_transaction.insert("APIConnect".to_owned(), Value::from("DONE"));
    Ok(Value::Object(queried_transaction))
}

/// The transactions made under the app's `tran_id`: the newest payment with it.
pub async fn query_by_tran_id(
    sslcommerz_call: &SslcommerzCall<'_>,
    tran_id: &str,
) -> Result<Value, OperationError> {
    let mut found_transactions = Vec::new();
    if let Some(payment) = sslcommerz_call.find_payment("tran_id", tran_id).await? {
        let queried_transaction = describe_queried_transaction(sslcommerz_call, &payment).await?;
        found_transactions.push(Value::Object(queried_transaction));
    }
    Ok(json!({
        "APIConnect": "DONE",
        "no_of_trans_found": found_transactions.len(),
        "element": found_transactions,
    }))
}
