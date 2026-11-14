use serde_json::{Map, Value};

use super::razorpay_call::{RAZORPAY_PROVIDER_KEY, RazorpayCall};
use super::razorpay_entities::{
    REFUND_OBJECT_KIND, RazorpayRefund, describe_collection, describe_payment, describe_refund,
    has_payment_attempt, read_payment_entity_id,
};
use super::razorpay_error::{RazorpayAnswer, RazorpayError};
use crate::OperationError;
use crate::payments::{
    PaymentChange, PaymentDetail, PaymentStatus, ProviderObjectKey, find_provider_object,
    keep_provider_object, list_payment_provider_objects, read_refundable_minor,
};

/// The payment the customer tried, by its `pay_` id.
async fn find_attempted_payment(
    razorpay_call: &RazorpayCall<'_>,
    payment_id: &str,
) -> Result<Result<PaymentDetail, RazorpayError>, OperationError> {
    let payment = razorpay_call.find_payment("payment", payment_id).await?;
    Ok(payment
        .filter(has_payment_attempt)
        .ok_or_else(RazorpayError::missing_id))
}

/// `GET /v1/payments/{paymentId}`.
pub async fn fetch_payment(
    razorpay_call: &RazorpayCall<'_>,
    payment_id: &str,
) -> Result<RazorpayAnswer, OperationError> {
    Ok(find_attempted_payment(razorpay_call, payment_id)
        .await?
        .map(|payment| (200, describe_payment(&payment))))
}

fn check_capture(
    razorpay_call: &RazorpayCall<'_>,
    payment: &PaymentDetail,
) -> Result<u64, RazorpayError> {
    match payment.summary.status {
        PaymentStatus::Authorized => {}
        PaymentStatus::Succeeded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Refunded
        | PaymentStatus::Disputed => {
            return Err(RazorpayError::bad_request(
                "This payment has already been captured",
            ));
        }
        _ => {
            return Err(RazorpayError::bad_request(
                "Only payments which have been authorized and not yet captured can be captured",
            ));
        }
    }
    let currency = razorpay_call
        .read_text("currency")
        .unwrap_or_default()
        .to_ascii_uppercase();
    if currency != payment.summary.currency {
        return Err(RazorpayError::invalid_field(
            "currency",
            "The currency should be same as the payment currency",
        ));
    }
    match razorpay_call.read_whole_number("amount") {
        Some(capture_minor) if capture_minor == payment.summary.amount_minor => Ok(capture_minor),
        Some(_) => Err(RazorpayError::invalid_field(
            "amount",
            "Capture amount must be equal to the amount authorized",
        )),
        None => Err(RazorpayError::invalid_field(
            "amount",
            "The amount field is required.",
        )),
    }
}

/// `POST /v1/payments/{paymentId}/capture` for the authorized amount, in the payment's currency.
pub async fn capture_payment(
    razorpay_call: &RazorpayCall<'_>,
    payment_id: &str,
) -> Result<RazorpayAnswer, OperationError> {
    let payment = match find_attempted_payment(razorpay_call, payment_id).await? {
        Ok(payment) => payment,
        Err(razorpay_error) => return Ok(Err(razorpay_error)),
    };
    let capture_minor = match check_capture(razorpay_call, &payment) {
        Ok(capture_minor) => capture_minor,
        Err(razorpay_error) => return Ok(Err(razorpay_error)),
    };
    let mut payment_change =
        PaymentChange::start(razorpay_call.operation_context, payment, Vec::new()).await;
    payment_change.capture(capture_minor);
    let payment = payment_change.save().await?;
    Ok(Ok((200, describe_payment(&payment))))
}

fn check_refund(
    razorpay_call: &RazorpayCall<'_>,
    payment: &PaymentDetail,
) -> Result<u64, RazorpayError> {
    let is_refundable = matches!(
        payment.summary.status,
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded
    );
    if !is_refundable {
        return Err(RazorpayError::bad_request(
            "The payment has not been captured or is already fully refunded",
        ));
    }
    let refundable_minor = read_refundable_minor(payment);
    match razorpay_call.read_whole_number("amount") {
        None => Ok(refundable_minor),
        Some(refund_minor) if refund_minor > refundable_minor => Err(RazorpayError::invalid_field(
            "amount",
            "The refund amount provided is greater than amount captured",
        )),
        Some(0) => Err(RazorpayError::invalid_field(
            "amount",
            "The amount must be at least 100.",
        )),
        Some(refund_minor) => Ok(refund_minor),
    }
}

fn read_refund_notes(razorpay_call: &RazorpayCall<'_>) -> Map<String, Value> {
    match razorpay_call.read_field("notes") {
        Some(Value::Object(notes)) => notes.clone(),
        _ => Map::new(),
    }
}

fn refund_key(refund_id: &str) -> ProviderObjectKey<'_> {
    ProviderObjectKey {
        provider: RAZORPAY_PROVIDER_KEY,
        object_kind: REFUND_OBJECT_KIND,
        object_id: refund_id,
    }
}

/// `POST /v1/payments/{paymentId}/refund`: all that is left, or `amount`.
pub async fn refund_payment(
    razorpay_call: &RazorpayCall<'_>,
    payment_id: &str,
) -> Result<RazorpayAnswer, OperationError> {
    let payment = match find_attempted_payment(razorpay_call, payment_id).await? {
        Ok(payment) => payment,
        Err(razorpay_error) => return Ok(Err(razorpay_error)),
    };
    let refund_minor = match check_refund(razorpay_call, &payment) {
        Ok(refund_minor) => refund_minor,
        Err(razorpay_error) => return Ok(Err(razorpay_error)),
    };
    let operation_context = razorpay_call.operation_context;
    let refund_id = format!(
        "rfnd_{}",
        read_id_suffix(&operation_context.id_generator.generate_id().to_string())
    );
    let razorpay_refund = RazorpayRefund {
        payment_id: read_payment_entity_id(&payment).to_owned(),
        amount_minor: refund_minor,
        notes: read_refund_notes(razorpay_call),
        receipt: razorpay_call.read_text("receipt"),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    let currency = payment.summary.currency.clone();
    let mut payment_change = PaymentChange::start(operation_context, payment, Vec::new()).await;
    keep_provider_object(
        &mut payment_change,
        refund_key(&refund_id),
        &razorpay_refund,
    )?;
    payment_change.refund(refund_minor);
    payment_change.save().await?;
    Ok(Ok((
        200,
        describe_refund(&refund_id, &razorpay_refund, &currency),
    )))
}

/// Razorpay ids carry 14 characters after the prefix.
pub fn read_id_suffix(generated_id: &str) -> String {
    generated_id
        .chars()
        .skip(generated_id.len().saturating_sub(14))
        .collect()
}

/// `GET /v1/refunds/{refundId}`.
pub async fn fetch_refund(
    razorpay_call: &RazorpayCall<'_>,
    refund_id: &str,
) -> Result<RazorpayAnswer, OperationError> {
    let operation_context = razorpay_call.operation_context;
    let Some((payment_record_id, razorpay_refund)) =
        find_provider_object::<RazorpayRefund>(operation_context, refund_key(refund_id)).await?
    else {
        return Ok(Err(RazorpayError::missing_id()));
    };
    let currency = read_payment_currency(razorpay_call, &payment_record_id).await?;
    Ok(Ok((
        200,
        describe_refund(refund_id, &razorpay_refund, &currency),
    )))
}

async fn read_payment_currency(
    razorpay_call: &RazorpayCall<'_>,
    payment_record_id: &str,
) -> Result<String, OperationError> {
    let stored_payment = razorpay_call
        .operation_context
        .payment_repository
        .find_payment(payment_record_id)
        .await?;
    let payment = stored_payment
        .map(|stored_payment| crate::payments::read_payment_document(&stored_payment))
        .transpose()?;
    Ok(payment
        .map(|payment| payment.summary.currency)
        .unwrap_or_default())
}

/// `GET /v1/payments/{paymentId}/refunds`, oldest first.
pub async fn list_payment_refunds(
    razorpay_call: &RazorpayCall<'_>,
    payment_id: &str,
) -> Result<RazorpayAnswer, OperationError> {
    let payment = match find_attempted_payment(razorpay_call, payment_id).await? {
        Ok(payment) => payment,
        Err(razorpay_error) => return Ok(Err(razorpay_error)),
    };
    let refunds: Vec<(String, RazorpayRefund)> = list_payment_provider_objects(
        razorpay_call.operation_context,
        &payment.summary.id,
        REFUND_OBJECT_KIND,
    )
    .await?;
    let refund_entities = refunds
        .iter()
        .map(|(refund_id, razorpay_refund)| {
            describe_refund(refund_id, razorpay_refund, &payment.summary.currency)
        })
        .collect();
    Ok(Ok((200, describe_collection(refund_entities))))
}
